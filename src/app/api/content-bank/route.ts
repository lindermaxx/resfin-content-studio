import { NextRequest, NextResponse } from "next/server";
import {
  createContentBankItem,
  listContentBankItems,
} from "@/lib/creative-system-store";
import type { ContentBankItem } from "@/lib/research-types";

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toContentType(value: unknown): ContentBankItem["tipo"] | null {
  if (
    value === "reels" ||
    value === "carrossel" ||
    value === "video" ||
    value === "artigo" ||
    value === "post"
  ) {
    return value;
  }
  return null;
}

export async function GET() {
  try {
    const items = await listContentBankItems();
    return NextResponse.json(items, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao listar banco de conteúdo: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sourceUrl = toText(body.source_url);
    const title = toText(body.titulo);
    const platform = toText(body.plataforma);
    const transcricao = toText(body.transcricao);
    const tags = toTags(body.tags);
    const notes = toText(body.notes) || null;
    const tipo = toContentType(body.tipo) ?? "post";

    if (!sourceUrl || !title || !platform || !transcricao) {
      return NextResponse.json(
        {
          error:
            "Campos obrigatórios: source_url, titulo, plataforma e transcricao.",
        },
        { status: 400 }
      );
    }

    const item = await createContentBankItem({
      source_url: sourceUrl,
      titulo: title,
      plataforma: platform,
      tipo,
      transcricao,
      tags,
      notes,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao salvar no banco de conteúdo: ${message}` },
      { status: 500 }
    );
  }
}
