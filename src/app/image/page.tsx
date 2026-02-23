"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  GenerateImageResponse,
  ImageProvider,
  PostFormato,
  PostRecord,
  PostStatus,
  PostVoz,
} from "@/lib/post-types";

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeMetricas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPostStatus(value: unknown): PostStatus {
  if (value === "approved" || value === "published") return value;
  return "pending";
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

function normalizePostRecord(value: unknown): PostRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const tema = typeof raw.tema === "string" ? raw.tema : "";
  if (!id || !tema) return null;

  return {
    id,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    status: toPostStatus(raw.status),
    status_updated_at:
      typeof raw.status_updated_at === "string" ? raw.status_updated_at : "",
    approved_at: toNullableString(raw.approved_at),
    published_at: toNullableString(raw.published_at),
    tema,
    pilar: toNullableString(raw.pilar),
    source: raw.source === "trend" ? "trend" : "manual",
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

function normalizeGenerateResponse(value: unknown): GenerateImageResponse | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.provider !== "google" && raw.provider !== "openai") return null;
  if (typeof raw.prompt_used !== "string") return null;
  if (!Array.isArray(raw.variants)) return null;

  const variants = raw.variants
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url : "";
      if (!url) return null;
      return {
        url,
        provider_image_id:
          typeof obj.provider_image_id === "string" ? obj.provider_image_id : null,
      };
    })
    .filter((item): item is { url: string; provider_image_id: string | null } => item !== null);

  if (variants.length === 0) return null;
  return {
    provider: raw.provider,
    prompt_used: raw.prompt_used,
    variants,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Erro na requisição (${response.status}).`;
    throw new Error(message);
  }

  return data as T;
}

function formatVoz(voz: PostVoz): string {
  if (voz === "rian_tavares") return "Rian Tavares";
  if (voz === "marca_institucional") return "Marca institucional";
  return "Max Linder";
}

function formatFormato(formato: PostFormato): string {
  if (formato === "post_estatico") return "Post estático";
  if (formato === "reels") return "Reels";
  if (formato === "stories") return "Stories";
  return "Carrossel";
}

export default function ImagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingPost, setLoadingPost] = useState(true);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const [basePrompt, setBasePrompt] = useState("");
  const [instruction, setInstruction] = useState("");

  const [generation, setGeneration] = useState<GenerateImageResponse | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPost() {
      setLoadingPost(true);
      setPostError(null);

      const queryPostId = searchParams.get("postId");
      const sessionPostId =
        typeof window !== "undefined"
          ? sessionStorage.getItem("resfin_active_post_id")
          : null;
      const postId = queryPostId || sessionPostId;

      if (!postId) {
        if (active) setLoadingPost(false);
        return;
      }

      try {
        const raw = await requestJson<unknown>(`/api/posts/${postId}`);
        const normalizedPost = normalizePostRecord(raw);
        if (!normalizedPost) throw new Error("Post inválido retornado pela API.");
        if (!active) return;

        setPost(normalizedPost);
        setBasePrompt(
          normalizedPost.visual_descricao.trim() ||
            `Imagem para post sobre ${normalizedPost.tema}`
        );
        if (normalizedPost.imagem_url) {
          setSelectedUrl(normalizedPost.imagem_url);
        }
      } catch (err) {
        if (!active) return;
        setPostError(err instanceof Error ? err.message : "Erro ao carregar post.");
      } finally {
        if (active) setLoadingPost(false);
      }
    }

    void loadPost();
    return () => {
      active = false;
    };
  }, [searchParams]);

  async function handleGenerate() {
    if (!post) return;
    if (!basePrompt.trim()) {
      setError("Descreva o prompt base para gerar a imagem.");
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const raw = await requestJson<unknown>("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          base_prompt: basePrompt.trim(),
          instruction: instruction.trim() || null,
        }),
      });
      const normalized = normalizeGenerateResponse(raw);
      if (!normalized) {
        throw new Error("Resposta inválida da API de geração de imagem.");
      }
      setGeneration(normalized);
      setSelectedUrl(normalized.variants[0]?.url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar imagens.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSelection() {
    if (!post) return;
    if (!generation || !selectedUrl) {
      setError("Selecione uma imagem antes de salvar.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const raw = await requestJson<unknown>(`/api/posts/${post.id}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagem_url: selectedUrl,
          imagem_provider: generation.provider as ImageProvider,
          imagem_prompt: generation.prompt_used,
        }),
      });
      const updatedPost = normalizePostRecord(raw);
      if (!updatedPost) {
        throw new Error("Erro ao normalizar post após salvar imagem.");
      }
      setPost(updatedPost);
      setSuccess("Imagem selecionada e salva com sucesso.");
      sessionStorage.setItem("resfin_active_post_id", updatedPost.id);
      sessionStorage.setItem("resfin_active_post", JSON.stringify(updatedPost));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar imagem.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingPost) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando post para geração de imagem...
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col gap-6 px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <ImageIcon className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Image Studio</h1>
            <p className="text-sm text-zinc-500">Geração e seleção de imagem</p>
          </div>
        </div>

        {postError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {postError}
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-700">
          Nenhum post aprovado encontrado para o Image Studio.
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/review")}>Ir para Review</Button>
          <Button variant="outline" onClick={() => router.push("/pipeline")}>
            Ir para Pipeline
          </Button>
        </div>
      </div>
    );
  }

  const canGenerate = post.status === "approved" || post.status === "published";

  return (
    <div className="flex flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <ImageIcon className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Image Studio</h1>
            <p className="text-sm text-zinc-500">Geração e seleção de imagem</p>
          </div>
        </div>
        <Badge variant="outline">Status: {post.status}</Badge>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Post</p>
        <p className="mt-1 text-sm font-medium text-zinc-900">{post.tema}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{formatFormato(post.formato)}</Badge>
          <Badge variant="secondary">{formatVoz(post.voz)}</Badge>
          {post.imagem_provider && <Badge variant="outline">Atual: {post.imagem_provider}</Badge>}
        </div>
      </div>

      {!canGenerate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Este post precisa estar aprovado para gerar imagem.
        </div>
      )}

      {(postError || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {postError || error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Prompt de geração</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="base_prompt" className="text-xs font-medium text-zinc-500">
                Prompt base
              </label>
              <textarea
                id="base_prompt"
                value={basePrompt}
                onChange={(event) => setBasePrompt(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="instruction" className="text-xs font-medium text-zinc-500">
                Instrução adicional (opcional)
              </label>
              <textarea
                id="instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={3}
                placeholder="Ex: fundo claro, ambiente consultório, estilo editorial clean."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !canGenerate}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {generation ? "Regenerar variações" : "Gerar variações"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Resultado</h2>

          {generation ? (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Provedor: {generation.provider}</Badge>
                <Badge variant="secondary">{generation.variants.length} variações</Badge>
              </div>
              <p className="text-xs text-zinc-500 line-clamp-4">{generation.prompt_used}</p>
            </div>
          ) : post.imagem_url ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-xs text-zinc-500">Imagem já salva neste post.</p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imagem_url}
                  alt="Imagem atual do post"
                  className="h-56 w-full rounded-md object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
              Gere variações para selecionar a imagem final.
            </div>
          )}
        </div>
      </div>

      {generation && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Selecione uma imagem</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {generation.variants.map((variant, index) => {
              const isSelected = selectedUrl === variant.url;
              return (
                <button
                  key={`${variant.url.slice(0, 32)}-${index}`}
                  type="button"
                  onClick={() => setSelectedUrl(variant.url)}
                  className={`rounded-xl border p-2 text-left transition ${
                    isSelected
                      ? "border-zinc-900 ring-1 ring-zinc-900"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={variant.url}
                    alt={`Variação ${index + 1}`}
                    className="h-56 w-full rounded-md object-cover"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-600">Variação {index + 1}</span>
                    {isSelected && (
                      <span className="text-xs font-medium text-zinc-900">
                        Selecionada
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Selecione a imagem final e salve no post para refletir no Pipeline.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSaveSelection}
                disabled={!selectedUrl || saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar imagem
              </Button>
              <Button onClick={() => router.push("/pipeline")}>
                Ir para Pipeline
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {post.imagem_url && !generation && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Imagem já vinculada ao post.
          </div>
        </div>
      )}
    </div>
  );
}
