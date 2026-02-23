import { supabase } from "@/lib/supabase";
import type { PostActivityEventType, PostStatus } from "@/lib/post-types";

const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  pending: ["approved"],
  approved: ["pending", "published"],
  published: [],
};

export function canTransitionStatus(
  from: PostStatus,
  to: PostStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function toPostStatus(value: unknown): PostStatus | null {
  if (value === "pending" || value === "approved" || value === "published") {
    return value;
  }
  return null;
}

export async function logPostActivity(params: {
  postId: string;
  eventType: PostActivityEventType;
  fromStatus?: PostStatus | null;
  toStatus?: PostStatus | null;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("post_activity_log").insert({
    post_id: params.postId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    actor: params.actor ?? "system",
    payload: params.payload ?? {},
  });

  if (error) {
    throw new Error(`Erro ao registrar atividade: ${error.message}`);
  }
}

export function toMetricasArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
