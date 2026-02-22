"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, ArrowRight, RefreshCw,
  Link2, CheckCircle2, ChevronDown, ChevronUp,
  Users, Plus, X, Heart, MessageCircle, Eye, Play,
  LayoutGrid, Film,
} from "lucide-react";
import { TrendCard } from "@/components/research/TrendCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Trend } from "@/app/api/research/trends/route";
import type { ExtractedContent } from "@/app/api/research/extract-url/route";
import type { CompetitorPost } from "@/app/api/research/competitor-posts/route";

const TRENDS_CACHE_KEY = "resfin_trends_v2";
const PROFILES_KEY = "resfin_profiles_v1";

const tipoLabel: Record<ExtractedContent["tipo"], string> = {
  reels: "Reels", carrossel: "Carrossel", video: "Vídeo", artigo: "Artigo", post: "Post",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  return d === 0 ? "hoje" : d === 1 ? "ontem" : `${d}d atrás`;
}

export default function ResearchPage() {
  const router = useRouter();

  // Trends
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  // Topic / draft
  const [manualTema, setManualTema] = useState("");
  const [rascunho, setRascunho] = useState("");

  // URL extractor
  const [urlRef, setUrlRef] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null);
  const [showTranscricao, setShowTranscricao] = useState(false);

  // Competitor profiles
  const [profiles, setProfiles] = useState<string[]>([]);
  const [newHandle, setNewHandle] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [competitorPosts, setCompetitorPosts] = useState<CompetitorPost[]>([]);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const newHandleRef = useRef<HTMLInputElement>(null);

  // Load cache + profiles from localStorage
  useEffect(() => {
    const cached = sessionStorage.getItem(TRENDS_CACHE_KEY);
    if (cached) { try { setTrends(JSON.parse(cached)); } catch { /* */ } }
    const stored = localStorage.getItem(PROFILES_KEY);
    if (stored) { try { setProfiles(JSON.parse(stored)); } catch { /* */ } }
  }, []);

  const temaSelecionado = selectedTrend !== null || manualTema.trim().length > 0;

  // ── Trends ───────────────────────────────────────────────────────────────
  async function buscarTrends(forcar = false) {
    setLoadingTrends(true);
    setTrendsError(null);
    if (forcar) setSelectedTrend(null);
    try {
      const res = await fetch("/api/research/trends", { method: "POST" });
      let data: unknown;
      try { data = await res.json(); } catch {
        throw new Error("Tempo limite excedido ao buscar trends — tente novamente.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Erro desconhecido");
      setTrends(data as typeof trends);
      sessionStorage.setItem(TRENDS_CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      setTrendsError(err instanceof Error ? err.message : "Erro ao buscar trends.");
    } finally {
      setLoadingTrends(false);
    }
  }

  // ── URL extractor ────────────────────────────────────────────────────────
  async function extrairUrl(url?: string) {
    const target = url || urlRef.trim();
    if (!target) return;
    if (!url) setUrlRef(target);
    setExtracting(true);
    setExtractError(null);
    setExtracted(null);
    setShowTranscricao(false);
    try {
      const res = await fetch("/api/research/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      let data: unknown;
      try { data = await res.json(); } catch {
        throw new Error("Tempo limite excedido ao extrair conteúdo — tente novamente.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Erro desconhecido");
      setExtracted(data as ExtractedContent);
      // Scroll to URL section
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Erro ao extrair conteúdo.");
    } finally {
      setExtracting(false);
    }
  }

  // ── Profiles ─────────────────────────────────────────────────────────────
  function addProfile() {
    const handle = newHandle.trim().replace(/^@/, "");
    if (!handle || profiles.includes(handle)) return;
    const updated = [...profiles, handle];
    setProfiles(updated);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    setNewHandle("");
    newHandleRef.current?.focus();
  }

  function removeProfile(handle: string) {
    const updated = profiles.filter((p) => p !== handle);
    setProfiles(updated);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
    setCompetitorPosts((prev) => prev.filter((p) => p.username !== handle));
  }

  async function buscarPostsPerfis() {
    if (!profiles.length) return;
    setLoadingPosts(true);
    setPostsError(null);
    setCompetitorPosts([]);
    try {
      const res = await fetch("/api/research/competitor-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: profiles }),
      });
      let data: unknown;
      try { data = await res.json(); } catch {
        throw new Error("Tempo limite excedido ao buscar posts — tente novamente.");
      }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Erro desconhecido");
      setCompetitorPosts(data as CompetitorPost[]);
    } catch (err) {
      setPostsError(err instanceof Error ? err.message : "Erro ao buscar posts.");
    } finally {
      setLoadingPosts(false);
    }
  }

  // ── Copy Studio context ──────────────────────────────────────────────────
  function irParaCopyStudio() {
    const contextoViral = extracted?.transcricao || selectedTrend?.contexto || null;
    const plataforma = extracted?.plataforma || selectedTrend?.plataforma || null;
    const metricas = selectedTrend?.metricas || [];

    const context = selectedTrend
      ? { tema: selectedTrend.titulo, pilar: null, hook: null, rascunho: rascunho.trim(), source: "trend" as const, contextoViral, plataforma, metricas, url: selectedTrend.url || null }
      : { tema: manualTema.trim(), pilar: null, hook: null, rascunho: rascunho.trim(), source: "manual" as const, contextoViral, plataforma, metricas: [], url: null };

    sessionStorage.setItem("resfin_research_context", JSON.stringify(context));
    router.push("/copy");
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 px-8 py-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <Search className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Research</h1>
          <p className="text-sm text-zinc-500">Escolha um tema para o seu próximo post</p>
        </div>
      </div>

      {/* ── Trending topics ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">Trending topics da semana</h2>
          <div className="flex gap-2">
            {trends.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => buscarTrends(true)} disabled={loadingTrends}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />Atualizar
              </Button>
            )}
            <Button onClick={() => buscarTrends(false)} disabled={loadingTrends} size="sm">
              {loadingTrends ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" />Buscar Trends da Semana</>
              )}
            </Button>
          </div>
        </div>

        {trendsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{trendsError}</div>
        )}

        {trends.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trends.map((trend, i) => (
              <TrendCard
                key={i} trend={trend}
                selected={selectedTrend === trend}
                onSelect={() => setSelectedTrend(selectedTrend === trend ? null : trend)}
              />
            ))}
          </div>
        )}

        {trends.length === 0 && !loadingTrends && !trendsError && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-8 py-10 text-center">
            <p className="text-sm text-zinc-400">Clique em &ldquo;Buscar Trends da Semana&rdquo; para ver os tópicos em alta</p>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Perfis monitorados ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setProfilesOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-700">Perfis monitorados</h2>
            {profiles.length > 0 && (
              <Badge variant="secondary" className="text-xs">{profiles.length}</Badge>
            )}
          </div>
          {profilesOpen
            ? <ChevronUp className="h-4 w-4 text-zinc-400" />
            : <ChevronDown className="h-4 w-4 text-zinc-400" />
          }
        </button>

        {profilesOpen && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-zinc-400">
              Monitore creators e concorrentes. Busca os posts dos últimos 10 dias e mostra os que mais performaram para usar como referência.
            </p>

            {/* Add profile */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                <input
                  ref={newHandleRef}
                  type="text"
                  placeholder="handle do perfil"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addProfile(); }}
                  className="w-full rounded-lg border border-zinc-200 bg-white pl-7 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
              </div>
              <Button variant="outline" size="sm" onClick={addProfile} disabled={!newHandle.trim()} className="shrink-0">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar
              </Button>
            </div>

            {/* Profile chips */}
            {profiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profiles.map((handle) => (
                  <div
                    key={handle}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1"
                  >
                    <span className="text-xs text-zinc-700">@{handle}</span>
                    <button
                      onClick={() => removeProfile(handle)}
                      className="text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {profiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={buscarPostsPerfis}
                disabled={loadingPosts}
                className="self-start"
              >
                {loadingPosts ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando posts...</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" />Buscar posts dos últimos 10 dias</>
                )}
              </Button>
            )}

            {postsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{postsError}</div>
            )}

            {/* Competitor post cards */}
            {competitorPosts.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-zinc-500">
                  {competitorPosts.length} posts · ordenados por engajamento
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {competitorPosts.map((post, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-white flex flex-col overflow-hidden"
                    >
                      {/* Thumbnail */}
                      {post.thumbnailUrl && (
                        <div className="relative aspect-video bg-zinc-100 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2">
                            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                              {post.tipo === "reels" ? <Film className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
                              {post.tipo === "reels" ? "Reels" : post.tipo === "carrossel" ? "Carrossel" : "Post"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-500">@{post.username}</span>
                          <span className="text-xs text-zinc-400">{daysAgo(post.timestamp)}</span>
                        </div>

                        {post.caption && (
                          <p className="text-xs text-zinc-700 leading-relaxed line-clamp-3">
                            {post.caption}
                          </p>
                        )}

                        {/* Metrics */}
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          {post.likesCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />{formatNumber(post.likesCount)}
                            </span>
                          )}
                          {post.commentsCount > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />{formatNumber(post.commentsCount)}
                            </span>
                          )}
                          {post.videoViewCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />{formatNumber(post.videoViewCount)}
                            </span>
                          )}
                          {post.tipo === "reels" && post.videoViewCount === 0 && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Play className="h-3 w-3" />—
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs mt-1"
                          onClick={() => {
                            setUrlRef(post.url);
                            setProfilesOpen(false);
                            extrairUrl(post.url);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          disabled={extracting}
                        >
                          {extracting && urlRef === post.url ? (
                            <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Extraindo...</>
                          ) : (
                            <>Usar como referência</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profiles.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-8 text-center">
                <p className="text-sm text-zinc-400">
                  Adicione handles de creators ou concorrentes para monitorar seus melhores posts
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Tema próprio ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700">Ou use seu próprio tema</h2>
        <input
          type="text"
          placeholder="Ex: Como médicos podem usar PGBL para reduzir IR"
          value={manualTema}
          onChange={(e) => { setManualTema(e.target.value); if (e.target.value.trim()) setSelectedTrend(null); }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      <Separator />

      {/* ── Referência de conteúdo (URL) ──────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-zinc-700">
            Referência de conteúdo{" "}
            <span className="font-normal text-zinc-400">(opcional)</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Cole o link de um Reels, carrossel, TikTok, YouTube ou reportagem.
            O Ladeira recebe a transcrição completa para entrar na trend.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.instagram.com/reel/... ou youtube.com/watch?v=..."
            value={urlRef}
            onChange={(e) => { setUrlRef(e.target.value); if (extracted) setExtracted(null); if (extractError) setExtractError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") extrairUrl(); }}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <Button onClick={() => extrairUrl()} disabled={extracting || !urlRef.trim()} variant="outline" size="sm" className="shrink-0">
            {extracting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extraindo...</>
            ) : (
              <><Link2 className="mr-2 h-4 w-4" />Extrair</>
            )}
          </Button>
        </div>

        {extractError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{extractError}</div>
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
                {showTranscricao ? <><ChevronUp className="h-3.5 w-3.5" />Ocultar</> : <><ChevronDown className="h-3.5 w-3.5" />Ver transcrição</>}
              </button>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">{extracted.titulo}</p>
            {showTranscricao && (
              <div className="mt-1 rounded-lg bg-white border border-emerald-100 px-3 py-2.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{extracted.transcricao}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Rascunho ──────────────────────────────────────────────────────── */}
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

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center justify-between rounded-xl border px-6 py-4",
        temaSelecionado ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50"
      )}>
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
              + referência ({tipoLabel[extracted.tipo]} · {extracted.plataforma})
            </p>
          )}
        </div>
        <Button onClick={irParaCopyStudio} disabled={!temaSelecionado}>
          Ir para Copy Studio
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
