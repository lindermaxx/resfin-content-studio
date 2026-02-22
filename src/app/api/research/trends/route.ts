import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

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
}

const PROMPT = `Você é um especialista em conteúdo para redes sociais focado em finanças pessoais e planejamento financeiro para médicos brasileiros.

Retorne SOMENTE um array JSON válido (sem markdown, sem texto adicional) com exatamente 10 trending topics relevantes AGORA para o perfil @residenciaemfinancas no Instagram.

O perfil é voltado para médicos brasileiros que querem organizar suas finanças, investir melhor e construir patrimônio.

Cada item do array deve ter exatamente estes campos:
- "titulo": string — tema do post (claro e específico)
- "plataforma": string — onde o tema está em alta: "Instagram", "YouTube", "TikTok", "LinkedIn" ou "Twitter"
- "pilar": string — um dos valores: "educacao_financeira", "investimentos_carteira", "organizacao_orcamento", "mentalidade_comportamento", "noticias_comentadas", "solucoes_patrimoniais", "bastidores"
- "hook": string — uma frase de abertura impactante para usar no post (máximo 15 palavras)

Foque em temas atuais de economia brasileira, investimentos, planejamento financeiro para médicos, notícias do mercado financeiro e comportamento com dinheiro.

Retorne apenas o JSON, sem explicações.`;

export async function POST() {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    const model = process.env.GOOGLE_TEXT_MODEL;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Google não configurada. Verifique as variáveis de ambiente." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model: model || "gemini-3-pro-preview" });

    const result = await gemini.generateContent(PROMPT);
    const text = result.response.text().trim();

    // Remove markdown code blocks se presentes
    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

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
    console.error("[/api/research/trends]", err);
    return NextResponse.json(
      { error: "Erro ao buscar trending topics. Verifique sua conexão e tente novamente." },
      { status: 500 }
    );
  }
}
