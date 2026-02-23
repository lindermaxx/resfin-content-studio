# EPIC-02 — Módulo de Research

> **Status:** Done
> **Prioridade:** P1
> **Criado por:** @pm (Morgan)
> **Data:** 2026-02-22

## Objetivo

Implementar o módulo de pesquisa de trending topics: botão que busca trends reais, exibe cards selecionáveis com contexto e métricas, permite tema manual, cola de rascunho e extração opcional de URL de referência (Reels/TikTok/YouTube/artigo).

## Acceptance Criteria

- [x] Botão "Buscar Trends da Semana" chama `/api/research/trends` e retorna lista de trends
- [x] Cada trend exibe informações de contexto e métricas de viralização (quando disponíveis)
- [x] Max pode selecionar 1 trend por vez para trabalhar
- [x] Max pode ignorar os trends e digitar seu próprio tema
- [x] Max pode colar um rascunho de copy para o agente refinar
- [x] Ao confirmar tema/rascunho, app navega para Copy Studio com o contexto
- [x] Extração de URL de conteúdo de referência disponível em `/api/research/extract-url`
- [x] Monitoramento opcional de perfis concorrentes disponível em `/api/research/competitor-posts`

## Stories

- [x] 2.1 — API route Gemini trends (`/api/research/trends`)
- [x] 2.2 — Research UI (cards, seleção, input manual, draft copy)

## Dependências

EPIC-01 ✅ Done

## Bloqueia

EPIC-03 (Copy Studio precisa receber o tema do Research)
