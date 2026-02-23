import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import type {
  PostActivityEventType,
  PostActivityRecord,
  PostRecord,
  PostStatus,
} from "@/lib/post-types";

const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  pending: ["approved"],
  approved: ["pending", "published"],
  published: [],
};

const FALLBACK_BUCKET = "resfin-content-studio-data";
const FALLBACK_DIR = "state";
const FALLBACK_FILE = "posts-state.json";
const FALLBACK_PATH = `${FALLBACK_DIR}/${FALLBACK_FILE}`;

type FallbackState = {
  posts: PostRecord[];
  activity: PostActivityRecord[];
};

let forceStorageFallback = false;

const MISSING_SCHEMA_PATTERNS = [
  "could not find the table 'public.posts'",
  "relation \"public.posts\" does not exist",
  "relation \"posts\" does not exist",
  "could not find the table 'public.post_activity_log'",
  "relation \"public.post_activity_log\" does not exist",
  "relation \"post_activity_log\" does not exist",
];

export function canTransitionStatus(
  from: PostStatus,
  to: PostStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function toPostStatus(value: unknown): PostStatus | null {
  if (value === "pending" || value === "approved" || value === "published") {
    return value;
  }
  return null;
}

export function shouldUseStorageFallback(message?: string | null): boolean {
  if (forceStorageFallback) return true;
  if (!message) return false;

  const normalized = message.toLowerCase();
  if (MISSING_SCHEMA_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    forceStorageFallback = true;
    return true;
  }

  return false;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizePost(raw: Record<string, unknown>): PostRecord {
  const now = new Date().toISOString();
  const status = toPostStatus(raw.status) ?? "pending";
  const createdAt = toStringOrNull(raw.created_at) ?? now;

  return {
    id: toStringOrNull(raw.id) ?? randomUUID(),
    created_at: createdAt,
    updated_at: toStringOrNull(raw.updated_at) ?? now,
    status,
    status_updated_at: toStringOrNull(raw.status_updated_at) ?? now,
    approved_at: toStringOrNull(raw.approved_at),
    published_at: toStringOrNull(raw.published_at),
    tema: toStringOrEmpty(raw.tema),
    pilar: toStringOrNull(raw.pilar),
    source: raw.source === "manual" ? "manual" : "trend",
    source_url: toStringOrNull(raw.source_url),
    hook: toStringOrNull(raw.hook),
    rascunho: toStringOrEmpty(raw.rascunho),
    formato:
      raw.formato === "post_estatico" ||
      raw.formato === "reels" ||
      raw.formato === "stories"
        ? raw.formato
        : "carrossel",
    voz:
      raw.voz === "rian_tavares" || raw.voz === "marca_institucional"
        ? raw.voz
        : "max_linder",
    copy_text: toStringOrEmpty(raw.copy_text),
    visual_descricao: toStringOrEmpty(raw.visual_descricao),
    cta: toStringOrEmpty(raw.cta),
    keyword_manychat: toStringOrNull(raw.keyword_manychat),
    contexto_viral: toStringOrNull(raw.contexto_viral),
    plataforma_origem: toStringOrNull(raw.plataforma_origem),
    metricas: toMetricasArray(raw.metricas),
    imagem_url: toStringOrNull(raw.imagem_url),
    imagem_prompt: toStringOrNull(raw.imagem_prompt),
    imagem_provider:
      raw.imagem_provider === "google" || raw.imagem_provider === "openai"
        ? raw.imagem_provider
        : null,
    notes: toStringOrNull(raw.notes),
  };
}

function normalizeActivity(raw: Record<string, unknown>): PostActivityRecord {
  const now = new Date().toISOString();
  return {
    id: toStringOrNull(raw.id) ?? randomUUID(),
    post_id: toStringOrEmpty(raw.post_id),
    event_type:
      raw.event_type === "edited" ||
      raw.event_type === "status_changed" ||
      raw.event_type === "image_generated" ||
      raw.event_type === "image_selected"
        ? raw.event_type
        : "created",
    from_status: toPostStatus(raw.from_status),
    to_status: toPostStatus(raw.to_status),
    actor: toStringOrNull(raw.actor) ?? "system",
    payload: toJsonObject(raw.payload),
    created_at: toStringOrNull(raw.created_at) ?? now,
  };
}

async function ensureFallbackBucket() {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Erro ao listar buckets de fallback: ${error.message}`);
  }

  const buckets = Array.isArray(data)
    ? (data as Array<{ name?: string | null }>)
    : [];
  const exists = buckets.some((bucket) => bucket?.name === FALLBACK_BUCKET);

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(
      FALLBACK_BUCKET,
      { public: false }
    );

    if (
      createError &&
      !createError.message.toLowerCase().includes("already exists")
    ) {
      throw new Error(
        `Erro ao criar bucket de fallback: ${createError.message}`
      );
    }
  }
}

async function loadFallbackState(): Promise<FallbackState> {
  await ensureFallbackBucket();
  const supabase = getSupabase();

  const { data: listed, error: listError } = await supabase.storage
    .from(FALLBACK_BUCKET)
    .list(FALLBACK_DIR, { limit: 100 });

  if (listError) {
    throw new Error(`Erro ao listar arquivos de fallback: ${listError.message}`);
  }

  const files = Array.isArray(listed)
    ? (listed as Array<{ name?: string | null }>)
    : [];
  const hasState = files.some((file) => file?.name === FALLBACK_FILE);

  if (!hasState) {
    return { posts: [], activity: [] };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(FALLBACK_BUCKET)
    .download(FALLBACK_PATH);

  if (downloadError || !file) {
    throw new Error(
      `Erro ao baixar estado de fallback: ${downloadError?.message ?? "arquivo ausente"}`
    );
  }

  const rawText = await file.text();
  if (!rawText.trim()) return { posts: [], activity: [] };

  const parsed = JSON.parse(rawText) as {
    posts?: Array<Record<string, unknown>>;
    activity?: Array<Record<string, unknown>>;
  };

  return {
    posts: Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost) : [],
    activity: Array.isArray(parsed.activity)
      ? parsed.activity.map(normalizeActivity)
      : [],
  };
}

async function saveFallbackState(state: FallbackState) {
  await ensureFallbackBucket();
  const supabase = getSupabase();
  const payload = JSON.stringify(state);

  const { error } = await supabase.storage.from(FALLBACK_BUCKET).upload(
    FALLBACK_PATH,
    Buffer.from(payload, "utf8"),
    {
      contentType: "application/json",
      upsert: true,
    }
  );

  if (error) {
    throw new Error(`Erro ao salvar estado de fallback: ${error.message}`);
  }
}

function mergeDefined(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }

  return merged;
}

export async function listPostsFallback(status: PostStatus | null): Promise<PostRecord[]> {
  const state = await loadFallbackState();
  const filtered = status
    ? state.posts.filter((post) => post.status === status)
    : state.posts;

  return [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getPostFallback(postId: string): Promise<PostRecord | null> {
  const state = await loadFallbackState();
  return state.posts.find((post) => post.id === postId) ?? null;
}

export async function createPostFallback(
  payload: Record<string, unknown>
): Promise<PostRecord> {
  const state = await loadFallbackState();
  const now = new Date().toISOString();

  const post = normalizePost({
    ...payload,
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    status_updated_at: toStringOrNull(payload.status_updated_at) ?? now,
    approved_at: null,
    published_at: null,
    imagem_url: null,
    imagem_prompt: null,
    imagem_provider: null,
    notes: null,
  });

  state.posts.push(post);
  await saveFallbackState(state);
  return post;
}

export async function updatePostFallback(
  postId: string,
  patch: Record<string, unknown>
): Promise<PostRecord | null> {
  const state = await loadFallbackState();
  const index = state.posts.findIndex((post) => post.id === postId);

  if (index < 0) return null;

  const current = state.posts[index] as unknown as Record<string, unknown>;
  const merged = mergeDefined(current, patch);

  const updated = normalizePost({
    ...merged,
    id: postId,
    created_at: state.posts[index].created_at,
    updated_at: new Date().toISOString(),
  });

  state.posts[index] = updated;
  await saveFallbackState(state);
  return updated;
}

export async function listPostActivityFallback(
  postId: string
): Promise<PostActivityRecord[]> {
  const state = await loadFallbackState();

  return state.activity
    .filter((item) => item.post_id === postId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function appendPostActivityFallback(params: {
  postId: string;
  eventType: PostActivityEventType;
  fromStatus?: PostStatus | null;
  toStatus?: PostStatus | null;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  const state = await loadFallbackState();

  state.activity.push(
    normalizeActivity({
      id: randomUUID(),
      post_id: params.postId,
      event_type: params.eventType,
      from_status: params.fromStatus ?? null,
      to_status: params.toStatus ?? null,
      actor: params.actor ?? "system",
      payload: params.payload ?? {},
      created_at: new Date().toISOString(),
    })
  );

  await saveFallbackState(state);
}

export async function logPostActivity(params: {
  postId: string;
  eventType: PostActivityEventType;
  fromStatus?: PostStatus | null;
  toStatus?: PostStatus | null;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  if (forceStorageFallback) {
    await appendPostActivityFallback(params);
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("post_activity_log").insert({
    post_id: params.postId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    actor: params.actor ?? "system",
    payload: params.payload ?? {},
  });

  if (error) {
    if (shouldUseStorageFallback(error.message)) {
      await appendPostActivityFallback(params);
      return;
    }

    throw new Error(`Erro ao registrar atividade: ${error.message}`);
  }
}

export function toMetricasArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
