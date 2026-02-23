import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  getPostFallback,
  logPostActivity,
  shouldUseStorageFallback,
} from "@/lib/posts-service";
import type {
  GenerateImageRequest,
  GenerateImageResponse,
  ImageProvider,
  ImageVariant,
  PostStatus,
} from "@/lib/post-types";

export const maxDuration = 60;

const DEFAULT_GOOGLE_IMAGE_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

function isLikelyBase64Image(value: string): boolean {
  const normalized = value.replace(/\s+/g, "");
  return normalized.length > 200 && /^[A-Za-z0-9+/=]+$/.test(normalized);
}

function collectImageCandidates(node: unknown, out: string[]) {
  if (!node) return;

  if (typeof node === "string") {
    if (node.startsWith("http://") || node.startsWith("https://")) {
      out.push(node);
      return;
    }
    if (isLikelyBase64Image(node)) {
      out.push(`data:image/png;base64,${node.replace(/\s+/g, "")}`);
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) collectImageCandidates(item, out);
    return;
  }

  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const keys = [
    "url",
    "imageUrl",
    "uri",
    "imageBytes",
    "bytesBase64Encoded",
    "b64_json",
    "base64",
    "data",
  ];

  for (const key of keys) {
    if (key in obj) collectImageCandidates(obj[key], out);
  }

  for (const value of Object.values(obj)) {
    if (typeof value === "object" || Array.isArray(value)) {
      collectImageCandidates(value, out);
    }
  }
}

function extractVariants(payload: unknown, maxCount: number): ImageVariant[] {
  const candidates: string[] = [];
  collectImageCandidates(payload, candidates);

  const unique = Array.from(new Set(candidates)).slice(0, maxCount);
  return unique.map((url) => ({ url, provider_image_id: null }));
}

function buildPrompt(basePrompt: string, instruction: string | null): string {
  const sections = [
    "Crie uma imagem para Instagram, alta qualidade, estilo editorial premium, sem texto sobreposto.",
    basePrompt.trim(),
  ];
  if (instruction?.trim()) {
    sections.push(`Instrução extra: ${instruction.trim()}`);
  }
  sections.push("Foco em composição limpa, legibilidade visual e iluminação natural.");
  return sections.join("\n\n");
}

async function generateWithGoogle(params: {
  prompt: string;
  count: number;
  apiKey: string;
  model: string;
}): Promise<ImageVariant[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(params.model)}:generateImages?key=${params.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: { text: params.prompt },
      generationConfig: {
        numberOfImages: params.count,
        outputMimeType: "image/png",
      },
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Google AI retornou falha de autenticação/quota.");
    }
    throw new Error(
      `Google AI ${res.status}${details ? ` - ${details.slice(0, 180)}` : ""}`
    );
  }

  const payload = (await res.json().catch(() => null)) as unknown;
  const variants = extractVariants(payload, params.count);

  if (variants.length < 2) {
    throw new Error("Google AI retornou menos variações do que o esperado.");
  }

  return variants;
}

async function generateWithOpenAI(params: {
  prompt: string;
  count: number;
  apiKey: string;
  model: string;
}): Promise<ImageVariant[]> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: params.count,
      size: "1024x1024",
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new Error("OpenAI retornou falha de autenticação/quota.");
    }
    throw new Error(
      `OpenAI ${res.status}${details ? ` - ${details.slice(0, 180)}` : ""}`
    );
  }

  const payload = (await res.json().catch(() => null)) as {
    data?: Array<{ url?: string | null; b64_json?: string | null }>;
  } | null;

  const variants = (payload?.data ?? [])
    .map((item): ImageVariant | null => {
      const url =
        typeof item.url === "string" && item.url
          ? item.url
          : typeof item.b64_json === "string" && item.b64_json
            ? `data:image/png;base64,${item.b64_json}`
            : null;

      if (!url) return null;

      return {
        url,
        provider_image_id: null,
      };
    })
    .filter((item): item is ImageVariant => item !== null);

  if (variants.length < 2) {
    throw new Error("OpenAI retornou menos variações do que o esperado.");
  }

  return variants;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json()) as unknown;
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: "Payload inválido para geração de imagem." },
        { status: 400 }
      );
    }

    const body = rawBody as Partial<GenerateImageRequest>;
    const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
    const basePrompt =
      typeof body.base_prompt === "string" ? body.base_prompt.trim() : "";
    const instruction =
      typeof body.instruction === "string" ? body.instruction : null;

    if (!postId || !basePrompt) {
      return NextResponse.json(
        { error: "Campos obrigatórios: post_id e base_prompt." },
        { status: 400 }
      );
    }

    let post: { id: string; tema: string; status: PostStatus } | null = null;
    if (shouldUseStorageFallback()) {
      const fallbackPost = await getPostFallback(postId);
      if (fallbackPost) {
        post = {
          id: fallbackPost.id,
          tema: fallbackPost.tema,
          status: fallbackPost.status,
        };
      }
    } else {
      const supabase = getSupabase();
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id,tema,status")
        .eq("id", postId)
        .maybeSingle();

      if (postError) {
        if (shouldUseStorageFallback(postError.message)) {
          const fallbackPost = await getPostFallback(postId);
          if (fallbackPost) {
            post = {
              id: fallbackPost.id,
              tema: fallbackPost.tema,
              status: fallbackPost.status,
            };
          }
        } else {
          return NextResponse.json(
            { error: `Erro ao carregar post: ${postError.message}` },
            { status: 500 }
          );
        }
      } else {
        post = postData as { id: string; tema: string; status: PostStatus } | null;
      }
    }

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    if (post.status !== "approved" && post.status !== "published") {
      return NextResponse.json(
        {
          error:
            "A imagem só pode ser gerada para posts aprovados ou publicados.",
        },
        { status: 409 }
      );
    }

    const promptUsed = buildPrompt(
      `${basePrompt}\n\nTema do post: ${post.tema}`,
      instruction
    );
    const generationCount = 3;

    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    const googleModel =
      process.env.GOOGLE_IMAGE_MODEL ?? DEFAULT_GOOGLE_IMAGE_MODEL;
    const openAiApiKey = process.env.OPENAI_API_KEY;
    const openAiModel =
      process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL;

    if (!googleApiKey && !openAiApiKey) {
      return NextResponse.json(
        {
          error:
            "Nenhum provedor de imagem configurado. Defina GOOGLE_AI_API_KEY e/ou OPENAI_API_KEY.",
        },
        { status: 503 }
      );
    }

    let provider: ImageProvider | null = null;
    let variants: ImageVariant[] = [];
    let googleError: string | null = null;

    if (googleApiKey) {
      try {
        variants = await generateWithGoogle({
          prompt: promptUsed,
          count: generationCount,
          apiKey: googleApiKey,
          model: googleModel,
        });
        provider = "google";
      } catch (err) {
        googleError = toErrorMessage(err);
      }
    }

    if (!provider && openAiApiKey) {
      try {
        variants = await generateWithOpenAI({
          prompt: promptUsed,
          count: generationCount,
          apiKey: openAiApiKey,
          model: openAiModel,
        });
        provider = "openai";
      } catch (err) {
        const openAiError = toErrorMessage(err);
        const details = googleError
          ? `Google falhou: ${googleError}. OpenAI falhou: ${openAiError}.`
          : `OpenAI falhou: ${openAiError}.`;
        return NextResponse.json(
          { error: `Erro ao gerar imagem: ${details}` },
          { status: 503 }
        );
      }
    }

    if (!provider) {
      return NextResponse.json(
        {
          error: `Erro ao gerar imagem: ${googleError ?? "nenhum provedor disponível."}`,
        },
        { status: 503 }
      );
    }

    await logPostActivity({
      postId,
      eventType: "image_generated",
      payload: {
        provider,
        variants_count: variants.length,
      },
    });

    const response: GenerateImageResponse = {
      provider,
      prompt_used: promptUsed,
      variants,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = toErrorMessage(err);
    return NextResponse.json(
      { error: `Erro ao gerar imagem: ${message}` },
      { status: 500 }
    );
  }
}
