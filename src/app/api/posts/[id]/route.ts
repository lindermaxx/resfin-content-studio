import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  getPostFallback,
  logPostActivity,
  shouldUseStorageFallback,
  toMetricasArray,
  updatePostFallback,
} from "@/lib/posts-service";
import type { UpdatePostRequest } from "@/lib/post-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PostUpdatePayload = {
  copy_text?: string;
  visual_descricao?: string;
  cta?: string;
  notes?: string | null;
};

async function resolveId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  return id?.trim() ?? "";
}

function buildUpdatePayload(body: UpdatePostRequest): {
  payload: PostUpdatePayload;
  updatedFields: string[];
  validationError: string | null;
} {
  const payload: PostUpdatePayload = {};
  const updatedFields: string[] = [];

  if (typeof body.copy_text === "string") {
    const value = body.copy_text.trim();
    if (!value) {
      return {
        payload: {},
        updatedFields: [],
        validationError: "O campo copy_text não pode ser vazio.",
      };
    }
    payload.copy_text = value;
    updatedFields.push("copy_text");
  } else if (body.copy_text !== undefined) {
    return {
      payload: {},
      updatedFields: [],
      validationError: "O campo copy_text precisa ser texto.",
    };
  }

  if (typeof body.visual_descricao === "string") {
    payload.visual_descricao = body.visual_descricao.trim();
    updatedFields.push("visual_descricao");
  } else if (body.visual_descricao !== undefined) {
    return {
      payload: {},
      updatedFields: [],
      validationError: "O campo visual_descricao precisa ser texto.",
    };
  }

  if (typeof body.cta === "string") {
    payload.cta = body.cta.trim();
    updatedFields.push("cta");
  } else if (body.cta !== undefined) {
    return {
      payload: {},
      updatedFields: [],
      validationError: "O campo cta precisa ser texto.",
    };
  }

  if (body.notes === null) {
    payload.notes = null;
    updatedFields.push("notes");
  } else if (typeof body.notes === "string") {
    payload.notes = body.notes.trim() || null;
    updatedFields.push("notes");
  } else if (body.notes !== undefined) {
    return {
      payload: {},
      updatedFields: [],
      validationError: "O campo notes precisa ser texto ou null.",
    };
  }

  if (updatedFields.length === 0) {
    return {
      payload: {},
      updatedFields: [],
      validationError:
        "Nenhum campo editável enviado. Use copy_text, visual_descricao, cta ou notes.",
    };
  }

  return { payload, updatedFields, validationError: null };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) {
      return NextResponse.json(
        { error: "ID do post inválido." },
        { status: 400 }
      );
    }
    if (shouldUseStorageFallback()) {
      const fallbackPost = await getPostFallback(id);
      if (!fallbackPost) {
        return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
      }
      return NextResponse.json(fallbackPost);
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (shouldUseStorageFallback(error.message)) {
        const fallbackPost = await getPostFallback(id);
        if (!fallbackPost) {
          return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
        }
        return NextResponse.json(fallbackPost);
      }

      return NextResponse.json(
        { error: `Erro ao buscar post: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ...data, metricas: toMetricasArray(data.metricas) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao buscar post: ${message}` },
      { status: 500 }
    );
  }
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
        { error: "Payload inválido para atualização do post." },
        { status: 400 }
      );
    }

    const body = rawBody as UpdatePostRequest;
    const { payload, updatedFields, validationError } = buildUpdatePayload(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (shouldUseStorageFallback()) {
      const updatedPost = await updatePostFallback(
        id,
        payload as unknown as Record<string, unknown>
      );

      if (!updatedPost) {
        return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
      }

      await logPostActivity({
        postId: id,
        eventType: "edited",
        payload: { updated_fields: updatedFields },
      });

      return NextResponse.json(updatedPost);
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("posts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (shouldUseStorageFallback(error.message)) {
        const updatedPost = await updatePostFallback(
          id,
          payload as unknown as Record<string, unknown>
        );

        if (!updatedPost) {
          return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
        }

        await logPostActivity({
          postId: id,
          eventType: "edited",
          payload: { updated_fields: updatedFields },
        });

        return NextResponse.json(updatedPost);
      }

      return NextResponse.json(
        { error: `Erro ao atualizar post: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    await logPostActivity({
      postId: id,
      eventType: "edited",
      payload: { updated_fields: updatedFields },
    });

    return NextResponse.json({ ...data, metricas: toMetricasArray(data.metricas) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao atualizar post: ${message}` },
      { status: 500 }
    );
  }
}
