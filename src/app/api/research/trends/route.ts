import { NextRequest, NextResponse } from "next/server";
import type { Trend } from "@/lib/research-types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const BUILD_TAG = "trends-social-v6";

export type { Trend };

const DEFAULT_INSTAGRAM_HASHTAGS = [
  "financaspessoais",
  "investimentos",
  "educacaofinanceira",
  "planejamentofinanceiro",
  "independenciafinanceira",
  "reservadeemergencia",
  "tesouredireto",
  "fundosimobiliarios",
  "acoes",
  "rendavariavel",
  "rendafixa",
  "dividendos",
  "financas",
  "dinheiro",
  "liberdadefinanceira",
];

const DEFAULT_TIKTOK_HASHTAGS = [
  "financaspessoais",
  "investimentos",
  "educacaofinanceira",
  "planejamentofinanceiro",
  "independenciafinanceira",
  "reservadeemergencia",
  "tesouredireto",
  "fundosimobiliarios",
  "acoes",
  "rendavariavel",
  "rendafixa",
  "dividendos",
  "financas",
  "dinheiro",
  "liberdadefinanceira",
];

const DEFAULT_SEED_ACCOUNTS = [
  "me_poupe",
  "oracoesfinanceiras",
  "gustavo_cerbasi",
  "investindocomcarol",
  "thalitareis",
  "leandro_ramos_",
  "nathfinancas",
  "ricardolino",
  "primo_rico",
];

const DEFAULT_KEYWORDS = [
  "reserva de emergência",
  "carteira de investimentos",
  "renda passiva",
  "aportar",
  "CDB",
  "LCI",
  "LCA",
  "tesouro direto",
  "FII",
  "dividendos",
  "juros compostos",
  "inflação",
  "IPCA",
  "dívida",
  "orçamento",
  "planilha",
  "aposentadoria",
  "PGBL",
  "VGBL",
  "previdência",
];

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function parseHashtags(value: string | undefined, fallback: string[]): string[] {
  return parseList(value, fallback)
    .map((tag) => tag.replace(/^#/, "").replace(/\s+/g, ""))
    .filter(Boolean);
}

function parseSeedAccounts(value: string | undefined, fallback: string[]): string[] {
  return parseList(value, fallback)
    .map((account) => account.replace(/^@/, "").replace(/\s+/g, ""))
    .filter(Boolean);
}

const INSTAGRAM_HASHTAGS = parseHashtags(
  process.env.RESEARCH_INSTAGRAM_HASHTAGS,
  DEFAULT_INSTAGRAM_HASHTAGS
);
const TIKTOK_HASHTAGS = parseHashtags(
  process.env.RESEARCH_TIKTOK_HASHTAGS,
  DEFAULT_TIKTOK_HASHTAGS
);
const SEED_ACCOUNTS = parseSeedAccounts(
  process.env.RESEARCH_SEED_ACCOUNTS,
  DEFAULT_SEED_ACCOUNTS
);
const KEYWORDS = parseList(
  process.env.RESEARCH_KEYWORDS,
  DEFAULT_KEYWORDS
);

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

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId}: ${res.status}${details ? ` - ${details.slice(0, 180)}` : ""}`);
  }
  return res.json();
}

function stripErrorItems(items: unknown[]): unknown[] {
  return (items as Record<string, unknown>[])
    .filter((item) => typeof item === "object" && item !== null)
    .filter((item) => typeof item.error !== "string");
}

async function runApifyFallback(
  token: string,
  candidates: Array<{
    actorId: string;
    input: Record<string, unknown>;
    timeoutSecs?: number;
  }>,
  failures?: string[]
): Promise<unknown[]> {
  for (const candidate of candidates) {
    try {
      const rows = await runApifyActor(
        candidate.actorId,
        candidate.input,
        token,
        candidate.timeoutSecs ?? 8
      );
      const cleaned = stripErrorItems(rows);
      if (cleaned.length > 0) return cleaned;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures?.push(`${candidate.actorId}: ${message}`);
      console.warn(
        "[/api/research/trends] candidate source failed:",
        candidate.actorId,
        err
      );
    }
  }
  return [];
}

// ── Optional social trends via Apify (best-effort) ─────────────────────────
async function fetchYouTubeOptional(
  apifyToken: string,
  failures?: string[]
): Promise<unknown[]> {
  void apifyToken;
  void failures;
  return [];
}

async function fetchTikTokOptional(apifyToken: string, failures?: string[]): Promise<unknown[]> {
  return runApifyFallback(apifyToken, [
    {
      actorId: "clockworks/free-tiktok-scraper",
      input: {
        hashtags: TIKTOK_HASHTAGS,
        resultsPerPage: 18,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadSubtitles: false,
        shouldDownloadVideos: false,
      },
      timeoutSecs: 6,
    },
  ], failures);
}

async function fetchInstagramOptional(apifyToken: string, failures?: string[]): Promise<unknown[]> {
  return runApifyFallback(apifyToken, [
    {
      actorId: "apify/instagram-scraper",
      input: {
        directUrls: INSTAGRAM_HASHTAGS
          .slice(0, 4)
          .map((tag) => `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`),
        resultsLimit: 20,
      },
      timeoutSecs: 10,
    },
    {
      actorId: "apify/instagram-scraper",
      input: {
        usernames: [
          ...SEED_ACCOUNTS,
        ],
        resultsType: "posts",
        resultsLimit: 18,
      },
      timeoutSecs: 10,
    },
  ], failures);
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

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === "object") ? (value as Record<string, unknown>) : {};
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const n = toNumber(obj[key]);
    if (n > 0) return n;
  }
  return 0;
}

function pickNestedString(
  obj: Record<string, unknown>,
  outerKey: string,
  innerKeys: string[]
): string {
  return pickString(asRecord(obj[outerKey]), innerKeys);
}

function pickNestedNumber(
  obj: Record<string, unknown>,
  outerKey: string,
  innerKeys: string[]
): number {
  return pickNumber(asRecord(obj[outerKey]), innerKeys);
}

function safeSlice(text: string, max: number): string {
  return text ? text.slice(0, max) : "";
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
  return (items as unknown[])
    .map((raw) => {
      const item = asRecord(raw);
      const likes = pickNumber(item, ["likesCount", "likes", "likes_count"]);
      const comments = pickNumber(item, ["commentsCount", "comments", "comments_count"]);
      const views = pickNumber(item, ["videoViewCount", "viewCount", "views", "playCount"]);
      const caption = pickString(item, ["caption", "text", "title", "description"]);
      const owner =
        pickString(item, ["ownerUsername", "username", "owner", "author"]) ||
        pickNestedString(item, "owner", ["username", "name"]) ||
        pickNestedString(item, "authorMeta", ["name", "nickName"]);
      const hashtag = pickString(item, ["hashtag", "tag"]);
      const titulo = safeSlice(caption, 90) || (hashtag ? `#${hashtag}` : `Post de @${owner || "instagram"}`);
      const contexto = caption || "Post com alta interação no Instagram.";
      const score = likes + comments * 5 + Math.round(views * 0.05);
      const url = pickString(item, ["url", "postUrl", "shortCodeUrl", "inputUrl"]);

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
          url,
          contexto,
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .filter((trend) => Boolean(trend.url || trend.titulo))
    .slice(0, 8);
}

function mapTikTok(items: unknown[]): Trend[] {
  return (items as unknown[])
    .map((raw) => {
      const item = asRecord(raw);
      const likes = pickNumber(item, ["diggCount", "likesCount", "likes"]);
      const comments = pickNumber(item, ["commentCount", "commentsCount", "comments"]);
      const views =
        pickNumber(item, ["playCount", "videoViewCount", "views", "viewCount"]) ||
        pickNestedNumber(item, "stats", ["playCount", "views"]);
      const text = pickString(item, ["text", "desc", "description", "title"]);
      const author =
        pickString(item, ["author", "username"]) ||
        pickNestedString(item, "authorMeta", ["name", "nickName", "userName"]);
      const titulo = safeSlice(text, 90) || `Vídeo de @${author || "tiktok"}`;
      const contexto = text || "Vídeo com alta tração no TikTok.";
      const score = likes + comments * 5 + Math.round(views * 0.02);
      const url =
        pickString(item, ["webVideoUrl", "url", "videoUrl", "shareUrl"]) ||
        pickNestedString(item, "webVideo", ["url"]);

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
          url,
          contexto,
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .filter((trend) => Boolean(trend.url || trend.titulo))
    .slice(0, 8);
}

function mapYouTube(items: unknown[]): Trend[] {
  return (items as unknown[])
    .map((raw) => {
      const item = asRecord(raw);
      const views = pickNumber(item, ["viewCount", "views", "view_count"]);
      const likes = pickNumber(item, ["likeCount", "likes", "likes_count"]);
      const title = pickString(item, ["title", "name"]);
      const channel = pickString(item, ["channelName", "channel", "author"]);
      const description = pickString(item, ["description", "shortDescription"]);
      const score = views + likes * 10;
      const url = pickString(item, ["url", "videoUrl"]);

      return {
        trend: {
          titulo: title || "Vídeo em alta no YouTube",
          plataforma: "YouTube",
          metricas: buildMetricas([
            views > 0 ? `${views.toLocaleString("pt-BR")} views` : "",
            likes > 0 ? `${likes.toLocaleString("pt-BR")} likes` : "",
          ]),
          fonte: channel || "YouTube",
          url,
          contexto: safeSlice(description, 280) || "Vídeo com alta atenção no YouTube.",
        } satisfies Trend,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.trend)
    .filter((trend) => Boolean(trend.url || trend.titulo))
    .slice(0, 6);
}

export async function POST(req: NextRequest) {
  try {
    const debug = req.nextUrl.searchParams.get("debug") === "1";
    const apifyToken = process.env.APIFY_API_TOKEN;
    const socialSourceFailures: string[] = [];

    // Run all sources in parallel with hard limits
    const [trendsResult, youtubeResult, tiktokResult, instagramResult] = await Promise.allSettled([
      fetchGoogleTrendsRSS(),
      apifyToken
        ? fetchYouTubeOptional(apifyToken, socialSourceFailures)
        : Promise.resolve([]),
      apifyToken
        ? fetchTikTokOptional(apifyToken, socialSourceFailures)
        : Promise.resolve([]),
      apifyToken
        ? fetchInstagramOptional(apifyToken, socialSourceFailures)
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
        build: BUILD_TAG,
        monitoredHashtags: {
          instagram: INSTAGRAM_HASHTAGS,
          tiktok: TIKTOK_HASHTAGS,
        },
        monitoredSeeds: SEED_ACCOUNTS,
        monitoredKeywords: KEYWORDS,
        failures: socialSourceFailures,
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

    if (
      apifyToken &&
      instagram.length === 0 &&
      tiktok.length === 0 &&
      socialSourceFailures.some(
        (failure) =>
          failure.includes(": 402") ||
          failure.includes(": 403") ||
          failure.includes("platform-feature-disabled")
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Limite mensal da Apify excedido para coleta social (Instagram/TikTok). Atualize o plano/limite para habilitar trends sociais.",
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "x-resfin-build": BUILD_TAG,
          },
        }
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

    return NextResponse.json(trends, {
      headers: {
        "Cache-Control": "no-store",
        "x-resfin-build": BUILD_TAG,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/research/trends]", message);
    return NextResponse.json(
      { error: `Erro ao buscar trends: ${message}` },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-resfin-build": BUILD_TAG,
        },
      }
    );
  }
}
