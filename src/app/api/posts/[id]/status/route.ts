import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  canTransitionStatus,
  getPostFallback,
  logPostActivity,
  shouldUseStorageFallback,
  toMetricasArray,
  toPostStatus,
  updatePostFallback,
} from "@/lib/posts-service";
import type { PostStatus, UpdatePostStatusRequest } from "@/lib/post-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  return id?.trim() ?? "";
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
        { error: "Payload inválido para atualização de status." },
        { status: 400 }
      );
    }

    const body = rawBody as UpdatePostStatusRequest;
    const nextStatus = toPostStatus(body.status);
    if (!nextStatus) {
      return NextResponse.json(
        { error: "Status inválido. Use pending, approved ou published." },
        { status: 400 }
      );
    }

    const useFallbackNow = shouldUseStorageFallback();
    const supabase = useFallbackNow ? null : getSupabase();

    let currentPost: Record<string, unknown> | null = null;
    if (useFallbackNow) {
      currentPost = (await getPostFallback(id)) as unknown as Record<string, unknown> | null;
    } else {
      const { data: currentPostData, error: currentError } = await supabase!
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (currentError) {
        if (shouldUseStorageFallback(currentError.message)) {
          currentPost = (await getPostFallback(id)) as unknown as
            | Record<string, unknown>
            | null;
        } else {
          return NextResponse.json(
            { error: `Erro ao atualizar status: ${currentError.message}` },
            { status: 500 }
          );
        }
      } else {
        currentPost = currentPostData as Record<string, unknown> | null;
      }
    }

    if (!currentPost) {
      return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
    }

    const currentStatus = toPostStatus(currentPost.status);
    const currentApprovedAt =
      typeof currentPost.approved_at === "string" ? currentPost.approved_at : null;
    if (!currentStatus) {
      return NextResponse.json(
        { error: "Status atual inválido no banco de dados." },
        { status: 500 }
      );
    }

    if (currentStatus === nextStatus) {
      return NextResponse.json({
        ...currentPost,
        metricas: toMetricasArray(currentPost.metricas),
      });
    }

    if (!canTransitionStatus(currentStatus, nextStatus)) {
      return NextResponse.json(
        {
          error: `Transição de status inválida: ${currentStatus} -> ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatePayload: {
      status: PostStatus;
      status_updated_at: string;
      approved_at?: string | null;
      published_at?: string | null;
    } = {
      status: nextStatus,
      status_updated_at: nowIso,
    };

    if (nextStatus === "pending") {
      updatePayload.approved_at = null;
      updatePayload.published_at = null;
    }
    if (nextStatus === "approved") {
      updatePayload.approved_at = currentApprovedAt ?? nowIso;
      updatePayload.published_at = null;
    }
    if (nextStatus === "published") {
      updatePayload.approved_at = currentApprovedAt ?? nowIso;
      updatePayload.published_at = nowIso;
    }

    let updatedPost: Record<string, unknown> | null = null;
    if (shouldUseStorageFallback()) {
      updatedPost = (await updatePostFallback(
        id,
        updatePayload as unknown as Record<string, unknown>
      )) as unknown as Record<string, unknown> | null;
    } else {
      const { data: dbUpdatedPost, error: updateError } = await supabase!
        .from("posts")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        if (shouldUseStorageFallback(updateError.message)) {
          updatedPost = (await updatePostFallback(
            id,
            updatePayload as unknown as Record<string, unknown>
          )) as unknown as Record<string, unknown> | null;
        } else {
          return NextResponse.json(
            { error: `Erro ao atualizar status: ${updateError.message}` },
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
      eventType: "status_changed",
      fromStatus: currentStatus,
      toStatus: nextStatus,
      payload: {
        from: currentStatus,
        to: nextStatus,
      },
    });

    return NextResponse.json({
      ...updatedPost,
      metricas: toMetricasArray(updatedPost.metricas),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao atualizar status: ${message}` },
      { status: 500 }
    );
  }
}
