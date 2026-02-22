import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export interface Trend {
  titulo: string;
  plataforma: string;
  metricas: string[];
  fonte: string;
  url: string;
  contexto: string; // trecho do conteúdo viral: descrição, caption ou primeiras linhas do roteiro
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

    // Roda todos os scrapers em paralelo — timeout curto para caber nos 60s do Vercel
    const ACTOR_TIMEOUT = 20; // segundos por actor (paralelos = ~20s total, sobra ~35s pro Gemini)
    const [googleTrendsResult, youtubeResult, tiktokResult, instagramResult] =
      await Promise.allSettled([
        // Google Trends Brasil
        runActor(
          "petr.cermak~google-trends-scraper",
          { geo: "BR", type: "daily", limit: 20 },
          apifyToken,
          ACTOR_TIMEOUT
        ),
        // YouTube trending Brasil
        runActor(
          "apify~youtube-scraper",
          {
            searchQueries: ["trending brasil hoje", "viral brasil semana"],
            maxResults: 10,
            proxyConfiguration: { useApifyProxy: true },
          },
          apifyToken,
          ACTOR_TIMEOUT
        ),
        // TikTok trending
        runActor(
          "clockworks~free-tiktok-scraper",
          { type: "trending", limit: 15 },
          apifyToken,
          ACTOR_TIMEOUT
        ),
        // Instagram hashtags em alta no Brasil
        runActor(
          "apify~instagram-hashtag-scraper",
          {
            hashtags: ["brasil", "viral", "noticias"],
            resultsPerPage: 10,
          },
          apifyToken,
          ACTOR_TIMEOUT
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
Seu trabalho é filtrar e retornar SOMENTE os trending topics relevantes para o nicho de finanças pessoais e medicina.

NICHO: Médicos brasileiros + finanças pessoais + investimentos + saúde financeira
TEMAS RELEVANTES: economia, mercado financeiro, investimentos, IR, imposto de renda, PGBL, VGBL, previdência privada, renda passiva, imóveis, tesouro direto, bolsa de valores, dólar, inflação, médicos, medicina, residência médica, plantão, CRM, saúde, hospital, plano de saúde, concurso público, salário de médico, dívidas, juros, banco, fintech, criptomoeda, bitcoin, reforma tributária, reforma trabalhista, INSS, aposentadoria, CLT, PJ, MEI.

DADOS BRUTOS:
${JSON.stringify(rawData, null, 2).slice(0, 12000)}

REGRAS:
1. PRIORIZE tópicos do nicho (finanças, economia, medicina, saúde, investimentos, mercado, IR, cripto)
2. SEMPRE retorne exatamente 10 tópicos — se não houver 10 do nicho, complete com os trending topics de maior volume dos dados, independente do tema
3. Use APENAS dados presentes nos resultados — não invente tópicos
4. Extraia métricas reais dos dados (views, likes, buscas, posição no ranking)
5. titulo: manchete/tema exatamente como está no dado bruto
6. plataforma: qual plataforma forneceu o dado ("Google Trends", "YouTube", "TikTok", "Instagram")
7. metricas: array com 2-4 strings de métricas REAIS extraídas dos dados (views, likes, buscas, posição)
8. fonte: nome do veículo/plataforma
9. url: URL real do item (use a URL do vídeo, post ou busca se disponível nos dados)
10. contexto: trecho REAL do conteúdo viral — para YouTube use o título completo + descrição (primeiros 300 chars); para TikTok use o caption/texto do vídeo; para Instagram use a legenda do post; para Google Trends use as queries relacionadas mais buscadas. Máximo 400 caracteres. Este campo é OBRIGATÓRIO — é o que o copywriter vai usar para entender o que viralizou.

Retorne apenas o array JSON com até 10 objetos relevantes. Sem markdown.`;

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
