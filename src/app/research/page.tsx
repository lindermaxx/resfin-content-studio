"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, RefreshCw, Link2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { TrendCard } from "@/components/research/TrendCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Trend } from "@/app/api/research/trends/route";
import type { ExtractedContent } from "@/app/api/research/extract-url/route";

const TRENDS_CACHE_KEY = "resfin_trends_v2";

const tipoLabel: Record<ExtractedContent["tipo"], string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  video: "Vídeo",
  artigo: "Artigo",
  post: "Post",
};

export default function ResearchPage() {
  const router = useRouter();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [manualTema, setManualTema] = useState("");
  const [rascunho, setRascunho] = useState("");

  // URL de referência
  const [urlRef, setUrlRef] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null);
  const [showTranscricao, setShowTranscricao] = useState(false);

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
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("Tempo limite excedido ao buscar trends. Os scrapers demoraram mais que o esperado — tente novamente.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Erro desconhecido");
      setTrends(data as typeof trends);
      sessionStorage.setItem(TRENDS_CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar trends.");
    } finally {
      setLoading(false);
    }
  }

  async function extrairUrl() {
    if (!urlRef.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtracted(null);
    setShowTranscricao(false);
    try {
      const res = await fetch("/api/research/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlRef.trim() }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error("Tempo limite excedido ao extrair conteúdo — tente novamente.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Erro desconhecido");
      setExtracted(data as ExtractedContent);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Erro ao extrair conteúdo.");
    } finally {
      setExtracting(false);
    }
  }

  function irParaCopyStudio() {
    // URL extracted content takes priority over trend's contexto
    const contextoViral = extracted?.transcricao || selectedTrend?.contexto || null;
    const plataforma = extracted?.plataforma || selectedTrend?.plataforma || null;
    const metricas = selectedTrend?.metricas || [];

    const context = selectedTrend
      ? {
          tema: selectedTrend.titulo,
          pilar: null,
          hook: null,
          rascunho: rascunho.trim(),
          source: "trend" as const,
          contextoViral,
          plataforma,
          metricas,
          url: selectedTrend.url || null,
        }
      : {
          tema: manualTema.trim(),
          pilar: null,
          hook: null,
          rascunho: rascunho.trim(),
          source: "manual" as const,
          contextoViral,
          plataforma,
          metricas: [],
          url: null,
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
                  Buscar Trends da Semana
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

      <Separator />

      {/* Referência de conteúdo viral */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-zinc-700">
            Referência de conteúdo{" "}
            <span className="font-normal text-zinc-400">(opcional)</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Cole o link de um Reels, carrossel, TikTok, vídeo do YouTube ou reportagem.
            O Ladeira recebe a transcrição completa para entrar na trend.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.instagram.com/reel/... ou youtube.com/watch?v=..."
            value={urlRef}
            onChange={(e) => {
              setUrlRef(e.target.value);
              if (extracted) setExtracted(null);
              if (extractError) setExtractError(null);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") extrairUrl(); }}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <Button
            onClick={extrairUrl}
            disabled={extracting || !urlRef.trim()}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            {extracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Extrair
              </>
            )}
          </Button>
        </div>

        {extractError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {extractError}
          </div>
        )}

        {extracted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-800">
                  {tipoLabel[extracted.tipo]} · {extracted.plataforma}
                </span>
              </div>
              <button
                onClick={() => setShowTranscricao((v) => !v)}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                {showTranscricao ? (
                  <><ChevronUp className="h-3.5 w-3.5" /> Ocultar</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5" /> Ver transcrição</>
                )}
              </button>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {extracted.titulo}
            </p>
            {showTranscricao && (
              <div className="mt-1 rounded-lg bg-white border border-emerald-100 px-3 py-2.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">
                  {extracted.transcricao}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

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
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-zinc-500">
            {temaSelecionado
              ? selectedTrend
                ? `Tema: "${selectedTrend.titulo}"`
                : `Tema: "${manualTema.trim()}"`
              : "Selecione um trend ou escreva seu próprio tema para continuar"}
          </p>
          {extracted && (
            <p className="text-xs text-emerald-600">
              + referência extraída ({tipoLabel[extracted.tipo]} · {extracted.plataforma})
            </p>
          )}
        </div>
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
