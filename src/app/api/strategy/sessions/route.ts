import { NextRequest, NextResponse } from "next/server";
import {
  listStrategySessions,
  saveStrategySession,
} from "@/lib/creative-system-store";
import type { StrategyMessage } from "@/lib/research-types";

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

export async function GET() {
  try {
    const sessions = await listStrategySessions();
    return NextResponse.json(sessions, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao listar sessões de estratégia: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const monthRef = toText(body.month_ref);
    const objective = toText(body.objective);
    const messages = normalizeMessages(body.messages);

    if (!monthRef || !objective || messages.length === 0) {
      return NextResponse.json(
        {
          error: "Campos obrigatórios: month_ref, objective e messages.",
        },
        { status: 400 }
      );
    }

    const saved = await saveStrategySession({
      month_ref: monthRef,
      objective,
      messages,
    });
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao salvar sessão de estratégia: ${message}` },
      { status: 500 }
    );
  }
}
