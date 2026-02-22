import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export interface Trend {
  titulo: string;
  plataforma: string;
  metricas: string[];
  fonte: string;
  url: string;
  contexto: string;
}

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

// ── Optional YouTube via Apify (8 s timeout, best-effort) ─────────────────
async function fetchYouTubeOptional(
  apifyToken: string
): Promise<unknown[]> {
  const params = new URLSearchParams({ token: apifyToken, timeout: "8", memory: "256" });
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~youtube-scraper/run-sync-get-dataset-items?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchQueries: ["finanças pessoais brasil", "médicos investimentos", "economia brasil semana"],
        maxResults: 6,
        proxyConfiguration: { useApifyProxy: true },
      }),
      signal: AbortSignal.timeout(13_000),
    }
  );
  if (!res.ok) throw new Error(`YouTube Apify: ${res.status}`);
  return res.json();
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

    // Run Google Trends RSS (guaranteed fast) + YouTube (best-effort) in parallel
    const [trendsResult, youtubeResult] = await Promise.allSettled([
      fetchGoogleTrendsRSS(),
      apifyToken
        ? fetchYouTubeOptional(apifyToken)
        : Promise.reject("no token"),
    ]);

    const googleTrends =
      trendsResult.status === "fulfilled" ? trendsResult.value : [];
    const youtube =
      youtubeResult.status === "fulfilled"
        ? (youtubeResult.value as unknown[]).slice(0, 6)
        : [];

    console.log(
      `[/api/research/trends] Google Trends: ${googleTrends.length} items, YouTube: ${youtube.length} items`
    );

    if (googleTrends.length === 0 && youtube.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível buscar dados de tendências. Tente novamente." },
        { status: 500 }
      );
    }

    const rawData = { googleTrends, youtube };

    // Gemini selects & formats
    const genAI = new GoogleGenerativeAI(googleKey);
    const gemini = genAI.getGenerativeModel({ model: googleModel });

    const prompt = `Você recebeu dados reais sobre o que está em alta no Brasil agora.

DADOS:
${JSON.stringify(rawData, null, 2).slice(0, 10000)}

NICHO DO USUÁRIO: Médicos brasileiros + finanças pessoais + investimentos + saúde financeira.
TEMAS PRIORITÁRIOS: economia, mercado, investimentos, IR, PGBL, previdência, imóveis, bolsa, dólar, inflação, médicos, medicina, saúde, hospital, concurso, criptomoeda, reforma tributária, INSS, aposentadoria, juros, banco.

TAREFA: Selecione e formate exatamente 10 trending topics seguindo estas regras:
1. PRIORIZE tópicos do nicho acima
2. Complete até 10 com os de maior volume de busca (campo "traffic"), independente do tema
3. Use APENAS dados dos resultados acima — não invente
4. titulo: exatamente como está nos dados (sem reescrever)
5. plataforma: "Google Trends" ou "YouTube"
6. metricas: 1-3 strings reais (ex: "500.000+ buscas", "#3 no YouTube", "1.2M views")
7. fonte: nome da notícia associada ou "Google Trends Brasil"
8. url: URL da notícia (newsUrl) ou do vídeo
9. contexto: 1-2 frases resumindo O QUE está acontecendo e POR QUÊ está em alta (use newsTitle + newsSnippet dos dados). Máx 300 chars.

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
      trends = JSON.parse(clean);
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
