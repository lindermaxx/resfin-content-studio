"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CopyIdea, GenerateCopyRequest } from "@/app/api/copy/generate/route";

type Formato = GenerateCopyRequest["formato"];
type Voz = GenerateCopyRequest["voz"];

const formatos: { value: Formato; label: string; desc: string }[] = [
  { value: "carrossel", label: "Carrossel", desc: "Educativo, múltiplos slides" },
  { value: "post_estatico", label: "Post Estático", desc: "Impacto em uma imagem" },
  { value: "reels", label: "Reels", desc: "Roteiro de vídeo curto" },
  { value: "stories", label: "Stories", desc: "Informal, interativo" },
];

const vozes: { value: Voz; label: string; desc: string }[] = [
  { value: "max_linder", label: "Max Linder", desc: "Técnico, sênior, CFP®" },
  { value: "rian_tavares", label: "Rian Tavares", desc: "Energético, inspiracional" },
  { value: "marca_institucional", label: "Marca Institucional", desc: "O programa, nós" },
];

const anguloLabel: Record<CopyIdea["angulo"], string> = {
  educativo: "Educativo",
  provocativo: "Provocativo",
  storytelling: "Storytelling",
};

const anguloBadgeVariant: Record<CopyIdea["angulo"], "default" | "secondary" | "outline"> = {
  educativo: "secondary",
  provocativo: "default",
  storytelling: "outline",
};

interface ResearchContext {
  tema: string;
  pilar: string | null;
  hook: string | null;
  rascunho: string;
  source: "trend" | "manual";
  contextoViral: string | null;
  plataforma: string | null;
  metricas: string[];
  url: string | null;
}

export default function CopyPage() {
  const router = useRouter();
  const [context, setContext] = useState<ResearchContext | null>(null);
  const [formato, setFormato] = useState<Formato>("carrossel");
  const [voz, setVoz] = useState<Voz>("max_linder");
  const [ideas, setIdeas] = useState<CopyIdea[]>([]);
  const [selected, setSelected] = useState<CopyIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("resfin_research_context");
    if (raw) {
      try {
        setContext(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, []);

  async function gerarCopy() {
    if (!context) return;
    setLoading(true);
    setError(null);
    setSelected(null);

    try {
      const res = await fetch("/api/copy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: context.tema,
          pilar: context.pilar,
          hook: context.hook,
          rascunho: context.rascunho || "",
          source: context.source,
          formato,
          voz,
          contextoViral: context.contextoViral ?? null,
          plataforma: context.plataforma ?? null,
          metricas: context.metricas ?? [],
        } satisfies GenerateCopyRequest),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");
      setIdeas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar copy.");
    } finally {
      setLoading(false);
    }
  }

  function irParaReview() {
    if (!selected || !context) return;
    sessionStorage.setItem(
      "resfin_copy_context",
      JSON.stringify({ ...context, formato, voz, idea: selected })
    );
    router.push("/review");
  }

  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <FileText className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Copy Studio</h1>
          <p className="text-sm text-zinc-500">Geração de copy com Leandro Ladeira</p>
        </div>
      </div>

      {/* Contexto do Research */}
      {context ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Tema selecionado</span>
            <span className="text-sm font-medium text-zinc-900">{context.tema}</span>
            {context.rascunho && (
              <span className="text-xs text-zinc-500 mt-1">
                Rascunho colado — agente vai refinar
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/research")}
            className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0"
          >
            Trocar tema
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-700">
            Nenhum tema selecionado.{" "}
            <button
              onClick={() => router.push("/research")}
              className="font-medium underline"
            >
              Voltar ao Research
            </button>
          </p>
        </div>
      )}

      {/* Formato */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">Formato do post</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {formatos.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormato(f.value)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-all",
                formato === f.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-400 text-zinc-700"
              )}
            >
              <span className="text-sm font-medium">{f.label}</span>
              <span className={cn("text-xs", formato === f.value ? "text-zinc-400" : "text-zinc-400")}>
                {f.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Voz */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">Voz do post</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {vozes.map((v) => (
            <button
              key={v.value}
              onClick={() => setVoz(v.value)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-all",
                voz === v.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-400 text-zinc-700"
              )}
            >
              <span className="text-sm font-medium">{v.label}</span>
              <span className="text-xs text-zinc-400">{v.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Gerar */}
      <div className="flex justify-end">
        <Button onClick={gerarCopy} disabled={loading || !context}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando com Leandro Ladeira...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {ideas.length > 0 ? "Gerar novas ideias" : "Gerar 3 ideias de copy"}
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Ideias geradas */}
      {ideas.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-700">
              Escolha uma ideia para continuar
            </h2>
            <div className="flex flex-col gap-4">
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(selected === idea ? null : idea)}
                  className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-xl"
                >
                  <Card
                    className={cn(
                      "transition-all",
                      selected === idea
                        ? "border-zinc-900 shadow-md ring-1 ring-zinc-900"
                        : "hover:border-zinc-400"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={anguloBadgeVariant[idea.angulo]}>
                          {anguloLabel[idea.angulo]}
                        </Badge>
                        {selected === idea && (
                          <Badge variant="outline" className="border-zinc-900 text-zinc-900">
                            Selecionada
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-semibold leading-snug mt-2">
                        &ldquo;{idea.hook}&rdquo;
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <CardDescription className="text-xs leading-relaxed whitespace-pre-line text-zinc-600">
                        {idea.copy}
                      </CardDescription>
                      <Separator />
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-zinc-500">Visual sugerido</span>
                        <span className="text-xs text-zinc-600">{idea.visual}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-zinc-500">CTA</span>
                        <span className="text-xs text-zinc-600 italic">{idea.cta}</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>

          {/* CTA para Review */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-6 py-4">
            <p className="text-sm text-zinc-500">
              {selected
                ? `Ideia "${anguloLabel[selected.angulo]}" selecionada`
                : "Selecione uma ideia para continuar"}
            </p>
            <Button onClick={irParaReview} disabled={!selected}>
              Ir para Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
