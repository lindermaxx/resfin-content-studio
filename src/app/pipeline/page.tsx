"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  History,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PostActivityRecord, PostRecord, PostStatus, PostVoz } from "@/lib/post-types";

type StatusAction = {
  postId: string;
  toStatus: PostStatus;
} | null;

const statusTitle: Record<PostStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  published: "Published",
};

const statusDescription: Record<PostStatus, string> = {
  pending: "Aguardando revisão final",
  approved: "Pronto para imagem/publicação",
  published: "Conteúdo publicado",
};

const formatoLabel: Record<PostRecord["formato"], string> = {
  carrossel: "Carrossel",
  post_estatico: "Post estático",
  reels: "Reels",
  stories: "Stories",
};

const vozLabel: Record<PostVoz, string> = {
  max_linder: "Max Linder",
  rian_tavares: "Rian Tavares",
  marca_institucional: "Marca institucional",
};

const activityLabel: Record<PostActivityRecord["event_type"], string> = {
  created: "Post criado",
  edited: "Post editado",
  status_changed: "Status alterado",
  image_generated: "Imagem gerada",
  image_selected: "Imagem selecionada",
};

function normalizeMetricas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizePostStatus(value: unknown): PostStatus {
  if (value === "approved" || value === "published") return value;
  return "pending";
}

function normalizePostRecord(value: unknown): PostRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const tema = typeof raw.tema === "string" ? raw.tema : "";
  if (!id || !tema) return null;

  const formato =
    raw.formato === "carrossel" ||
    raw.formato === "post_estatico" ||
    raw.formato === "reels" ||
    raw.formato === "stories"
      ? raw.formato
      : "carrossel";

  const voz =
    raw.voz === "max_linder" ||
    raw.voz === "rian_tavares" ||
    raw.voz === "marca_institucional"
      ? raw.voz
      : "max_linder";

  const source = raw.source === "trend" ? "trend" : "manual";
  const status = normalizePostStatus(raw.status);

  return {
    id,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    status,
    status_updated_at:
      typeof raw.status_updated_at === "string" ? raw.status_updated_at : "",
    approved_at: toNullableString(raw.approved_at),
    published_at: toNullableString(raw.published_at),
    tema,
    pilar: toNullableString(raw.pilar),
    source,
    source_url: toNullableString(raw.source_url),
    hook: toNullableString(raw.hook),
    rascunho: typeof raw.rascunho === "string" ? raw.rascunho : "",
    formato,
    voz,
    copy_text: typeof raw.copy_text === "string" ? raw.copy_text : "",
    visual_descricao:
      typeof raw.visual_descricao === "string" ? raw.visual_descricao : "",
    cta: typeof raw.cta === "string" ? raw.cta : "",
    keyword_manychat: toNullableString(raw.keyword_manychat),
    contexto_viral: toNullableString(raw.contexto_viral),
    plataforma_origem: toNullableString(raw.plataforma_origem),
    metricas: normalizeMetricas(raw.metricas),
    imagem_url: toNullableString(raw.imagem_url),
    imagem_prompt: toNullableString(raw.imagem_prompt),
    imagem_provider:
      raw.imagem_provider === "google" || raw.imagem_provider === "openai"
        ? raw.imagem_provider
        : null,
    notes:
      raw.notes === null
        ? null
        : typeof raw.notes === "string"
          ? raw.notes
          : null,
  };
}

function normalizeActivityRecord(value: unknown): PostActivityRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.event_type !== "created" &&
    raw.event_type !== "edited" &&
    raw.event_type !== "status_changed" &&
    raw.event_type !== "image_generated" &&
    raw.event_type !== "image_selected"
  ) {
    return null;
  }
  const id = typeof raw.id === "string" ? raw.id : "";
  const postId = typeof raw.post_id === "string" ? raw.post_id : "";
  const createdAt = typeof raw.created_at === "string" ? raw.created_at : "";
  if (!id || !postId || !createdAt) return null;

  return {
    id,
    post_id: postId,
    event_type: raw.event_type,
    from_status:
      raw.from_status === "pending" ||
      raw.from_status === "approved" ||
      raw.from_status === "published"
        ? raw.from_status
        : null,
    to_status:
      raw.to_status === "pending" ||
      raw.to_status === "approved" ||
      raw.to_status === "published"
        ? raw.to_status
        : null,
    actor: typeof raw.actor === "string" ? raw.actor : "system",
    payload:
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : {},
    created_at: createdAt,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Erro na requisição (${res.status}).`;
    throw new Error(message);
  }

  return data as T;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function PipelinePage() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);

  const [activityByPostId, setActivityByPostId] = useState<
    Record<string, PostActivityRecord[]>
  >({});
  const [activityOpenByPostId, setActivityOpenByPostId] = useState<
    Record<string, boolean>
  >({});
  const [activityLoadingByPostId, setActivityLoadingByPostId] = useState<
    Record<string, boolean>
  >({});

  const groupedPosts = useMemo(() => {
    const grouped: Record<PostStatus, PostRecord[]> = {
      pending: [],
      approved: [],
      published: [],
    };

    for (const post of posts) {
      grouped[post.status].push(post);
    }

    return grouped;
  }, [posts]);

  async function loadPosts() {
    setLoadingPosts(true);
    setError(null);
    try {
      const raw = await requestJson<unknown[]>("/api/posts");
      const normalized = raw
        .map((item) => normalizePostRecord(item))
        .filter((item): item is PostRecord => item !== null);
      setPosts(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pipeline.");
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  async function changeStatus(post: PostRecord, nextStatus: PostStatus) {
    const originalPost = post;
    const optimisticUpdatedAt = new Date().toISOString();

    setStatusAction({ postId: post.id, toStatus: nextStatus });
    setError(null);
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? { ...item, status: nextStatus, status_updated_at: optimisticUpdatedAt }
          : item
      )
    );

    try {
      const raw = await requestJson<unknown>(`/api/posts/${post.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const updated = normalizePostRecord(raw);
      if (!updated) {
        throw new Error("Erro ao normalizar atualização de status.");
      }
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? updated : item))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao mudar status do post.";
      setError(message);
      setPosts((current) =>
        current.map((item) => (item.id === originalPost.id ? originalPost : item))
      );
    } finally {
      setStatusAction(null);
    }
  }

  async function toggleActivity(postId: string) {
    const currentlyOpen = Boolean(activityOpenByPostId[postId]);
    setActivityOpenByPostId((prev) => ({ ...prev, [postId]: !currentlyOpen }));

    if (currentlyOpen || activityByPostId[postId]) return;

    setActivityLoadingByPostId((prev) => ({ ...prev, [postId]: true }));
    try {
      const raw = await requestJson<unknown[]>(`/api/posts/${postId}/activity`);
      const normalized = raw
        .map((item) => normalizeActivityRecord(item))
        .filter((item): item is PostActivityRecord => item !== null);
      setActivityByPostId((prev) => ({ ...prev, [postId]: normalized }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao carregar histórico de atividade.";
      setError(message);
    } finally {
      setActivityLoadingByPostId((prev) => ({ ...prev, [postId]: false }));
    }
  }

  function renderStatusActions(post: PostRecord) {
    const isLoading = statusAction?.postId === post.id;

    if (post.status === "pending") {
      return (
        <Button
          size="sm"
          onClick={() => changeStatus(post, "approved")}
          disabled={Boolean(isLoading)}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
          )}
          Aprovar
        </Button>
      );
    }

    if (post.status === "approved") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus(post, "pending")}
            disabled={Boolean(isLoading)}
          >
            {isLoading && statusAction?.toStatus === "pending" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
            )}
            Pending
          </Button>
          <Button
            size="sm"
            onClick={() => changeStatus(post, "published")}
            disabled={Boolean(isLoading)}
          >
            {isLoading && statusAction?.toStatus === "published" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-3.5 w-3.5" />
            )}
            Publicar
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        Publicado em {formatDateTime(post.published_at ?? post.updated_at)}
      </div>
    );
  }

  function renderActivity(post: PostRecord) {
    const isOpen = Boolean(activityOpenByPostId[post.id]);
    const isLoading = Boolean(activityLoadingByPostId[post.id]);
    const items = activityByPostId[post.id] ?? [];

    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            void toggleActivity(post.id);
          }}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
        >
          <History className="h-3.5 w-3.5" />
          {isOpen ? "Ocultar histórico" : "Ver histórico"}
        </button>

        {isOpen && (
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando atividades...
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-zinc-500">Sem atividades registradas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div key={item.id} className="text-xs text-zinc-600">
                    <p className="font-medium text-zinc-700">
                      {activityLabel[item.event_type]}
                      {item.from_status && item.to_status
                        ? ` (${item.from_status} → ${item.to_status})`
                        : ""}
                    </p>
                    <p>{formatDateTime(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderColumn(status: PostStatus) {
    const items = groupedPosts[status];

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{statusTitle[status]}</h2>
            <p className="text-xs text-zinc-500">{statusDescription[status]}</p>
          </div>
          <Badge variant="secondary">{items.length}</Badge>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
            Sem posts nesta coluna.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((post) => (
              <div key={post.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-900">{post.tema}</p>
                  {post.imagem_url && (
                    <Badge variant="outline" className="shrink-0">
                      Com imagem
                    </Badge>
                  )}
                </div>

                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-600">
                  {post.copy_text}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{formatoLabel[post.formato]}</Badge>
                  <Badge variant="secondary">{vozLabel[post.voz]}</Badge>
                  <Badge variant="outline">
                    <Clock3 className="mr-1 h-3 w-3" />
                    {formatDateTime(post.updated_at)}
                  </Badge>
                </div>

                <div className="mt-3">{renderStatusActions(post)}</div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={`/review?postId=${post.id}`}
                    className="text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                  >
                    Abrir no Review
                  </Link>
                </div>

                {renderActivity(post)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <LayoutDashboard className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Pipeline</h1>
            <p className="text-sm text-zinc-500">
              Kanban de posts com transição de status e histórico
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadPosts()}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loadingPosts && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingPosts ? (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando posts...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {renderColumn("pending")}
          {renderColumn("approved")}
          {renderColumn("published")}
        </div>
      )}
    </div>
  );
}
