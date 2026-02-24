import { NextRequest, NextResponse } from "next/server";
import { deleteContentBankItem } from "@/lib/creative-system-store";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const itemId = id?.trim();
    if (!itemId) {
      return NextResponse.json(
        { error: "ID do item é obrigatório." },
        { status: 400 }
      );
    }

    const removed = await deleteContentBankItem(itemId);
    if (!removed) {
      return NextResponse.json(
        { error: "Item não encontrado no banco de conteúdo." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erro ao remover item: ${message}` },
      { status: 500 }
    );
  }
}
