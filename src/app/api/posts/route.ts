import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  createPostFallback,
  listPostsFallback,
  logPostActivity,
  shouldUseStorageFallback,
  toMetricasArray,
  toPostStatus,
} from "@/lib/posts-service";
import type { CreatePostRequest } from "@/lib/post-types";

export async function GET(req: NextRequest) {
  try {
    const status = toPostStatus(req.nextUrl.searchParams.get("status"));
    if (shouldUseStorageFallback()) {
      const fallbackPosts = await listPostsFallback(status);
      return NextResponse.json(fallbackPosts);
    }

    const supabase = getSupabase();

    let query = supabase
      .from("posts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      if (shouldUseStorageFallback(error.message)) {
        const fallbackPosts = await listPostsFallback(status);
        return NextResponse.json(fallbackPosts);
      }

      return NextResponse.json(
        { error: `Erro ao buscar posts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      (data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        metricas: toMetricasArray(item.metricas),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao buscar posts: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePostRequest;

    if (!body.tema?.trim() || !body.formato || !body.voz || !body.copy_text?.trim()) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes para criação do post." },
        { status: 400 }
      );
    }

    const payload = {
      tema: body.tema.trim(),
      pilar: body.pilar,
      source: body.source,
      source_url: body.source_url,
      hook: body.hook,
      rascunho: body.rascunho ?? "",
      formato: body.formato,
      voz: body.voz,
      copy_text: body.copy_text.trim(),
      visual_descricao: body.visual_descricao ?? "",
      cta: body.cta ?? "",
      keyword_manychat: body.keyword_manychat,
      contexto_viral: body.contexto_viral,
      plataforma_origem: body.plataforma_origem,
      metricas: body.metricas ?? [],
      status: "pending" as const,
      status_updated_at: new Date().toISOString(),
    };
    if (shouldUseStorageFallback()) {
      const createdPost = await createPostFallback(
        payload as unknown as Record<string, unknown>
      );

      await logPostActivity({
        postId: createdPost.id,
        eventType: "created",
        toStatus: "pending",
        payload: {
          tema: createdPost.tema,
          formato: createdPost.formato,
          voz: createdPost.voz,
        },
      });

      return NextResponse.json(createdPost, { status: 201 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("posts")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (shouldUseStorageFallback(error.message)) {
        const createdPost = await createPostFallback(
          payload as unknown as Record<string, unknown>
        );

        await logPostActivity({
          postId: createdPost.id,
          eventType: "created",
          toStatus: "pending",
          payload: {
            tema: createdPost.tema,
            formato: createdPost.formato,
            voz: createdPost.voz,
          },
        });

        return NextResponse.json(createdPost, { status: 201 });
      }

      return NextResponse.json(
        { error: `Erro ao criar post: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Erro ao criar post: registro não criado." },
        { status: 500 }
      );
    }
    const createdPost = data as Record<string, unknown>;
    const createdId =
      typeof createdPost.id === "string" ? createdPost.id : null;

    if (!createdId) {
      return NextResponse.json(
        { error: "Erro ao criar post: ID inválido retornado pelo banco." },
        { status: 500 }
      );
    }

    await logPostActivity({
      postId: createdId,
      eventType: "created",
      toStatus: "pending",
      payload: {
        tema: createdPost.tema,
        formato: createdPost.formato,
        voz: createdPost.voz,
      },
    });

    return NextResponse.json(
      { ...createdPost, metricas: toMetricasArray(createdPost.metricas) },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao criar post: ${message}` },
      { status: 500 }
    );
  }
}
