import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export interface Trend {
  titulo: string;
  plataforma: "Instagram" | "YouTube" | "TikTok" | "LinkedIn" | "Twitter";
  pilar:
    | "educacao_financeira"
    | "investimentos_carteira"
    | "organizacao_orcamento"
    | "mentalidade_comportamento"
    | "noticias_comentadas"
    | "solucoes_patrimoniais"
    | "bastidores";
  hook: string;
  justificativa: string; // por que esse tema está em alta — baseado em dados reais
  dados: string[];       // métricas e evidências encontradas (buscas, notícias, cobertura)
}

const PROMPT = `Você é um especialista em estratégia de conteúdo para redes sociais, focado em finanças pessoais e planejamento financeiro para médicos brasileiros.

Use sua capacidade de busca para pesquisar o que está em alta AGORA no Brasil relacionado a: finanças pessoais, investimentos, economia, planejamento financeiro, mercado imobiliário, imposto de renda, previdência, e temas relevantes para médicos de alta renda.

Retorne SOMENTE um array JSON válido (sem markdown, sem texto adicional) com exatamente 10 trending topics relevantes para o perfil @residenciaemfinancas.

Cada item deve ter exatamente estes campos:
- "titulo": string — tema específico e atual do post
- "plataforma": string — onde o tema está mais em alta: "Instagram", "YouTube", "TikTok", "LinkedIn" ou "Twitter"
- "pilar": string — um dos valores exatos: "educacao_financeira", "investimentos_carteira", "organizacao_orcamento", "mentalidade_comportamento", "noticias_comentadas", "solucoes_patrimoniais", "bastidores"
- "hook": string — frase de abertura impactante para o post (máximo 15 palavras, sem imperativo)
- "justificativa": string — 1-2 frases explicando POR QUE esse tema está em alta agora, com dados reais que você encontrou (notícias recentes, tendências de busca, cobertura de mídia, contexto econômico atual)
- "dados": array de strings — liste 2-4 evidências concretas encontradas, como: termos em alta no Google, notícias recentes com data, dados do Banco Central, números de engajamento que encontrou, cobertura em veículos financeiros (ex: "Selic em 13,75% — pauta dominante no InfoMoney esta semana", "Busca por 'PGBL médico' cresceu em jan/2026 segundo Google Trends")

Priorize temas com evidências reais encontradas nas suas buscas. Retorne apenas o JSON.`;

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Google não configurada. Verifique as variáveis de ambiente." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Usa gemini-2.0-flash para grounding — suporte nativo ao Google Search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gemini = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} } as any],
    });

    const result = await gemini.generateContent(PROMPT);
    const text = result.response.text().trim();

    // Remove markdown code blocks se presentes
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
