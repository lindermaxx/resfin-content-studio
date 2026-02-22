import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export interface Trend {
  titulo: string;
  plataforma: string;
  metricas: string[];
  fonte: string;
  url: string;
}

// Chama um actor Apify via REST API síncrona e retorna os itens do dataset
async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs = 40
): Promise<unknown[]> {
  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSecs),
    memory: "256",
  });

  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 5) * 1000),
    }
  );

  if (!res.ok) {
    throw new Error(`Actor ${actorId} retornou ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// Trunca array para não estourar tokens do Gemini
function truncate<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

export async function POST() {
  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    const googleModel = process.env.GOOGLE_TEXT_MODEL || "gemini-3-pro-preview";

    if (!apifyToken) {
      return NextResponse.json(
        { error: "APIFY_API_TOKEN não configurado nas variáveis de ambiente." },
        { status: 500 }
      );
    }
    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY não configurado." },
        { status: 500 }
      );
    }

    // Roda todos os scrapers em paralelo — usa o que completar dentro do timeout
    const [googleTrendsResult, youtubeResult, tiktokResult, instagramResult] =
      await Promise.allSettled([
        // Google Trends Brasil
        runActor(
          "petr.cermak~google-trends-scraper",
          { geo: "BR", type: "daily", limit: 20 },
          apifyToken
        ),
        // YouTube trending Brasil
        runActor(
          "apify~youtube-scraper",
          {
            searchQueries: ["trending brasil hoje", "viral brasil semana"],
            maxResults: 15,
            proxyConfiguration: { useApifyProxy: true },
          },
          apifyToken
        ),
        // TikTok trending
        runActor(
          "clockworks~free-tiktok-scraper",
          { type: "trending", limit: 20 },
          apifyToken
        ),
        // Instagram hashtags em alta no Brasil
        runActor(
          "apify~instagram-hashtag-scraper",
          {
            hashtags: ["brasil", "viral", "noticias"],
            resultsPerPage: 15,
          },
          apifyToken
        ),
      ]);

    // Extrai resultados dos que tiveram sucesso
    const rawData = {
      googleTrends:
        googleTrendsResult.status === "fulfilled"
          ? truncate(googleTrendsResult.value, 20)
          : null,
      youtube:
        youtubeResult.status === "fulfilled"
          ? truncate(youtubeResult.value, 10)
          : null,
      tiktok:
        tiktokResult.status === "fulfilled"
          ? truncate(tiktokResult.value, 10)
          : null,
      instagram:
        instagramResult.status === "fulfilled"
          ? truncate(instagramResult.value, 10)
          : null,
    };

    // Log quais fontes responderam
    const fontesSucesso = Object.entries(rawData)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    console.log("[/api/research/trends] Fontes com dados:", fontesSucesso);

    if (fontesSucesso.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma fonte de dados respondeu dentro do tempo limite. Tente novamente." },
        { status: 500 }
      );
    }

    // Usa Gemini para formatar os dados brutos em Trend[]
    const genAI = new GoogleGenerativeAI(googleKey);
    const gemini = genAI.getGenerativeModel({ model: googleModel });

    const prompt = `Você recebeu dados reais de múltiplas fontes sobre o que está em alta no Brasil agora.
Analise os dados e retorne SOMENTE um array JSON com exatamente 10 trending topics.

DADOS BRUTOS:
${JSON.stringify(rawData, null, 2).slice(0, 12000)}

REGRAS:
- Use APENAS dados presentes nos resultados acima — não invente
- Extraia métricas reais dos dados (views, likes, buscas, posição no ranking)
- titulo: manchete/tema exatamente como está no dado bruto
- plataforma: qual plataforma forneceu o dado ("Google Trends", "YouTube", "TikTok", "Instagram")
- metricas: array com 2-4 strings de métricas REAIS extraídas dos dados (views, likes, buscas, posição)
- fonte: nome do veículo/plataforma
- url: URL real do item (use a URL do vídeo, post ou busca se disponível nos dados)

Retorne apenas o array JSON com 10 objetos. Sem markdown.`;

    const result = await gemini.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    if (!clean.startsWith("[")) {
      return NextResponse.json(
        { error: `Gemini retornou resposta inesperada: ${clean.slice(0, 200)}` },
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
