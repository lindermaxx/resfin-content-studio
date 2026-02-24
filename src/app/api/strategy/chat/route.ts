import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { saveStrategySession } from "@/lib/creative-system-store";
import type { StrategyMessage } from "@/lib/research-types";

export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3-pro-preview";

const SYSTEM_INSTRUCTION = `Você é o estrategista de conteúdo oficial do método Light Copy de Leandro Ladeira para o projeto @residenciaemfinancas.

Objetivo da sessão:
1) Definir estratégia mensal de conteúdo.
2) Propor Big Ideas com base em premissas fortes (marketing de premissas).
3) Converter isso em calendário editorial semanal.

Regras:
- Sempre priorize especificidade e contexto de médicos brasileiros de alta renda.
- Evite promessas vagas; explique premissas que levam à conclusão.
- Linguagem prática, objetiva e executável.
- Quando fizer sentido, inclua formatos (reels, carrossel, post estático, stories) e CTA com keyword ManyChat.
- Se faltar contexto, faça perguntas diretas antes de fechar plano.

Formato de resposta preferido:
- Diagnóstico do mês
- Big Ideas priorizadas (título, premissa central, formato sugerido, CTA)
- Calendário de 4 semanas (tema por dia/formato)
- Próximos passos operacionais para o time`;

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMessages(value: unknown): StrategyMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const role = raw.role === "assistant" ? "assistant" : raw.role === "user" ? "user" : null;
      const content = toText(raw.content);
      if (!role || !content) return null;
      return {
        role,
        content,
        created_at: toText(raw.created_at) || new Date().toISOString(),
      } satisfies StrategyMessage;
    })
    .filter((item): item is StrategyMessage => item !== null);
}

function buildPrompt(params: {
  monthRef: string;
  objective: string;
  messages: StrategyMessage[];
}): string {
  const transcript = params.messages
    .map((message) => {
      const speaker = message.role === "assistant" ? "Assistente" : "Usuário";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return [
    `Mês de referência: ${params.monthRef}`,
    `Objetivo do mês: ${params.objective}`,
    "Conversa até agora:",
    transcript,
    "Responda ao último contexto do usuário mantendo continuidade.",
  ].join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const monthRef = toText(body.month_ref);
    const objective = toText(body.objective);
    const messages = normalizeMessages(body.messages);

    if (!monthRef || !objective || messages.length === 0) {
      return NextResponse.json(
        { error: "Campos obrigatórios: month_ref, objective e messages." },
        { status: 400 }
      );
    }

    const googleKey = process.env.GOOGLE_AI_API_KEY;
    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY não configurado." },
        { status: 500 }
      );
    }

    const modelName = process.env.GOOGLE_TEXT_MODEL || DEFAULT_MODEL;
    const client = new GoogleGenerativeAI(googleKey);
    const model = client.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(
      `${SYSTEM_INSTRUCTION}\n\n${buildPrompt({
        monthRef,
        objective,
        messages: messages.slice(-24),
      })}`
    );
    const assistantText = result.response.text().trim();

    if (!assistantText) {
      return NextResponse.json(
        { error: "Gemini retornou resposta vazia para a estratégia." },
        { status: 502 }
      );
    }

    const assistantMessage: StrategyMessage = {
      role: "assistant",
      content: assistantText,
      created_at: new Date().toISOString(),
    };
    const updatedMessages = [...messages, assistantMessage];

    const session = await saveStrategySession({
      month_ref: monthRef,
      objective,
      messages: updatedMessages,
    });

    return NextResponse.json({
      message: assistantMessage,
      session,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao gerar estratégia com Gemini: ${message}` },
      { status: 500 }
    );
  }
}
