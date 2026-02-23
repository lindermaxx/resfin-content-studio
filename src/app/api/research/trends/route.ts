import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
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

function normalizeMetricas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeTrend(value: unknown): Trend | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<Record<keyof Trend, unknown>>;
  const titulo = typeof raw.titulo === "string" ? raw.titulo.trim() : "";
  if (!titulo) return null;

  return {
    titulo,
    plataforma: typeof raw.plataforma === "string" ? raw.plataforma : "",
    metricas: normalizeMetricas(raw.metricas),
    fonte: typeof raw.fonte === "string" ? raw.fonte : "",
    url: typeof raw.url === "string" ? raw.url : "",
    contexto: typeof raw.contexto === "string" ? raw.contexto : "",
  };
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
  timeoutSecs = 12
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
      maxResults: 8,
      proxyConfiguration: { useApifyProxy: true },
    },
    apifyToken,
    10
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
      resultsPerPage: 30,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
    },
    apifyToken,
    12
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
      resultsLimit: 40,
    },
    apifyToken,
    15
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    const googleModel = process.env.GOOGLE_TEXT_MODEL || "gemini-1.5-flash";

    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY não configurado." },
        { status: 500 }
      );
    }

    // Run all sources in parallel, prioritizing social networks
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
        ? truncate(youtubeResult.value as unknown[], 8)
        : [];
    const tiktok =
      tiktokResult.status === "fulfilled"
        ? truncate(tiktokResult.value as unknown[], 14)
        : [];
    const instagram =
      instagramResult.status === "fulfilled"
        ? truncate(instagramResult.value as unknown[], 14)
        : [];

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

    const socialCount = instagram.length + tiktok.length;
    const socialQuota =
      socialCount >= 8 ? 7 :
      socialCount >= 4 ? 4 :
      socialCount >= 2 ? 2 :
      0;

    const rawData = {
      instagram,
      tiktok,
      youtube,
      googleTrends: socialCount > 0 ? truncate(googleTrends, 6) : googleTrends,
    };

    // Gemini selects & formats
    const genAI = new GoogleGenerativeAI(googleKey);
    const gemini = genAI.getGenerativeModel({ model: googleModel });

    const prompt = `Você recebeu dados reais sobre o que está em alta no Brasil agora.

DADOS:
${JSON.stringify(rawData, null, 2).slice(0, 10000)}

NICHO DO USUÁRIO: Médicos brasileiros + finanças pessoais + investimentos + saúde financeira.
TEMAS PRIORITÁRIOS: economia, mercado, investimentos, IR, PGBL, previdência, imóveis, bolsa, dólar, inflação, médicos, medicina, saúde, hospital, concurso, criptomoeda, reforma tributária, INSS, aposentadoria, juros, banco.

TAREFA: Selecione e formate exatamente 10 trending topics seguindo estas regras:
1. PRIORIDADE MÁXIMA: Instagram e TikTok
2. Se existirem dados suficientes, retorne no mínimo ${socialQuota} itens vindos de Instagram/TikTok
3. Use YouTube e Google Trends apenas como complemento para fechar 10 itens
4. Use APENAS dados dos resultados acima — não invente
5. titulo: exatamente como está nos dados (sem reescrever)
6. plataforma: "Instagram", "TikTok", "YouTube" ou "Google Trends"
7. metricas: 1-3 strings reais (ex: "500.000+ buscas", "#3 no YouTube", "1.2M views")
8. fonte: nome da notícia associada ou "Google Trends Brasil"
9. url: URL real do post/vídeo/notícia
10. contexto: 1-2 frases resumindo O QUE está acontecendo e POR QUÊ está em alta (use newsTitle + newsSnippet dos dados). Máx 300 chars.

Retorne apenas o array JSON com 10 objetos. Sem markdown.`;

    const result = await gemini.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    if (!clean.startsWith("[")) {
      return NextResponse.json(
        { error: `Resposta inesperada do modelo: ${clean.slice(0, 200)}` },
        { status: 500 }
      );
    }

    let trends: Trend[];
    try {
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) {
        throw new Error("Resposta fora do formato esperado (array).");
      }
      trends = parsed
        .map((item) => normalizeTrend(item))
        .filter((item): item is Trend => item !== null);
    } catch {
      return NextResponse.json(
        { error: "Erro ao processar os dados. Tente novamente." },
        { status: 500 }
      );
    }

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
