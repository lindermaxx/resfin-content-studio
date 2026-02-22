"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { TrendCard } from "@/components/research/TrendCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Trend } from "@/app/api/research/trends/route";

const TRENDS_CACHE_KEY = "resfin_trends_cache";

export default function ResearchPage() {
  const router = useRouter();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [manualTema, setManualTema] = useState("");
  const [rascunho, setRascunho] = useState("");

  // Restaura trends do cache ao voltar para a página
  useEffect(() => {
    const cached = sessionStorage.getItem(TRENDS_CACHE_KEY);
    if (cached) {
      try { setTrends(JSON.parse(cached)); } catch { /* ignore */ }
    }
  }, []);

  const temaSelecionado = selectedTrend !== null || manualTema.trim().length > 0;

  async function buscarTrends(forcar = false) {
    setLoading(true);
    setError(null);
    if (forcar) setSelectedTrend(null);
    try {
      const res = await fetch("/api/research/trends", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");
      setTrends(data);
      sessionStorage.setItem(TRENDS_CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar trends.");
    } finally {
      setLoading(false);
    }
  }

  function irParaCopyStudio() {
    const context = selectedTrend
      ? {
          tema: selectedTrend.titulo,
          pilar: selectedTrend.pilar,
          hook: selectedTrend.hook,
          rascunho: rascunho.trim(),
          source: "trend" as const,
        }
      : {
          tema: manualTema.trim(),
          pilar: null,
          hook: null,
          rascunho: rascunho.trim(),
          source: "manual" as const,
        };

    sessionStorage.setItem("resfin_research_context", JSON.stringify(context));
    router.push("/copy");
  }

  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <Search className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Research</h1>
          <p className="text-sm text-zinc-500">
            Escolha um tema para o seu próximo post
          </p>
        </div>
      </div>

      {/* Buscar trends */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">
            Trending topics da semana
          </h2>
          <div className="flex gap-2">
            {trends.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => buscarTrends(true)}
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Atualizar
              </Button>
            )}
            <Button
              onClick={() => buscarTrends(false)}
              disabled={loading}
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  {trends.length === 0 ? "Buscar Trends da Semana" : "Buscar Trends da Semana"}
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {trends.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trends.map((trend, i) => (
              <TrendCard
                key={i}
                trend={trend}
                selected={selectedTrend === trend}
                onSelect={() =>
                  setSelectedTrend(selectedTrend === trend ? null : trend)
                }
              />
            ))}
          </div>
        )}

        {trends.length === 0 && !loading && !error && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-8 py-10 text-center">
            <p className="text-sm text-zinc-400">
              Clique em &ldquo;Buscar Trends da Semana&rdquo; para ver os tópicos em alta
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Tema próprio */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">
          Ou use seu próprio tema
        </h2>
        <input
          type="text"
          placeholder="Ex: Como médicos podem usar PGBL para reduzir IR"
          value={manualTema}
          onChange={(e) => {
            setManualTema(e.target.value);
            if (e.target.value.trim()) setSelectedTrend(null);
          }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      {/* Rascunho */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-zinc-700">
            Colar rascunho de copy{" "}
            <span className="font-normal text-zinc-400">(opcional)</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Se já escreveu algo, cole aqui e o agente vai refinar aplicando o método Light Copy.
          </p>
        </div>
        <textarea
          placeholder="Cole aqui o seu rascunho..."
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
        />
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-6 py-4">
        <p className="text-sm text-zinc-500">
          {temaSelecionado
            ? selectedTrend
              ? `Tema selecionado: "${selectedTrend.titulo}"`
              : `Tema manual: "${manualTema.trim()}"`
            : "Selecione um trend ou escreva seu próprio tema para continuar"}
        </p>
        <Button
          onClick={irParaCopyStudio}
          disabled={!temaSelecionado}
        >
          Ir para Copy Studio
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
