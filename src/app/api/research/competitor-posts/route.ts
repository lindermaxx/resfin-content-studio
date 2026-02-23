import { NextRequest, NextResponse } from "next/server";
import type { CompetitorPost } from "@/lib/research-types";

export const maxDuration = 60;

export type { CompetitorPost };

const RECENT_DAYS_WINDOW = 10;
const FALLBACK_DAYS_WINDOW = 30;

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

function flattenInstagramItems(items: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const raw of items as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;

    const latestPosts = raw.latestPosts as Record<string, unknown>[] | undefined;
    if (Array.isArray(latestPosts) && latestPosts.length > 0) {
      const parentUsername = (raw.username as string) || (raw.ownerUsername as string) || "";
      for (const post of latestPosts) {
        out.push({
          ...post,
          ownerUsername:
            (post.ownerUsername as string) ||
            (post.username as string) ||
            parentUsername,
        });
      }
      continue;
    }

    out.push(raw);
  }

  return out;
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

    // Primary strategy: usernames
    let items = await runActor(
      "apify/instagram-scraper",
      {
        usernames: handles.map((h) => h.replace(/^@/, "")),
        resultsLimit: 12, // últimos 12 posts por perfil
        resultsType: "posts",
      },
      apifyToken,
      50
    );

    // Fallback strategy: direct profile URLs when usernames returns empty
    if (!Array.isArray(items) || items.length === 0) {
      items = await runActor(
        "apify/instagram-scraper",
        {
          directUrls: handles.map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`),
          resultsLimit: 20,
        },
        apifyToken,
        50
      );
    }

    const normalizedItems = flattenInstagramItems(items);

    const mapPost = (item: Record<string, unknown>): CompetitorPost => {
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
      };

    const allPosts = normalizedItems
      .map(mapPost)
      .filter((post) => Boolean(post.url && post.username));

    const tenDaysAgo = Date.now() - RECENT_DAYS_WINDOW * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - FALLBACK_DAYS_WINDOW * 24 * 60 * 60 * 1000;

    const recentPosts = allPosts.filter((post) => {
      const ts = new Date(post.timestamp || 0).getTime();
      return Number.isFinite(ts) && ts >= tenDaysAgo;
    });

    const fallbackPosts = allPosts.filter((post) => {
      const ts = new Date(post.timestamp || 0).getTime();
      return Number.isFinite(ts) && ts >= thirtyDaysAgo;
    });

    const source = recentPosts.length > 0 ? recentPosts : fallbackPosts;

    const posts: CompetitorPost[] = source
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 20); // top 20 posts

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum post público encontrado para os perfis informados (últimos 30 dias). Verifique se os handles estão corretos, públicos e ativos.",
        },
        { status: 404 }
      );
    }

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
