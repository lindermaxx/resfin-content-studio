import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  return id?.trim() ?? "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = getSupabase();
    const id = await resolveId(context);
    if (!id) {
      return NextResponse.json(
        { error: "ID do post inválido." },
        { status: 400 }
      );
    }

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (postError) {
      return NextResponse.json(
        { error: `Erro ao buscar atividade: ${postError.message}` },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("post_activity_log")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Erro ao buscar atividade: ${error.message}` },
        { status: 500 }
      );
    }

    const items = Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : [];

    return NextResponse.json(
      items.map((item) => ({
        ...item,
        payload:
          item.payload && typeof item.payload === "object"
            ? (item.payload as Record<string, unknown>)
            : {},
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao buscar atividade: ${message}` },
      { status: 500 }
    );
  }
}
