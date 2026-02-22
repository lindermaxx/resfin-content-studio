import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // segundos — necessário para geração com Claude

export interface CopyIdea {
  angulo: "educativo" | "provocativo" | "storytelling";
  hook: string;
  copy: string;
  visual: string;
  cta: string;
}

export interface GenerateCopyRequest {
  tema: string;
  pilar: string | null;
  hook: string | null;
  rascunho: string;
  source: "trend" | "manual";
  formato: "carrossel" | "post_estatico" | "reels" | "stories";
  voz: "max_linder" | "rian_tavares" | "marca_institucional";
  contextoViral: string | null; // roteiro/caption/descrição do conteúdo que viralizou
  plataforma: string | null;
  metricas: string[];
}

const SYSTEM_PROMPT = `Você é Leandro Ladeira (Ladeirinha) — copywriter e estrategista digital.
Criador do Light Copy: método que vende sem parecer que está vendendo.
Fundamento: Marketing de Premissas > Marketing de Promessas.

Sua identidade como copywriter:
"Escrevo como um pensador que por acaso também vende — a venda nunca parece venda, o argumento nunca parece argumento, e a conclusão sempre parece ter sido de quem lê."

Você está trabalhando para o projeto @residenciaemfinancas.

---

CONTEXTO DO PROJETO

Marca: Residência em Finanças
Público: Médicos brasileiros de alta renda (renda >R$15k/mês, 60-70h/semana) que ganham bem mas não têm sistema financeiro estruturado.

Preceptores:
- Max Linder Campos — CFP®, 16 anos de mercado, fundou/vendeu Kona Capital (R$1Bi sob gestão), 2x palestrante Expert XP. Tom: sênior, técnico, direto.
- Rian Tavares — 2M seguidores, 2 livros best-sellers, ex-sócio XP. Tom: energético, inspiracional, alcance orgânico.
- Marca Institucional — quando ambos aparecem ou conteúdo é sobre o programa. Tom: plural ("nós", "o programa", "nossa metodologia").

Produtos ativos:
1. Acompanhamento Individual — 12 meses, high ticket, personalizado. Keywords ManyChat: Médico, Medico, Medicina, Médicos, Medicos, Quero, Planejamento
2. LifeApp — Prontuário Financeiro Online. Keywords ManyChat: lifeapp, Lifeapp, LIFEAPP, prontuario, prontuário

NUNCA mencionar: curso on-demand, preços, "Consultoria", "Assessoria de Investimentos".

Soluções Patrimoniais — NUNCA nomear o produto:
- Alavancagem patrimonial (consórcio — não nomear)
- Proteção e sucessão (seguro whole life — não nomear)
- Renda passiva via imóveis (veículo — não nomear)
Falar sempre da DOR, RESULTADO e LÓGICA. Produto revela no DM via ManyChat.

---

MÉTODO LIGHT COPY — 5 PASSOS

1. CONCLUSÃO: Qual conclusão exata o médico deve chegar?
2. PREMISSAS IRREFUTÁVEIS: 3-5 fatos que só levam àquela conclusão
3. DESPRETENSÃO: A copy parece observação, conteúdo, reflexão — nunca anúncio
4. ELEMENTOS LITERÁRIOS: analogia médica, antítese, dado inesperado, ironia suave
5. CONCLUSÃO EMERGE: CTA leve com keyword ManyChat

---

CHECKLIST OBRIGATÓRIO (aplique a cada copy):
✅ Primeira frase prende — SEM imperativo (nunca "Aprenda", "Descubra", "Saiba")
✅ Premissas irrefutáveis sustentam a conclusão
✅ Elemento literário presente (analogia médica, antítese ou dado inesperado)
✅ Não parece anúncio — passa pelo teste do feed
✅ CTA com keyword ManyChat — NUNCA só "link na bio"
✅ Soluções Patrimoniais: produto não nomeado
✅ Nenhuma palavra proibida

EXPRESSÕES-ASSINATURA (integre com naturalidade):
- "Entender as dores para saber como tratar."
- "A mesma confiança do diagnóstico, agora nas finanças."
- "Um método testado e validado."
- "Chega de depender de opiniões de terceiros."

---

REGRA DE OUTPUT:
Retorne SOMENTE um array JSON válido. Sem markdown, sem explicações.
Cada item deve ter exatamente: "angulo", "hook", "copy", "visual", "cta".`;

function buildUserPrompt(req: GenerateCopyRequest): string {
  const vozMap = {
    max_linder: "Max Linder (tom sênior, técnico, direto, credencial de mercado)",
    rian_tavares: "Rian Tavares (tom energético, inspiracional, próximo, storytelling)",
    marca_institucional: 'Marca Institucional (tom plural: "nós", "o programa", "nossa metodologia")',
  };

  const formatoMap = {
    carrossel: "Carrossel (educativo, 1 premissa por slide, conclusão no último slide antes do CTA)",
    post_estatico: "Post Estático (hook impactante, 2-3 linhas de contexto, CTA)",
    reels: "Reels (hook 0-3s que não parece hook, desenvolvimento, insight, CTA)",
    stories: "Stories (informal, enquete com premissa embutida, bastidores)",
  };

  const blocoViral = req.contextoViral
    ? `\nCONTEÚDO VIRAL DE REFERÊNCIA (${req.plataforma || "fonte"}):
"""
${req.contextoViral}
"""
${req.metricas?.length ? `Métricas de viralização: ${req.metricas.join(" | ")}` : ""}
ESTRATÉGIA: Entre na trend. Use a mesma estrutura, o mesmo tipo de hook e o mesmo mecanismo que fez este conteúdo viralizar — mas conte para médicos brasileiros no contexto de finanças pessoais. Mesmo formato, mesmo ritmo, realidade diferente.
`
    : "";

  if (req.rascunho && req.rascunho.trim().length > 0) {
    return `O usuário colou um RASCUNHO de copy para você REFINAR aplicando o método Light Copy.

Tema: ${req.tema}
Formato: ${formatoMap[req.formato]}
Voz: ${vozMap[req.voz]}
${req.pilar ? `Pilar: ${req.pilar}` : ""}
${blocoViral}
RASCUNHO ORIGINAL:
"""
${req.rascunho}
"""

Refine este rascunho e gere 3 versões melhoradas com ângulos distintos:
1. "educativo" — foco em ensinar com premissas lógicas
2. "provocativo" — dado inesperado ou pergunta contraintuitiva
3. "storytelling" — narrativa que o médico se identifica

Para cada versão, retorne um objeto JSON com:
- "angulo": "educativo" | "provocativo" | "storytelling"
- "hook": primeira frase de abertura (máximo 20 palavras, sem imperativo)
- "copy": copy completa adaptada para o formato (${req.formato})
- "visual": sugestão de imagem ou elemento visual para o post
- "cta": call to action com keyword ManyChat

Retorne apenas o array JSON com 3 objetos.`;
  }

  return `Crie 3 ideias de copy DISTINTAS para @residenciaemfinancas.

Tema: ${req.tema}
Formato: ${formatoMap[req.formato]}
Voz: ${vozMap[req.voz]}
${req.pilar ? `Pilar de conteúdo: ${req.pilar}` : ""}
${req.hook ? `Hook de referência (do trending topic): "${req.hook}"` : ""}
${blocoViral}
Gere 3 ideias com ângulos completamente diferentes:
1. "educativo" — foco em ensinar com premissas lógicas e dados
2. "provocativo" — dado inesperado, pergunta contraintuitiva ou antítese forte
3. "storytelling" — narrativa ou cena que o médico se identifica imediatamente

Para cada ideia, retorne um objeto JSON com:
- "angulo": "educativo" | "provocativo" | "storytelling"
- "hook": primeira frase de abertura (máximo 20 palavras, SEM imperativo)
- "copy": copy completa formatada para ${req.formato} (use \\n para quebras de linha)
- "visual": sugestão específica de imagem ou visual para o post
- "cta": call to action completo com keyword ManyChat

Retorne apenas o array JSON com 3 objetos.`;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateCopyRequest = await req.json();

    if (!body.tema || !body.formato || !body.voz) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: tema, formato, voz." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave da API Anthropic não configurada." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    let ideas: CopyIdea[];
    try {
      ideas = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "O modelo retornou um formato inesperado. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json(ideas);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/copy/generate]", message);
    return NextResponse.json(
      { error: `Erro ao gerar copy: ${message}` },
      { status: 500 }
    );
  }
}
