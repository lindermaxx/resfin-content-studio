import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logPostActivity, toMetricasArray, toPostStatus } from "@/lib/posts-service";
import type { CreatePostRequest } from "@/lib/post-types";

export async function GET(req: NextRequest) {
  try {
    const status = toPostStatus(req.nextUrl.searchParams.get("status"));

    let query = supabase
      .from("posts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: `Erro ao buscar posts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      (data ?? []).map((item) => ({
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

    const { data, error } = await supabase
      .from("posts")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: `Erro ao criar post: ${error?.message ?? "registro não criado"}` },
        { status: 500 }
      );
    }

    await logPostActivity({
      postId: data.id,
      eventType: "created",
      toStatus: "pending",
      payload: { tema: data.tema, formato: data.formato, voz: data.voz },
    });

    return NextResponse.json(
      { ...data, metricas: toMetricasArray(data.metricas) },
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
