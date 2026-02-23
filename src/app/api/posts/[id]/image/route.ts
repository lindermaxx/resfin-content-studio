import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  logPostActivity,
  shouldUseStorageFallback,
  toMetricasArray,
  updatePostFallback,
} from "@/lib/posts-service";
import type { SelectPostImageRequest } from "@/lib/post-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  return id?.trim() ?? "";
}

function isValidImageProvider(value: unknown): value is "google" | "openai" {
  return value === "google" || value === "openai";
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) {
      return NextResponse.json(
        { error: "ID do post inválido." },
        { status: 400 }
      );
    }

    const rawBody = (await req.json()) as unknown;
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: "Payload inválido para seleção de imagem." },
        { status: 400 }
      );
    }

    const body = rawBody as SelectPostImageRequest;
    const imagemUrl =
      typeof body.imagem_url === "string" ? body.imagem_url.trim() : "";
    const imagemPrompt =
      typeof body.imagem_prompt === "string" ? body.imagem_prompt.trim() : "";

    if (!imagemUrl || !isValidImageProvider(body.imagem_provider) || !imagemPrompt) {
      return NextResponse.json(
        {
          error:
            "Campos obrigatórios inválidos: imagem_url, imagem_provider e imagem_prompt.",
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      imagem_url: imagemUrl,
      imagem_provider: body.imagem_provider,
      imagem_prompt: imagemPrompt,
    };

    let updatedPost: Record<string, unknown> | null = null;
    if (shouldUseStorageFallback()) {
      updatedPost = (await updatePostFallback(
        id,
        updatePayload as unknown as Record<string, unknown>
      )) as unknown as Record<string, unknown> | null;
    } else {
      const supabase = getSupabase();
      const { data: dbUpdatedPost, error } = await supabase
        .from("posts")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) {
        if (shouldUseStorageFallback(error.message)) {
          updatedPost = (await updatePostFallback(
            id,
            updatePayload as unknown as Record<string, unknown>
          )) as unknown as Record<string, unknown> | null;
        } else {
          return NextResponse.json(
            { error: `Erro ao salvar imagem no post: ${error.message}` },
            { status: 500 }
          );
        }
      } else {
        updatedPost = dbUpdatedPost as Record<string, unknown> | null;
      }
    }

    if (!updatedPost) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    await logPostActivity({
      postId: id,
      eventType: "image_selected",
      payload: {
        imagem_provider: body.imagem_provider,
      },
    });

    return NextResponse.json({
      ...updatedPost,
      metricas: toMetricasArray(updatedPost.metricas),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao salvar imagem no post: ${message}` },
      { status: 500 }
    );
  }
}
