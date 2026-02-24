"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ContentBankItem, ExtractedContent } from "@/lib/research-types";

const TRANSIENT_REFERENCE_ID = "__transient__";

interface StrategyContext {
  month_ref: string;
  objective: string;
  summary: string;
}

interface CopyContext {
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

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeExtracted(value: unknown): ExtractedContent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const titulo = toText(raw.titulo);
  const plataforma = toText(raw.plataforma);
  const transcricao = toText(raw.transcricao);
  const tipo =
    raw.tipo === "reels" ||
    raw.tipo === "carrossel" ||
    raw.tipo === "video" ||
    raw.tipo === "artigo" ||
    raw.tipo === "post"
      ? raw.tipo
      : null;

  if (!titulo || !plataforma || !transcricao || !tipo) return null;
  return { titulo, plataforma, transcricao, tipo };
}

function normalizeContentItem(value: unknown): ContentBankItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = toText(raw.id);
  const sourceUrl = toText(raw.source_url);
  const titulo = toText(raw.titulo);
  const plataforma = toText(raw.plataforma);
  const transcricao = toText(raw.transcricao);
  const tipo =
    raw.tipo === "reels" ||
    raw.tipo === "carrossel" ||
    raw.tipo === "video" ||
    raw.tipo === "artigo" ||
    raw.tipo === "post"
      ? raw.tipo
      : null;

  if (!id || !sourceUrl || !titulo || !plataforma || !transcricao || !tipo) return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  return {
    id,
    source_url: sourceUrl,
    titulo,
    plataforma,
    transcricao,
    tipo,
    tags,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    created_at: toText(raw.created_at) || new Date().toISOString(),
    updated_at: toText(raw.updated_at) || new Date().toISOString(),
  };
}

function normalizeItems(value: unknown): ContentBankItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeContentItem(item))
    .filter((item): item is ContentBankItem => item !== null);
}

function normalizeTagsInput(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

function formatPlatformType(item: { plataforma: string; tipo: string }) {
  return `${item.plataforma} | ${item.tipo}`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function ResearchPage() {
  const router = useRouter();

  const [urlRef, setUrlRef] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const [items, setItems] = useState<ContentBankItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    null
  );

  const [tema, setTema] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [strategyContext, setStrategyContext] = useState<StrategyContext | null>(
    null
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const joined = [
        item.titulo,
        item.plataforma,
        item.tipo,
        item.transcricao,
        item.source_url,
        item.notes ?? "",
        item.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return joined.includes(query);
    });
  }, [items, searchTerm]);

  const selectedItem = useMemo(
    () =>
      selectedReferenceId && selectedReferenceId !== TRANSIENT_REFERENCE_ID
        ? items.find((item) => item.id === selectedReferenceId) ?? null
        : null,
    [items, selectedReferenceId]
  );

  useEffect(() => {
    const raw = sessionStorage.getItem("resfin_strategy_context");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StrategyContext;
      if (
        parsed &&
        typeof parsed.month_ref === "string" &&
        typeof parsed.objective === "string" &&
        typeof parsed.summary === "string"
      ) {
        setStrategyContext(parsed);
      }
    } catch {
      // ignore invalid strategy context
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBank() {
      setLoadingItems(true);
      setItemsError(null);
      try {
        const res = await fetch("/api/content-bank", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | unknown
          | { error?: string };
        if (!res.ok) {
          const apiError =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Erro ao carregar banco de conteúdo.";
          throw new Error(apiError);
        }
        if (!active) return;
        setItems(normalizeItems(data));
      } catch (err) {
        if (!active) return;
        setItemsError(
          err instanceof Error ? err.message : "Erro ao carregar banco de conteúdo."
        );
      } finally {
        if (active) setLoadingItems(false);
      }
    }

    void loadBank();
    return () => {
      active = false;
    };
  }, []);

  async function extrairUrl() {
    const target = urlRef.trim();
    if (!target) return;

    setExtracting(true);
    setExtractError(null);
    setExtracted(null);
    try {
      const res = await fetch("/api/research/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });

      const data = (await res.json().catch(() => null)) as
        | unknown
        | { error?: string };
      if (!res.ok) {
        const apiError =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Erro ao extrair conteúdo da URL.";
        throw new Error(apiError);
      }

      const normalized = normalizeExtracted(data);
      if (!normalized) {
        throw new Error("Resposta inválida da extração de conteúdo.");
      }

      setExtracted(normalized);
      setSelectedReferenceId(TRANSIENT_REFERENCE_ID);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Erro ao extrair conteúdo."
      );
    } finally {
      setExtracting(false);
    }
  }

  async function salvarNoBanco() {
    if (!extracted || !urlRef.trim()) return;

    setSavingItem(true);
    setItemsError(null);
    try {
      const res = await fetch("/api/content-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: urlRef.trim(),
          titulo: extracted.titulo,
          plataforma: extracted.plataforma,
          tipo: extracted.tipo,
          transcricao: extracted.transcricao,
          tags: normalizeTagsInput(tagsInput),
          notes: notesInput.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | unknown
        | { error?: string };
      if (!res.ok) {
        const apiError =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Erro ao salvar referência no banco.";
        throw new Error(apiError);
      }

      const item = normalizeContentItem(data);
      if (!item) throw new Error("Item salvo em formato inválido.");

      setItems((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)]);
      setSelectedReferenceId(item.id);
      setTagsInput("");
      setNotesInput("");
    } catch (err) {
      setItemsError(
        err instanceof Error ? err.message : "Erro ao salvar referência."
      );
    } finally {
      setSavingItem(false);
    }
  }

  async function removerItem(itemId: string) {
    setDeletingId(itemId);
    setItemsError(null);
    try {
      const res = await fetch(`/api/content-bank/${itemId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Erro ao remover item do banco.");
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (selectedReferenceId === itemId) setSelectedReferenceId(null);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Erro ao remover item.");
    } finally {
      setDeletingId(null);
    }
  }

  function selecionarItem(itemId: string) {
    setSelectedReferenceId((prev) => (prev === itemId ? null : itemId));
  }

  function usarExtracaoAtual() {
    if (!extracted) return;
    setSelectedReferenceId((prev) =>
      prev === TRANSIENT_REFERENCE_ID ? null : TRANSIENT_REFERENCE_ID
    );
  }

  function irParaCopy() {
    const temaFinal = tema.trim() || selectedItem?.titulo || extracted?.titulo || "";
    if (!temaFinal) return;

    const usingTransient = selectedReferenceId === TRANSIENT_REFERENCE_ID && extracted;
    const contextoViral = selectedItem?.transcricao ?? (usingTransient ? extracted.transcricao : null);
    const plataforma = selectedItem?.plataforma ?? (usingTransient ? extracted.plataforma : null);
    const sourceUrl = selectedItem?.source_url ?? (usingTransient ? urlRef.trim() : null);

    const context: CopyContext = {
      tema: temaFinal,
      pilar: strategyContext?.objective ?? null,
      hook: null,
      rascunho: rascunho.trim(),
      source: contextoViral ? "trend" : "manual",
      contextoViral,
      plataforma,
      metricas: [],
      url: sourceUrl || null,
    };

    sessionStorage.setItem("resfin_research_context", JSON.stringify(context));
    router.push("/copy");
  }

  const canGoToCopy = Boolean(
    tema.trim() || selectedItem?.titulo || (selectedReferenceId === TRANSIENT_REFERENCE_ID && extracted?.titulo)
  );

  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <BookOpen className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Banco de Conteúdo</h1>
          <p className="text-sm text-zinc-500">
            Salve referências e extraia legenda/transcrição para inspirar o Copy Studio
          </p>
        </div>
      </div>

      {strategyContext && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Estratégia ativa ({strategyContext.month_ref})
              </span>
              <p className="text-sm text-emerald-800">{strategyContext.objective}</p>
              <p className="mt-1 line-clamp-3 text-xs text-emerald-700">
                {strategyContext.summary}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
              onClick={() => router.push("/strategy")}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Revisar estratégia
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-700">Extrair nova referência</h2>
          <Badge variant="secondary">Manual</Badge>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="url"
            value={urlRef}
            onChange={(event) => setUrlRef(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void extrairUrl();
              }
            }}
            placeholder="https://www.instagram.com/reel/... ou post/carrossel/artigo"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <Button
            variant="outline"
            onClick={extrairUrl}
            disabled={extracting || !urlRef.trim()}
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
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {extractError}
          </div>
        )}

        {extracted && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    {formatPlatformType(extracted)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-900">{extracted.titulo}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={usarExtracaoAtual}
                className={cn(
                  "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100",
                  selectedReferenceId === TRANSIENT_REFERENCE_ID &&
                    "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-700"
                )}
              >
                Selecionar para Copy
              </Button>
            </div>

            <p className="mt-3 line-clamp-5 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-zinc-700">
              {extracted.transcricao}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="tags separadas por vírgula: irpf, cdb, planejamento"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
              <input
                type="text"
                value={notesInput}
                onChange={(event) => setNotesInput(event.target.value)}
                placeholder="nota rápida sobre por que essa referência importa"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <Button onClick={salvarNoBanco} disabled={savingItem}>
                {savingItem ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Salvar no banco
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-700">
            Referências salvas ({items.length})
          </h2>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por título, tag, transcrição..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {itemsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {itemsError}
          </div>
        )}

        {loadingItems ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando banco de conteúdo...
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredItems.map((item) => {
              const selected = selectedReferenceId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border bg-white p-4 transition-colors",
                    selected
                      ? "border-zinc-900 shadow-sm"
                      : "border-zinc-200 hover:border-zinc-400"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{item.titulo}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatPlatformType(item)} | Atualizado em {formatDate(item.updated_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItem(item.id)}
                      disabled={deletingId === item.id}
                      className="h-8 w-8 text-zinc-400 hover:text-red-600"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-zinc-600">
                    {item.transcricao}
                  </p>

                  {(item.tags.length > 0 || item.notes) && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={`${item.id}-${tag}`} variant="secondary" className="text-[11px]">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-xs text-zinc-500">Nota: {item.notes}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-500 underline underline-offset-2"
                    >
                      Abrir link original
                    </a>
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => selecionarItem(item.id)}
                    >
                      {selected ? "Selecionado" : "Selecionar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-8 text-center text-sm text-zinc-500">
            Nenhuma referência encontrada para esse filtro.
          </div>
        )}
      </div>

      <Separator />

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-700">Preparar ida para Copy Studio</h2>
        <div className="mt-3 flex flex-col gap-3">
          <input
            type="text"
            value={tema}
            onChange={(event) => setTema(event.target.value)}
            placeholder="Tema da peça. Se vazio, usa título da referência selecionada."
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <textarea
            rows={4}
            value={rascunho}
            onChange={(event) => setRascunho(event.target.value)}
            placeholder="Rascunho opcional para o agente refinar no método Light Copy."
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="text-sm text-zinc-600">
            {selectedItem ? (
              <>Referência selecionada: <span className="font-medium text-zinc-900">{selectedItem.titulo}</span></>
            ) : selectedReferenceId === TRANSIENT_REFERENCE_ID && extracted ? (
              <>Referência selecionada: <span className="font-medium text-zinc-900">{extracted.titulo}</span> (ainda não salva)</>
            ) : (
              "Nenhuma referência selecionada. O copy será gerado apenas pelo tema informado."
            )}
          </div>
          <Button onClick={irParaCopy} disabled={!canGoToCopy}>
            Ir para Copy Studio
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
