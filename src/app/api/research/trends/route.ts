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

const PROMPT = `Pesquise o que está em alta no Brasil AGORA. Use sua capacidade de busca para encontrar os trending topics reais desta semana.

Retorne SOMENTE um array JSON válido (sem markdown, sem texto adicional) com exatamente 10 trending topics brasileiros.

IMPORTANTE:
- Não filtre por tema — busque o que está realmente viral no Brasil agora (economia, política, saúde, tecnologia, comportamento, qualquer tema)
- Não adapte para médicos ou finanças — traga a manchete/tema exatamente como está circulando
- Foque em evidências de viralização: quantos views, quantas buscas, qual o engajamento real

Cada item deve ter exatamente estes campos:
- "titulo": string — o tema/manchete exatamente como está em alta (não adapte)
- "plataforma": string — onde está mais em alta ("Instagram", "YouTube", "TikTok", "LinkedIn", "Twitter", "Google Trends", "Portais de Notícia")
- "metricas": array de strings — evidências concretas de viralização que você encontrou, como: número de views, quantidade de buscas, posição no Google Trends, número de publicações, engajamento em posts (ex: "3,2M views no TikTok em 48h", "Top 5 Google Trends BR nesta semana", "12.000 posts no Instagram com a hashtag", "450k compartilhamentos no WhatsApp segundo dados do Twitter")
- "fonte": string — nome do veículo ou plataforma onde você encontrou os dados (ex: "Google Trends", "InfoMoney", "Folha de S.Paulo", "TikTok", "G1")
- "url": string — link direto para a fonte onde os dados podem ser verificados (se não encontrar URL específica, use a URL principal do veículo)

Retorne apenas o array JSON.`;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gemini = genAI.getGenerativeModel({
      model,
      tools: [{ googleSearch: {} } as any],
    });

    const result = await gemini.generateContent(PROMPT);
    const text = result.response.text().trim();

    const clean = text
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

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
