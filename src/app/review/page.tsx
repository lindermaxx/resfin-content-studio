"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  FileWarning,
  Loader2,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CopyIdea } from "@/lib/copy-types";
import type {
  CreatePostRequest,
  PostFormato,
  PostRecord,
  PostSource,
  PostStatus,
  PostVoz,
} from "@/lib/post-types";

type ActionState = "save" | "approve" | "reject" | null;

interface StoredCopyContext {
  tema: string;
  pilar: string | null;
  hook: string | null;
  rascunho: string;
  source: PostSource;
  contextoViral: string | null;
  plataforma: string | null;
  metricas: string[];
  url: string | null;
  formato: PostFormato;
  voz: PostVoz;
  idea: CopyIdea;
}

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

function toPostStatus(value: unknown): PostStatus | null {
  if (value === "pending" || value === "approved" || value === "published") {
    return value;
  }
  return null;
}

function toPostSource(value: unknown): PostSource {
  return value === "trend" ? "trend" : "manual";
}

function toPostFormato(value: unknown): PostFormato {
  if (
    value === "carrossel" ||
    value === "post_estatico" ||
    value === "reels" ||
    value === "stories"
  ) {
    return value;
  }
  return "carrossel";
}

function toPostVoz(value: unknown): PostVoz {
  if (
    value === "max_linder" ||
    value === "rian_tavares" ||
    value === "marca_institucional"
  ) {
    return value;
  }
  return "max_linder";
}

function normalizeCopyIdea(value: unknown): CopyIdea | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Record<keyof CopyIdea, unknown>>;
  if (
    raw.angulo !== "educativo" &&
    raw.angulo !== "provocativo" &&
    raw.angulo !== "storytelling"
  ) {
    return null;
  }
  if (
    typeof raw.hook !== "string" ||
    typeof raw.copy !== "string" ||
    typeof raw.visual !== "string" ||
    typeof raw.cta !== "string"
  ) {
    return null;
  }
  return {
    angulo: raw.angulo,
    hook: raw.hook,
    copy: raw.copy,
    visual: raw.visual,
    cta: raw.cta,
  };
}

function normalizeStoredContext(value: unknown): StoredCopyContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const tema = typeof raw.tema === "string" ? raw.tema.trim() : "";
  if (!tema) return null;

  const idea = normalizeCopyIdea(raw.idea);
  if (!idea) return null;

  return {
    tema,
    pilar: toNullableString(raw.pilar),
    hook: toNullableString(raw.hook),
    rascunho: typeof raw.rascunho === "string" ? raw.rascunho : "",
    source: toPostSource(raw.source),
    contextoViral: toNullableString(raw.contextoViral),
    plataforma: toNullableString(raw.plataforma),
    metricas: normalizeMetricas(raw.metricas),
    url: toNullableString(raw.url),
    formato: toPostFormato(raw.formato),
    voz: toPostVoz(raw.voz),
    idea,
  };
}

function normalizePostRecord(value: unknown): PostRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const status = toPostStatus(raw.status);
  const tema = typeof raw.tema === "string" ? raw.tema : "";
  if (!id || !status || !tema) return null;

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
    source: toPostSource(raw.source),
    source_url: toNullableString(raw.source_url),
    hook: toNullableString(raw.hook),
    rascunho: typeof raw.rascunho === "string" ? raw.rascunho : "",
    formato: toPostFormato(raw.formato),
    voz: toPostVoz(raw.voz),
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const formatoLabel: Record<PostFormato, string> = {
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

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [context, setContext] = useState<StoredCopyContext | null>(null);
  const [post, setPost] = useState<PostRecord | null>(null);

  const [copyText, setCopyText] = useState("");
  const [visualDescricao, setVisualDescricao] = useState("");
  const [cta, setCta] = useState("");
  const [notes, setNotes] = useState("");

  const [actionState, setActionState] = useState<ActionState>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoadingInitial(true);
      setError(null);

      const postId = searchParams.get("postId");
      if (postId) {
        try {
          const response = await requestJson<unknown>(`/api/posts/${postId}`);
          const normalizedPost = normalizePostRecord(response);
          if (!normalizedPost) {
            throw new Error("Post inválido retornado pela API.");
          }
          if (!active) return;
          setPost(normalizedPost);
          setCopyText(normalizedPost.copy_text);
          setVisualDescricao(normalizedPost.visual_descricao);
          setCta(normalizedPost.cta);
          setNotes(normalizedPost.notes ?? "");
          sessionStorage.setItem("resfin_active_post_id", normalizedPost.id);
        } catch (err) {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Erro ao carregar post.");
        } finally {
          if (active) setLoadingInitial(false);
        }
        return;
      }

      const raw = sessionStorage.getItem("resfin_copy_context");
      if (!raw) {
        if (active) setLoadingInitial(false);
        return;
      }

      try {
        const parsed = normalizeStoredContext(JSON.parse(raw));
        if (!parsed) throw new Error("Contexto de copy inválido.");
        if (!active) return;
        setContext(parsed);
        setCopyText(parsed.idea.copy);
        setVisualDescricao(parsed.idea.visual);
        setCta(parsed.idea.cta);
        setNotes("");
      } catch {
        if (active) {
          setError(
            "Não foi possível carregar o contexto do Copy Studio. Gere uma ideia novamente."
          );
        }
      } finally {
        if (active) setLoadingInitial(false);
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [searchParams]);

  async function ensurePost(): Promise<PostRecord> {
    if (post) return post;
    if (!context) {
      throw new Error("Sem contexto para criar o post.");
    }

    const payload: CreatePostRequest = {
      tema: context.tema,
      pilar: context.pilar,
      source: context.source,
      source_url: context.url,
      hook: context.idea.hook || context.hook,
      rascunho: context.rascunho,
      formato: context.formato,
      voz: context.voz,
      copy_text: copyText.trim(),
      visual_descricao: visualDescricao.trim(),
      cta: cta.trim(),
      keyword_manychat: null,
      contexto_viral: context.contextoViral,
      plataforma_origem: context.plataforma,
      metricas: context.metricas,
    };

    const createdRaw = await requestJson<unknown>("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created = normalizePostRecord(createdRaw);
    if (!created) {
      throw new Error("Erro ao normalizar post criado.");
    }

    setPost(created);
    sessionStorage.setItem("resfin_active_post_id", created.id);
    return created;
  }

  async function saveDraft(showSuccess = true): Promise<PostRecord> {
    const targetPost = await ensurePost();
    const updatedRaw = await requestJson<unknown>(`/api/posts/${targetPost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copy_text: copyText.trim(),
        visual_descricao: visualDescricao.trim(),
        cta: cta.trim(),
        notes: notes.trim() || null,
      }),
    });

    const updated = normalizePostRecord(updatedRaw);
    if (!updated) throw new Error("Erro ao normalizar post atualizado.");

    setPost(updated);
    sessionStorage.setItem("resfin_active_post_id", updated.id);
    if (showSuccess) {
      setSuccess("Alterações salvas com sucesso.");
    }
    return updated;
  }

  async function updateStatus(postId: string, status: PostStatus): Promise<PostRecord> {
    const updatedRaw = await requestJson<unknown>(`/api/posts/${postId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated = normalizePostRecord(updatedRaw);
    if (!updated) throw new Error("Erro ao normalizar status atualizado.");
    setPost(updated);
    return updated;
  }

  async function handleSave() {
    if (!copyText.trim()) {
      setError("A copy não pode ficar vazia.");
      return;
    }
    setActionState("save");
    setError(null);
    setSuccess(null);
    try {
      await saveDraft(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setActionState(null);
    }
  }

  async function handleApprove() {
    if (!copyText.trim()) {
      setError("A copy não pode ficar vazia.");
      return;
    }
    setActionState("approve");
    setError(null);
    setSuccess(null);

    try {
      const saved = await saveDraft(false);
      const approved = await updateStatus(saved.id, "approved");
      sessionStorage.setItem("resfin_active_post_id", approved.id);
      sessionStorage.setItem("resfin_active_post", JSON.stringify(approved));
      router.push("/image");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar post.");
      setActionState(null);
    }
  }

  async function handleReject() {
    if (!copyText.trim()) {
      setError("A copy não pode ficar vazia.");
      return;
    }
    setActionState("reject");
    setError(null);
    setSuccess(null);

    try {
      const saved = await saveDraft(false);
      await updateStatus(saved.id, "pending");
      router.push("/pipeline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao rejeitar post.");
      setActionState(null);
    }
  }

  const isBusy = actionState !== null;
  const tema = post?.tema ?? context?.tema ?? "";
  const source = post?.source ?? context?.source ?? "manual";
  const formato = post?.formato ?? context?.formato ?? "carrossel";
  const voz = post?.voz ?? context?.voz ?? "max_linder";

  if (loadingInitial) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando contexto de review...
        </div>
      </div>
    );
  }

  if (!context && !post) {
    return (
      <div className="flex flex-col gap-6 px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <CheckCircle className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Review</h1>
            <p className="text-sm text-zinc-500">Revisão e edição do post</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
          <div className="flex items-center gap-2 text-amber-800">
            <FileWarning className="h-4 w-4" />
            <p className="text-sm font-medium">Nenhum post/contexto carregado.</p>
          </div>
          <p className="mt-2 text-sm text-amber-700">
            Gere uma ideia no Copy Studio ou abra um post existente pelo Pipeline.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => router.push("/copy")}>
              Ir para Copy
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/pipeline")}>
              Abrir Pipeline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <CheckCircle className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Review</h1>
            <p className="text-sm text-zinc-500">Revisão e edição do post</p>
          </div>
        </div>
        {post && (
          <Badge variant="outline" className="text-xs">
            Status: {post.status}
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Tema</p>
        <p className="mt-1 text-sm font-medium text-zinc-900">{tema}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatoLabel[formato]}</Badge>
          <Badge variant="secondary">{vozLabel[voz]}</Badge>
          <Badge variant="outline">
            {source === "trend" ? "Origem: trend" : "Origem: manual"}
          </Badge>
          {post && <Badge variant="outline">Atualizado: {formatDateTime(post.updated_at)}</Badge>}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Editor</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="copy_text" className="text-xs font-medium text-zinc-500">
                Copy principal
              </label>
              <textarea
                id="copy_text"
                value={copyText}
                onChange={(event) => setCopyText(event.target.value)}
                rows={10}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="visual" className="text-xs font-medium text-zinc-500">
                Descrição visual
              </label>
              <textarea
                id="visual"
                value={visualDescricao}
                onChange={(event) => setVisualDescricao(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cta" className="text-xs font-medium text-zinc-500">
                CTA
              </label>
              <input
                id="cta"
                type="text"
                value={cta}
                onChange={(event) => setCta(event.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className="text-xs font-medium text-zinc-500">
                Notas internas (opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Mockup visual</h2>
          <div className="mt-4 mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-zinc-300" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-zinc-800">
                  @residenciaemfinancas
                </span>
                <span className="text-[11px] text-zinc-500">Post em revisão</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800">
                {copyText.trim() || "Escreva a copy para visualizar o mockup."}
              </p>
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-medium text-zinc-500">CTA</p>
              <p className="mt-1 text-sm text-zinc-700">
                {cta.trim() || "CTA não definido"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">Descrição visual</p>
            <p className="mt-1 text-sm text-zinc-700">
              {visualDescricao.trim() || "Sem descrição visual."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-zinc-700">
            Salve alterações, aprove para gerar imagem ou rejeite para voltar ao pipeline.
          </p>
          {post && (
            <p className="text-xs text-zinc-500">
              Criado: {formatDateTime(post.created_at)} | Última atualização:{" "}
              {formatDateTime(post.updated_at)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/copy")}
            disabled={isBusy}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Nova versão
          </Button>
          <Button variant="outline" onClick={handleReject} disabled={isBusy}>
            {actionState === "reject" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Rejeitar
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isBusy}>
            {actionState === "save" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
          <Button onClick={handleApprove} disabled={isBusy}>
            {actionState === "approve" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Aprovar e ir para Image
          </Button>
        </div>
      </div>
    </div>
  );
}
