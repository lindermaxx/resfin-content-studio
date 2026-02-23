import { NextRequest, NextResponse } from "next/server";
import type { Trend } from "@/lib/research-types";

export const maxDuration = 60;

export type { Trend };

// ── Google Trends RSS (Brasil) — instant, no Apify ─────────────────────────
interface GoogleTrendItem {
  titulo: string;
  url: string;
  traffic: string;
  newsTitle: string;
  newsSnippet: string;
  newsUrl: string;
}

function extractCDATA(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i");
  return (cdataRe.exec(xml) || plainRe.exec(xml))?.[1]?.trim() ?? "";
}

async function fetchGoogleTrendsRSS(): Promise<GoogleTrendItem[]> {
  const res = await fetch("https://trends.google.com/trending/rss?geo=BR", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Google Trends RSS: ${res.status}`);
  const xml = await res.text();

  const items: GoogleTrendItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1];
    const titulo = extractCDATA(chunk, "title");
    const url = extractCDATA(chunk, "link") || (/<link\s*\/?>(.*?)<\/link>/i.exec(chunk)?.[1] ?? "");
    const traffic = extractCDATA(chunk, "ht:approx_traffic");
    const newsTitle = extractCDATA(chunk, "ht:news_item_title");
    const newsSnippet = extractCDATA(chunk, "ht:news_item_snippet");
    const newsUrl = extractCDATA(chunk, "ht:news_item_url");

    if (titulo) items.push({ titulo, url, traffic, newsTitle, newsSnippet, newsUrl });
  }

  return items;
}

function truncate<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs = 8
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

  if (!res.ok) throw new Error(`Apify ${actorId}: ${res.status}`);
  return res.json();
}

// ── Optional social trends via Apify (best-effort) ─────────────────────────
async function fetchYouTubeOptional(
  apifyToken: string
): Promise<unknown[]> {
  return runApifyActor(
    "apify/youtube-scraper",
    {
      searchQueries: [
        "finanças pessoais brasil",
        "médicos investimentos",
        "economia brasil semana",
      ],
      maxResults: 6,
      proxyConfiguration: { useApifyProxy: true },
    },
    apifyToken,
    8
  );
}

async function fetchTikTokOptional(apifyToken: string): Promise<unknown[]> {
  return runApifyActor(
    "clockworks/free-tiktok-scraper",
    {
      hashtags: [
        "financas",
        "investimentos",
        "medicina",
        "economia",
        "dinheiro",
      ],
      resultsPerPage: 12,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
    },
    apifyToken,
    8
  );
}

async function fetchInstagramOptional(apifyToken: string): Promise<unknown[]> {
  return runApifyActor(
    "apify/instagram-scraper",
    {
      usernames: [
        "nataliaribeiro",
        "mepoupena",
        "primonico",
        "g4_educacao",
        "residenciaemfinancas",
        "medwayresidencia",
        "medcof",
      ],
      resultsType: "posts",
      resultsLimit: 18,
    },
    apifyToken,
    8
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const clean = value.replace(/[^\d.-]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function buildMetricas(values: string[]): string[] {
  return values.map((v) => v.trim()).filter(Boolean).slice(0, 3);
}

function mergeUniqueTrends(lists: Trend[][]): Trend[] {
  const seen = new Set<string>();
  const out: Trend[] = [];

  for (const list of lists) {
    for (const trend of list) {
      const key = `${trend.plataforma}|${trend.url || trend.titulo}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trend);
    }
  }
  return out;
}

function mapGoogleTrends(items: GoogleTrendItem[]): Trend[] {
  return items.map((item) => ({
    titulo: item.titulo,
    plataforma: "Google Trends",
    metricas: buildMetricas([
      item.traffic ? `${item.traffic} buscas` : "",
    ]),
    fonte: item.newsTitle || "Google Trends Brasil",
    url: item.newsUrl || item.url || "",
    contexto: item.newsSnippet || "Tema em alta nas buscas do Google Brasil.",
  }));
}

function mapInstagram(items: unknown[]): Trend[] {
  return (items as Record<string, unknown>[])
    .map((item) => {
      const likes = toNumber(item.likesCount);
      const comments = toNumber(item.commentsCount);
      const views = toNumber(item.videoViewCount);
      const caption = ((item.caption as string) || "").trim();
      const owner = ((item.ownerUsername as string) || "").trim();
      const titulo = caption.slice(0, 90) || `Post de @${owner || "instagram"}`;
      const contexto = caption || "Post com alta interação no Instagram.";
      const score = likes + comments * 5 + Math.round(views * 0.05);

      return {
        trend: {
          titulo,
          plataforma: "Instagram",
          metricas: buildMetricas([
            likes > 0 ? `${likes.toLocaleString("pt-BR")} likes` : "",
            comments > 0 ? `${comments.toLocaleString("pt-BR")} comentários` : "",
            views > 0 ? `${views.toLocaleString("pt-BR")} views` : "",
          ]),
          fonte: owner ? `@${owner}` : "Instagram",
          url: (item.url as string) || "",
          contexto,
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .slice(0, 8);
}

function mapTikTok(items: unknown[]): Trend[] {
  return (items as Record<string, unknown>[])
    .map((item) => {
      const likes = toNumber(item.diggCount);
      const comments = toNumber(item.commentCount);
      const views = toNumber(item.playCount);
      const text = ((item.text as string) || "").trim();
      const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
      const author =
        ((authorMeta?.name as string) || (authorMeta?.nickName as string) || "").trim();
      const titulo = text.slice(0, 90) || `Vídeo de @${author || "tiktok"}`;
      const contexto = text || "Vídeo com alta tração no TikTok.";
      const score = likes + comments * 5 + Math.round(views * 0.02);

      return {
        trend: {
          titulo,
          plataforma: "TikTok",
          metricas: buildMetricas([
            views > 0 ? `${views.toLocaleString("pt-BR")} views` : "",
            likes > 0 ? `${likes.toLocaleString("pt-BR")} likes` : "",
            comments > 0 ? `${comments.toLocaleString("pt-BR")} comentários` : "",
          ]),
          fonte: author ? `@${author}` : "TikTok",
          url: ((item.webVideoUrl as string) || (item.videoUrl as string) || "").trim(),
          contexto,
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .slice(0, 8);
}

function mapYouTube(items: unknown[]): Trend[] {
  return (items as Record<string, unknown>[])
    .map((item) => {
      const views = toNumber(item.viewCount);
      const likes = toNumber(item.likeCount);
      const title = ((item.title as string) || "").trim();
      const channel = ((item.channelName as string) || "").trim();
      const description = ((item.description as string) || "").trim();
      const score = views + likes * 10;

      return {
        trend: {
          titulo: title || "Vídeo em alta no YouTube",
          plataforma: "YouTube",
          metricas: buildMetricas([
            views > 0 ? `${views.toLocaleString("pt-BR")} views` : "",
            likes > 0 ? `${likes.toLocaleString("pt-BR")} likes` : "",
          ]),
          fonte: channel || "YouTube",
          url: ((item.url as string) || "").trim(),
          contexto: description.slice(0, 280) || "Vídeo com alta atenção no YouTube.",
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .slice(0, 6);
}

export async function POST(req: NextRequest) {
  try {
    const debug = req.nextUrl.searchParams.get("debug") === "1";
    const apifyToken = process.env.APIFY_API_TOKEN;

    // Run all sources in parallel with hard limits
    const [trendsResult, youtubeResult, tiktokResult, instagramResult] = await Promise.allSettled([
      fetchGoogleTrendsRSS(),
      apifyToken
        ? fetchYouTubeOptional(apifyToken)
        : Promise.resolve([]),
      apifyToken
        ? fetchTikTokOptional(apifyToken)
        : Promise.resolve([]),
      apifyToken
        ? fetchInstagramOptional(apifyToken)
        : Promise.resolve([]),
    ]);

    const googleTrends =
      trendsResult.status === "fulfilled" ? trendsResult.value : [];
    const youtube =
      youtubeResult.status === "fulfilled"
        ? truncate(youtubeResult.value as unknown[], 6)
        : [];
    const tiktok =
      tiktokResult.status === "fulfilled"
        ? truncate(tiktokResult.value as unknown[], 12)
        : [];
    const instagram =
      instagramResult.status === "fulfilled"
        ? truncate(instagramResult.value as unknown[], 12)
        : [];

    if (debug) {
      const keySample = (value: unknown[]) =>
        (value as Record<string, unknown>[])
          .slice(0, 2)
          .map((item) => Object.keys(item).slice(0, 20));

      return NextResponse.json({
        counts: {
          instagram: instagram.length,
          tiktok: tiktok.length,
          youtube: youtube.length,
          google: googleTrends.length,
        },
        samples: {
          instagramKeys: keySample(instagram),
          tiktokKeys: keySample(tiktok),
          youtubeKeys: keySample(youtube),
          instagramFirst: (instagram as Record<string, unknown>[])[0] ?? null,
          tiktokFirst: (tiktok as Record<string, unknown>[])[0] ?? null,
          youtubeFirst: (youtube as Record<string, unknown>[])[0] ?? null,
        },
      });
    }

    if (trendsResult.status === "rejected") {
      console.warn("[/api/research/trends] Google source failed:", trendsResult.reason);
    }
    if (youtubeResult.status === "rejected") {
      console.warn("[/api/research/trends] YouTube source failed:", youtubeResult.reason);
    }
    if (tiktokResult.status === "rejected") {
      console.warn("[/api/research/trends] TikTok source failed:", tiktokResult.reason);
    }
    if (instagramResult.status === "rejected") {
      console.warn("[/api/research/trends] Instagram source failed:", instagramResult.reason);
    }

    console.log(
      `[/api/research/trends] Instagram: ${instagram.length}, TikTok: ${tiktok.length}, YouTube: ${youtube.length}, Google: ${googleTrends.length}`
    );

    if (
      googleTrends.length === 0 &&
      youtube.length === 0 &&
      tiktok.length === 0 &&
      instagram.length === 0
    ) {
      return NextResponse.json(
        { error: "Não foi possível buscar dados de tendências. Tente novamente." },
        { status: 500 }
      );
    }

    const instagramTrends = mapInstagram(instagram);
    const tiktokTrends = mapTikTok(tiktok);
    const youtubeTrends = mapYouTube(youtube);
    const googleTrendsMapped = mapGoogleTrends(truncate(googleTrends, 8));

    const socialTrends = mergeUniqueTrends([instagramTrends, tiktokTrends]);
    const nonSocialTrends = mergeUniqueTrends([youtubeTrends, googleTrendsMapped]);

    const trends = socialTrends.length > 0
      ? mergeUniqueTrends([truncate(socialTrends, 8), nonSocialTrends, socialTrends.slice(8)]).slice(0, 10)
      : truncate(nonSocialTrends, 10);

    return NextResponse.json(trends);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/research/trends]", message);
    return NextResponse.json(
      { error: `Erro ao buscar trends: ${message}` },
      { status: 500 }
    );
  }
}
