import { randomUUID } from "crypto";
import { getSupabase } from "@/lib/supabase";
import type {
  ContentBankItem,
  StrategyMessage,
  StrategySession,
} from "@/lib/research-types";

const STORE_BUCKET = "resfin-content-studio-data";
const STORE_DIR = "state";
const CONTENT_BANK_FILE = "content-bank-v1.json";
const STRATEGY_FILE = "strategy-sessions-v1.json";

type ContentBankState = { items: ContentBankItem[] };
type StrategyState = { sessions: StrategySession[] };

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIsoDate(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return new Date().toISOString();
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function normalizeContentType(
  value: unknown
): ContentBankItem["tipo"] {
  if (
    value === "reels" ||
    value === "carrossel" ||
    value === "video" ||
    value === "artigo" ||
    value === "post"
  ) {
    return value;
  }
  return "post";
}

function normalizeStrategyMessage(value: unknown): StrategyMessage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const role = raw.role === "assistant" ? "assistant" : raw.role === "user" ? "user" : null;
  const content = normalizeText(raw.content);
  if (!role || !content) return null;

  return {
    role,
    content,
    created_at: normalizeIsoDate(raw.created_at),
  };
}

function normalizeContentBankItem(value: unknown): ContentBankItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = normalizeText(raw.id) || randomUUID();
  const sourceUrl = normalizeText(raw.source_url);
  const titulo = normalizeText(raw.titulo);
  const plataforma = normalizeText(raw.plataforma);
  const transcricao = normalizeText(raw.transcricao);

  if (!sourceUrl || !titulo || !plataforma || !transcricao) return null;

  return {
    id,
    created_at: normalizeIsoDate(raw.created_at),
    updated_at: normalizeIsoDate(raw.updated_at),
    source_url: sourceUrl,
    titulo,
    plataforma,
    tipo: normalizeContentType(raw.tipo),
    transcricao,
    tags: normalizeTags(raw.tags),
    notes: normalizeText(raw.notes) || null,
  };
}

function normalizeStrategySession(value: unknown): StrategySession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = normalizeText(raw.id) || randomUUID();
  const monthRef = normalizeText(raw.month_ref);
  const objective = normalizeText(raw.objective);
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((message) => normalizeStrategyMessage(message))
        .filter((message): message is StrategyMessage => message !== null)
    : [];

  if (!monthRef || !objective || messages.length === 0) return null;

  return {
    id,
    created_at: normalizeIsoDate(raw.created_at),
    updated_at: normalizeIsoDate(raw.updated_at),
    month_ref: monthRef,
    objective,
    messages,
  };
}

async function ensureStoreBucket() {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Erro ao listar buckets de storage: ${error.message}`);
  }

  const exists = Array.isArray(data)
    ? data.some((bucket) => bucket?.name === STORE_BUCKET)
    : false;

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(STORE_BUCKET, {
      public: false,
    });
    if (
      createError &&
      !createError.message.toLowerCase().includes("already exists")
    ) {
      throw new Error(`Erro ao criar bucket de storage: ${createError.message}`);
    }
  }
}

async function fileExists(fileName: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(STORE_BUCKET)
    .list(STORE_DIR, { limit: 200 });

  if (error) {
    throw new Error(`Erro ao listar arquivos de storage: ${error.message}`);
  }

  return Array.isArray(data)
    ? data.some((file) => file?.name === fileName)
    : false;
}

async function readJsonState<T>(
  fileName: string,
  fallback: T
): Promise<T> {
  await ensureStoreBucket();
  const exists = await fileExists(fileName);
  if (!exists) return fallback;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(STORE_BUCKET)
    .download(`${STORE_DIR}/${fileName}`);

  if (error || !data) {
    throw new Error(
      `Erro ao baixar estado (${fileName}): ${error?.message ?? "arquivo ausente"}`
    );
  }

  const raw = await data.text();
  if (!raw.trim()) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonState(fileName: string, state: unknown) {
  await ensureStoreBucket();
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(STORE_BUCKET)
    .upload(`${STORE_DIR}/${fileName}`, Buffer.from(JSON.stringify(state), "utf8"), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao salvar estado (${fileName}): ${error.message}`);
  }
}

export async function listContentBankItems(): Promise<ContentBankItem[]> {
  const raw = await readJsonState<ContentBankState>(CONTENT_BANK_FILE, { items: [] });
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => normalizeContentBankItem(item))
        .filter((item): item is ContentBankItem => item !== null)
    : [];

  return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createContentBankItem(input: {
  source_url: string;
  titulo: string;
  plataforma: string;
  tipo: ContentBankItem["tipo"];
  transcricao: string;
  tags?: string[];
  notes?: string | null;
}): Promise<ContentBankItem> {
  const items = await listContentBankItems();
  const now = new Date().toISOString();
  const normalizedSourceUrl = normalizeText(input.source_url);
  const normalizedTitle = normalizeText(input.titulo);
  const normalizedPlatform = normalizeText(input.plataforma);
  const normalizedTranscription = normalizeText(input.transcricao);
  const normalizedTags = normalizeTags(input.tags ?? []);
  const normalizedNotes = normalizeText(input.notes ?? "") || null;

  const existing = items.find((item) => item.source_url === normalizedSourceUrl);
  if (existing) {
    const updated: ContentBankItem = {
      ...existing,
      updated_at: now,
      titulo: normalizedTitle || existing.titulo,
      plataforma: normalizedPlatform || existing.plataforma,
      tipo: input.tipo ?? existing.tipo,
      transcricao: normalizedTranscription || existing.transcricao,
      tags: normalizedTags.length > 0 ? normalizedTags : existing.tags,
      notes: normalizedNotes,
    };
    const next = [updated, ...items.filter((item) => item.id !== existing.id)];
    await writeJsonState(CONTENT_BANK_FILE, { items: next });
    return updated;
  }

  const newItem: ContentBankItem = {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    source_url: normalizedSourceUrl,
    titulo: normalizedTitle,
    plataforma: normalizedPlatform,
    tipo: input.tipo,
    transcricao: normalizedTranscription,
    tags: normalizedTags,
    notes: normalizedNotes,
  };

  await writeJsonState(CONTENT_BANK_FILE, { items: [newItem, ...items] });
  return newItem;
}

export async function deleteContentBankItem(itemId: string): Promise<boolean> {
  const items = await listContentBankItems();
  const next = items.filter((item) => item.id !== itemId);
  if (next.length === items.length) return false;
  await writeJsonState(CONTENT_BANK_FILE, { items: next });
  return true;
}

export async function listStrategySessions(): Promise<StrategySession[]> {
  const raw = await readJsonState<StrategyState>(STRATEGY_FILE, { sessions: [] });
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .map((session) => normalizeStrategySession(session))
        .filter((session): session is StrategySession => session !== null)
    : [];

  return sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveStrategySession(input: {
  month_ref: string;
  objective: string;
  messages: StrategyMessage[];
}): Promise<StrategySession> {
  const sessions = await listStrategySessions();
  const now = new Date().toISOString();

  const normalizedMessages = input.messages
    .map((message) => normalizeStrategyMessage(message))
    .filter((message): message is StrategyMessage => message !== null);

  const existingIndex = sessions.findIndex(
    (session) => session.month_ref === input.month_ref
  );

  if (existingIndex >= 0) {
    const updated: StrategySession = {
      ...sessions[existingIndex],
      updated_at: now,
      objective: input.objective,
      messages: normalizedMessages,
    };
    const next = [...sessions];
    next.splice(existingIndex, 1);
    await writeJsonState(STRATEGY_FILE, { sessions: [updated, ...next] });
    return updated;
  }

  const created: StrategySession = {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    month_ref: input.month_ref,
    objective: input.objective,
    messages: normalizedMessages,
  };

  await writeJsonState(STRATEGY_FILE, { sessions: [created, ...sessions] });
  return created;
}
