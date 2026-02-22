import { FileText } from "lucide-react";

export default function CopyPage() {
  return (
    <div className="flex flex-col gap-6 px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <FileText className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Copy Studio</h1>
          <p className="text-sm text-zinc-500">Geração de copy com Leandro Ladeira</p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-8 py-16 text-center">
        <p className="text-sm text-zinc-400">
          Copy Studio — em construção (EPIC-03)
        </p>
      </div>
    </div>
  );
}
