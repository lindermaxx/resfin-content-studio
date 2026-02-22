# EPIC-01 — Setup & Infraestrutura

> **Status:** Ready
> **Prioridade:** P0 — Bloqueia todos os outros épicos
> **Criado por:** @pm (Morgan)
> **Data:** 2026-02-22

## Objetivo

Criar a base técnica do projeto: repositório Next.js configurado, deploy automático no Vercel, variáveis de ambiente das APIs e Vercel KV funcionando. Sem isso nenhum outro épico pode ser implementado.

## Acceptance Criteria

- [ ] Repositório Next.js 14 (App Router) criado com TypeScript + Tailwind + shadcn/ui
- [ ] Deploy automático no Vercel via GitHub configurado
- [ ] Vercel KV provisionado e conectado ao projeto
- [ ] Variáveis de ambiente configuradas no Vercel: `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`
- [ ] Página inicial do app abre no browser sem erros
- [ ] Layout base com navegação entre os 5 módulos (Research / Copy / Review / Image / Pipeline)

## Stories

- [x] 1.1 — Criar projeto Next.js e configurar repositório GitHub
- [x] 1.2 — Deploy Vercel + Supabase + variáveis de ambiente

## Dependências

Nenhuma — é o ponto de partida.

## Bloqueia

EPIC-02, EPIC-03, EPIC-04, EPIC-05
