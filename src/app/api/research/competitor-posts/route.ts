import { NextRequest, NextResponse } from "next/server";
import type { CompetitorPost } from "@/lib/research-types";

export const maxDuration = 60;

export type { CompetitorPost };

async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs = 25
): Promise<unknown[]> {
  const actorRef = actorId.replace(/\//g, "~");
  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSecs),
    memory: "256",
  });
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorRef}/run-sync-get-dataset-items?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 5) * 1000),
    }
  );
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    if (res.status === 402 || res.status === 403) {
      throw new Error(
        "Limite/Plano da Apify excedido para coletar posts de perfis monitorados."
      );
    }
    throw new Error(`Apify ${actorId}: ${res.status}${details ? ` - ${details.slice(0, 180)}` : ""}`);
  }
  return res.json();
}

function computeEngagement(
  likes: number,
  comments: number,
  views: number
): number {
  // Comments weight 5x (high intent signal), views weight 0.05x
  return likes + comments * 5 + Math.round(views * 0.05);
}

function detectTipo(post: Record<string, unknown>): CompetitorPost["tipo"] {
  const type = (post.type as string) || "";
  if (type === "Video" || post.isVideo) return "reels";
  if (type === "Sidecar" || ((post.childPosts as unknown[] | undefined)?.length ?? 0) > 1) return "carrossel";
  return "post";
}

export async function POST(req: NextRequest) {
  try {
    const { handles } = await req.json() as { handles: string[] };

    if (!handles?.length) {
      return NextResponse.json(
        { error: "Nenhum perfil fornecido." },
        { status: 400 }
      );
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json(
        { error: "APIFY_API_TOKEN não configurado." },
        { status: 500 }
      );
    }

    // Fetch recent posts for all profiles — Instagram scraper supports array of usernames
    const items = await runActor(
      "apify/instagram-scraper",
      {
        usernames: handles,
        resultsLimit: 12, // últimos 12 posts por perfil
        resultsType: "posts",
      },
      apifyToken,
      50
    );

    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    const posts: CompetitorPost[] = (items as Record<string, unknown>[])
      .filter((item) => {
        const ts = new Date((item.timestamp as string) || 0).getTime();
        return ts >= tenDaysAgo;
      })
      .map((item) => {
        const likes = (item.likesCount as number) || 0;
        const comments = (item.commentsCount as number) || 0;
        const views = (item.videoViewCount as number) || 0;
        return {
          url: (item.url as string) || "",
          username: (item.ownerUsername as string) || "",
          caption: ((item.caption as string) || "").slice(0, 200),
          tipo: detectTipo(item),
          likesCount: likes,
          commentsCount: comments,
          videoViewCount: views,
          timestamp: (item.timestamp as string) || "",
          thumbnailUrl:
            (item.displayUrl as string) ||
            (item.thumbnailUrl as string) ||
            "",
          engagementScore: computeEngagement(likes, comments, views),
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 20); // top 20 posts

    return NextResponse.json(posts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/research/competitor-posts]", message);
    return NextResponse.json(
      { error: `Erro ao buscar posts: ${message}` },
      { status: 500 }
    );
  }
}
