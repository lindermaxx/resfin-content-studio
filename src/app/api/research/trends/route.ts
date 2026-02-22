import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export interface Trend {
  titulo: string;       // manchete/tema exatamente como está em alta
  plataforma: string;   // onde está em alta: Instagram, YouTube, TikTok, LinkedIn, Twitter, Google, Portais
  metricas: string[];   // evidências de viralização: views, buscas, compartilhamentos, engajamento
  fonte: string;        // nome do veículo/plataforma de origem
  url: string;          // link para a fonte original (quando disponível)
}

const PROMPT = `Você é um analista de tendências digitais do Brasil. Use sua capacidade de busca para identificar o que está viral no Brasil nesta semana.

Retorne SOMENTE um array JSON válido com exatamente 10 objetos. Sem markdown, sem texto antes ou depois do array.

REGRAS OBRIGATÓRIAS:
- Traga temas de qualquer categoria que estejam virais agora (economia, política, saúde, tecnologia, entretenimento, comportamento)
- NÃO filtre para médicos ou finanças — manchete exata como está circulando
- Todos os 4 campos são OBRIGATÓRIOS em todos os 10 itens — nunca deixe vazio ou null
- Para "metricas": se não tiver número exato, estime com base no que sabe ("estimado X milhões de views", "tendência crescente no Google Trends BR") — mas SEMPRE preencha com pelo menos 2 itens
- Para "url": use a URL do veículo principal onde o tema está em alta (ex: "https://g1.globo.com", "https://www.tiktok.com/trending", "https://trends.google.com/trends/?geo=BR")

Estrutura obrigatória de cada item:
{
  "titulo": "manchete ou tema exatamente como está em alta no Brasil",
  "plataforma": "Instagram" | "YouTube" | "TikTok" | "LinkedIn" | "Twitter" | "Google Trends" | "Portais de Notícia",
  "metricas": ["métrica 1 de viralização com número ou estimativa", "métrica 2", "métrica 3"],
  "fonte": "nome do veículo ou plataforma (ex: G1, InfoMoney, TikTok, Google Trends)",
  "url": "https://url-da-fonte.com"
}

Retorne apenas o array JSON com 10 itens.`;

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Google não configurada. Verifique as variáveis de ambiente." },
        { status: 500 }
      );
    }

    const model = process.env.GOOGLE_TEXT_MODEL || "gemini-3-pro-preview";
    const genAI = new GoogleGenerativeAI(apiKey);

    // Tenta com Google Search grounding; se o modelo não suportar, roda sem o tool
    let rawText: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geminiWithSearch = genAI.getGenerativeModel({
        model,
        tools: [{ googleSearch: {} } as any],
      });
      const result = await geminiWithSearch.generateContent(PROMPT);
      rawText = result.response.text().trim();
    } catch {
      // Fallback sem grounding
      const geminiPlain = genAI.getGenerativeModel({ model });
      const result = await geminiPlain.generateContent(PROMPT);
      rawText = result.response.text().trim();
    }

    const clean = rawText
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    // Se o modelo retornou texto de erro em vez de JSON, expõe a mensagem real
    if (!clean.startsWith("[") && !clean.startsWith("{")) {
      console.error("[/api/research/trends] Resposta não-JSON:", clean.slice(0, 300));
      return NextResponse.json(
        { error: `Modelo retornou resposta inesperada: ${clean.slice(0, 200)}` },
        { status: 500 }
      );
    }

    let trends: Trend[];
    try {
      trends = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "A API retornou um formato inesperado. Tente novamente." },
        { status: 500 }
      );
    }

    if (!Array.isArray(trends) || trends.length === 0) {
      return NextResponse.json(
        { error: "Nenhum trend retornado. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json(trends);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/research/trends]", message);
    return NextResponse.json(
      { error: `Erro ao buscar trending topics: ${message}` },
      { status: 500 }
    );
  }
}
