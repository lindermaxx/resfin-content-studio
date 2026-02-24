"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StrategyMessage, StrategySession } from "@/lib/research-types";

function currentMonthRef(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeMessage(value: unknown): StrategyMessage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const role =
    raw.role === "assistant" ? "assistant" : raw.role === "user" ? "user" : null;
  const content = typeof raw.content === "string" ? raw.content.trim() : "";
  if (!role || !content) return null;
  return {
    role,
    content,
    created_at:
      typeof raw.created_at === "string"
        ? raw.created_at
        : new Date().toISOString(),
  };
}

function normalizeSession(value: unknown): StrategySession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const monthRef = typeof raw.month_ref === "string" ? raw.month_ref : "";
  const objective = typeof raw.objective === "string" ? raw.objective : "";
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((item) => normalizeMessage(item))
        .filter((item): item is StrategyMessage => item !== null)
    : [];

  if (!id || !monthRef || !objective || messages.length === 0) return null;

  return {
    id,
    month_ref: monthRef,
    objective,
    messages,
    created_at:
      typeof raw.created_at === "string"
        ? raw.created_at
        : new Date().toISOString(),
    updated_at:
      typeof raw.updated_at === "string"
        ? raw.updated_at
        : new Date().toISOString(),
  };
}

export default function StrategyPage() {
  const router = useRouter();
  const [monthRef, setMonthRef] = useState(currentMonthRef());
  const [objective, setObjective] = useState(
    "Definir calendário mensal com Big Ideas de Light Copy para médicos de alta renda."
  );
  const [sessions, setSessions] = useState<StrategySession[]>([]);
  const [messages, setMessages] = useState<StrategyMessage[]>([]);
  const [prompt, setPrompt] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasAssistantResponse = useMemo(
    () => messages.some((message) => message.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    let active = true;

    async function loadSessions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/strategy/sessions", {
          cache: "no-store",
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
              : "Erro ao carregar sessões de estratégia.";
          throw new Error(apiError);
        }

        const parsed = Array.isArray(data)
          ? data
              .map((item) => normalizeSession(item))
              .filter((item): item is StrategySession => item !== null)
          : [];

        if (!active) return;
        setSessions(parsed);

        const currentSession = parsed.find((session) => session.month_ref === monthRef);
        if (currentSession) {
          setObjective(currentSession.objective);
          setMessages(currentSession.messages);
        }
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Erro ao carregar sessões de estratégia."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSessions();

    return () => {
      active = false;
    };
  }, [monthRef]);

  async function sendToGemini() {
    const trimmedPrompt = prompt.trim();
    const trimmedObjective = objective.trim();
    if (!trimmedPrompt || !trimmedObjective) return;

    const userMessage: StrategyMessage = {
      role: "user",
      content: trimmedPrompt,
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];

    setSending(true);
    setError(null);
    setSuccess(null);
    setMessages(nextMessages);
    setPrompt("");

    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month_ref: monthRef,
          objective: trimmedObjective,
          messages: nextMessages,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            message?: StrategyMessage;
            session?: StrategySession;
            error?: string;
          }
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao conversar com Gemini.");
      }

      const session = data?.session ? normalizeSession(data.session) : null;
      if (!session) {
        throw new Error("Resposta inválida do servidor para sessão de estratégia.");
      }

      setMessages(session.messages);
      setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setSuccess("Estratégia atualizada e salva.");
    } catch (err) {
      setMessages(messages);
      setError(
        err instanceof Error ? err.message : "Erro ao conversar com Gemini."
      );
    } finally {
      setSending(false);
    }
  }

  async function saveCurrentSession() {
    const trimmedObjective = objective.trim();
    if (!trimmedObjective || messages.length === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/strategy/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month_ref: monthRef,
          objective: trimmedObjective,
          messages,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | StrategySession
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? (data.error ?? "Erro ao salvar estratégia.")
            : "Erro ao salvar estratégia."
        );
      }

      const session = normalizeSession(data);
      if (!session) throw new Error("Sessão salva em formato inválido.");

      setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setSuccess("Sessão salva com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar estratégia.");
    } finally {
      setSaving(false);
    }
  }

  function openSession(session: StrategySession) {
    setMonthRef(session.month_ref);
    setObjective(session.objective);
    setMessages(session.messages);
    setError(null);
    setSuccess(null);
  }

  function goToResearch() {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (latestAssistant) {
      sessionStorage.setItem(
        "resfin_strategy_context",
        JSON.stringify({
          month_ref: monthRef,
          objective: objective.trim(),
          summary: latestAssistant.content,
        })
      );
    }
    router.push("/research");
  }

  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
          <CalendarDays className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Estratégia Mensal</h1>
          <p className="text-sm text-zinc-500">
            Defina Big Ideas e calendário com Gemini alinhado ao Light Copy
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700">Parâmetros do mês</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="month_ref" className="text-xs font-medium text-zinc-500">
              Mês de referência
            </label>
            <input
              id="month_ref"
              type="month"
              value={monthRef}
              onChange={(event) => setMonthRef(event.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="objective" className="text-xs font-medium text-zinc-500">
              Objetivo estratégico
            </label>
            <textarea
              id="objective"
              rows={4}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveCurrentSession}
              disabled={saving || messages.length === 0 || !objective.trim()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar sessão
            </Button>
            <Button
              size="sm"
              onClick={goToResearch}
              disabled={!hasAssistantResponse}
            >
              Banco de Conteúdo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Sessões salvas
              </h3>
              <Badge variant="secondary">{sessions.length}</Badge>
            </div>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando sessões...
                </div>
              ) : sessions.length > 0 ? (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => openSession(session)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      session.month_ref === monthRef
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{session.month_ref}</span>
                      <span className="text-[11px] opacity-75">
                        {formatDateLabel(session.updated_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs opacity-90">
                      {session.objective}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-zinc-500">
                  Nenhuma sessão salva ainda para estratégia mensal.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-medium text-zinc-700">
              Janela IA Gemini ({monthRef})
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Faça perguntas para chegar em Big Ideas e calendário do mês.
            </p>
          </div>

          <div className="flex max-h-[520px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                Comece com um prompt: objetivos do mês, ofertas foco, temas de mercado e
                restrições.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.created_at}-${index}`}
                  className={cn(
                    "max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "assistant"
                      ? "self-start border border-zinc-200 bg-zinc-50 text-zinc-800"
                      : "self-end bg-zinc-900 text-white"
                  )}
                >
                  <div className="mb-1 flex items-center gap-1 text-[11px] opacity-75">
                    {message.role === "assistant" ? (
                      <Sparkles className="h-3 w-3" />
                    ) : null}
                    <span>
                      {message.role === "assistant" ? "Gemini" : "Você"} |{" "}
                      {formatDateLabel(message.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-4">
            <div className="flex gap-2">
              <textarea
                rows={3}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex: monte 6 Big Ideas para março com foco em médicos PJ e IRPF..."
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
              <Button
                className="self-end"
                onClick={sendToGemini}
                disabled={sending || !prompt.trim() || !objective.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
    </div>
  );
}
