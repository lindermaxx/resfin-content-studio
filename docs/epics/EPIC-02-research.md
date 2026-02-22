# EPIC-02 — Módulo de Research

> **Status:** Ready
> **Prioridade:** P1
> **Criado por:** @pm (Morgan)
> **Data:** 2026-02-22

## Objetivo

Implementar o módulo de pesquisa de trending topics: botão que busca via Gemini API com Google Search grounding, exibe cards selecionáveis com tema/plataforma/pilar/hook, e permite ao Max digitar tema próprio ou colar rascunho de copy.

## Acceptance Criteria

- [ ] Botão "Buscar Trends da Semana" chama Gemini API e retorna 10 trending topics de finanças/medicina brasileira
- [ ] Cada trend exibe: título, plataforma, pilar de conteúdo e hook sugerido
- [ ] Max pode selecionar 1 ou mais trends
- [ ] Max pode ignorar os trends e digitar seu próprio tema
- [ ] Max pode colar um rascunho de copy para o agente refinar
- [ ] Ao confirmar tema/rascunho, app navega para Copy Studio com o contexto

## Stories

- [ ] 2.1 — API route Gemini trends (`/api/research/trends`)
- [ ] 2.2 — Research UI (cards, seleção, input manual, draft copy)

## Dependências

EPIC-01 ✅ Done

## Bloqueia

EPIC-03 (Copy Studio precisa receber o tema do Research)
