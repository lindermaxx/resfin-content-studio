import { NextRequest, NextResponse } from "next/server";
import type { Trend } from "@/lib/research-types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const BUILD_TAG = "trends-instagram-only-v1";

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

const INSTAGRAM_HASHTAGS = parseHashtags(
  process.env.RESEARCH_INSTAGRAM_HASHTAGS,
  DEFAULT_INSTAGRAM_HASHTAGS
);
const MAX_HASHTAGS_PER_EXECUTION = 12;
const INSTAGRAM_BATCH_SIZE = 4;
const MAX_BATCHES_PER_EXECUTION = 3;

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

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }

  return out;
}

function resolveRequestedHashtags(payload: unknown): string[] {
  const raw = payload as { hashtags?: unknown };
  const requested = Array.isArray(raw?.hashtags)
    ? raw.hashtags.filter((item): item is string => typeof item === "string")
    : [];

  const normalizedRequested = uniqueStrings(
    requested
      .map((tag) => tag.trim().replace(/^#/, "").replace(/\s+/g, "").toLowerCase())
      .filter(Boolean)
  );

  return normalizedRequested.slice(0, MAX_HASHTAGS_PER_EXECUTION);
}

function splitIntoBatches(values: string[], batchSize: number): string[][] {
  const batches: string[][] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

async function fetchInstagramOptional(
  apifyToken: string,
  hashtags: string[],
  failures?: string[]
): Promise<{ rows: unknown[]; usedHashtagBatches: string[][] }> {
  const batches = splitIntoBatches(hashtags, INSTAGRAM_BATCH_SIZE).slice(
    0,
    MAX_BATCHES_PER_EXECUTION
  );
  const aggregateRows: unknown[] = [];
  const usedHashtagBatches: string[][] = [];

  for (const batch of batches) {
    const rows = await runApifyFallback(
      apifyToken,
      [
        {
          actorId: "apify/instagram-scraper",
          input: {
            directUrls: batch.map(
              (tag) =>
                `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`
            ),
            resultsLimit: 16,
          },
          timeoutSecs: 20,
        },
      ],
      failures
    );

    if (rows.length > 0) {
      aggregateRows.push(...rows);
      usedHashtagBatches.push(batch);
    }

    if (aggregateRows.length >= 20) break;
  }

  return { rows: aggregateRows, usedHashtagBatches };
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

function safeSlice(text: string, max: number): string {
  return text ? text.slice(0, max) : "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hoursSince(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 999;
  const diffMs = Date.now() - parsed;
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

function formatRecencyMetric(hours: number): string {
  if (!Number.isFinite(hours) || hours >= 999) return "";
  if (hours < 1) return "publicado agora";
  if (hours < 24) return `há ${Math.round(hours)}h`;
  return `há ${Math.round(hours / 24)}d`;
}

function computeInstagramTractionScore(params: {
  likes: number;
  comments: number;
  views: number;
  hours: number;
}): number {
  const { likes, comments, views, hours } = params;

  // Base de volume sem custo extra: só usa métricas nativas retornadas pelo actor.
  const volumeBase = likes + comments * 8 + views * 0.04;
  const volumeScore = Math.log1p(volumeBase + 1) * 100;

  // Comentários indicam discussão real; boost limitado para evitar distorção.
  const conversationRate = comments / Math.max(likes, 1);
  const conversationBoost = clamp(1 + conversationRate * 1.5, 1, 1.8);

  // Recência: favorece conteúdo recente sem zerar posts mais antigos.
  const freshnessBoost =
    hours <= 24 ? 1.35 : hours <= 72 ? 1.15 : hours <= 168 ? 1 : 0.85;

  return volumeScore * conversationBoost * freshnessBoost;
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

function mapInstagram(items: unknown[]): Trend[] {
  const ranked = (items as unknown[])
    .map((raw) => {
      const item = asRecord(raw);
      const likes = pickNumber(item, ["likesCount", "likes", "likes_count"]);
      const comments = pickNumber(item, ["commentsCount", "comments", "comments_count"]);
      const views = pickNumber(item, ["videoViewCount", "viewCount", "views", "playCount"]);
      const timestamp = pickString(item, ["timestamp", "takenAt", "createdAt"]);
      const ageHours = hoursSince(timestamp);
      const caption = pickString(item, ["caption", "text", "title", "description"]);
      const owner =
        pickString(item, ["ownerUsername", "username", "owner", "author"]) ||
        pickNestedString(item, "owner", ["username", "name"]) ||
        pickNestedString(item, "authorMeta", ["name", "nickName"]);
      const hashtag = pickString(item, ["hashtag", "tag"]);
      const titulo = safeSlice(caption, 90) || (hashtag ? `#${hashtag}` : `Post de @${owner || "instagram"}`);
      const contexto = caption || "Post com alta interação no Instagram.";
      const weakSignal = views < 120 && likes < 6 && comments < 2;
      const tractionScore = computeInstagramTractionScore({
        likes,
        comments,
        views,
        hours: ageHours,
      });
      const score = weakSignal ? tractionScore * 0.35 : tractionScore;
      const url = pickString(item, ["url", "postUrl", "shortCodeUrl", "inputUrl"]);
      const recencyMetric = formatRecencyMetric(ageHours);

      return {
        trend: {
          titulo,
          plataforma: "Instagram",
          metricas: buildMetricas([
            views > 0 ? `${views.toLocaleString("pt-BR")} views` : "",
            likes > 0 ? `${likes.toLocaleString("pt-BR")} likes` : "",
            comments > 0 ? `${comments.toLocaleString("pt-BR")} comentários` : "",
            recencyMetric,
          ]),
          fonte: owner ? `@${owner}` : "Instagram",
          url,
          contexto,
        } satisfies Trend,
        score,
        weakSignal,
      };
    })
    .filter((entry) => Boolean(entry.trend.url || entry.trend.titulo))
    .sort((a, b) => b.score - a.score);

  const strongFirst = ranked.filter((entry) => !entry.weakSignal);
  const baseList = strongFirst.length >= 6 ? strongFirst : ranked;

  return baseList.map((entry) => entry.trend).slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const debug = req.nextUrl.searchParams.get("debug") === "1";
    const apifyToken = process.env.APIFY_API_TOKEN;
    const socialSourceFailures: string[] = [];
    const requestBody = await req.json().catch(() => ({}));
    const selectedHashtags = resolveRequestedHashtags(requestBody);
    if (selectedHashtags.length === 0) {
      return NextResponse.json(
        {
          error:
            "Selecione ao menos 1 hashtag antes de executar a busca de trends.",
        },
        { status: 400 }
      );
    }
    if (!apifyToken) {
      return NextResponse.json(
        { error: "APIFY_API_TOKEN não configurado no servidor." },
        { status: 500 }
      );
    }

    const instagramResult = await fetchInstagramOptional(
      apifyToken,
      selectedHashtags,
      socialSourceFailures
    );
    const instagram = truncate(instagramResult.rows, 20);

    if (debug) {
      const keySample = (value: unknown[]) =>
        (value as Record<string, unknown>[])
          .slice(0, 2)
          .map((item) => Object.keys(item).slice(0, 20));

      return NextResponse.json({
        build: BUILD_TAG,
        mode: "instagram_hashtags_only",
        monitoredHashtags: INSTAGRAM_HASHTAGS,
        selectedHashtags,
        usedHashtagBatches: instagramResult.usedHashtagBatches,
        disabledSources: ["tiktok", "youtube", "google_trends", "seed_accounts"],
        failures: socialSourceFailures,
        counts: {
          instagram: instagram.length,
        },
        samples: {
          instagramKeys: keySample(instagram),
          instagramFirst: (instagram as Record<string, unknown>[])[0] ?? null,
        },
      });
    }
    if (
      instagram.length === 0 &&
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

    if (instagram.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não foi possível buscar trends do Instagram pelas hashtags selecionadas. Tente novamente.",
        },
        { status: 500 }
      );
    }

    const instagramTrends = mapInstagram(instagram);
    const trends = truncate(mergeUniqueTrends([instagramTrends]), 10);

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
