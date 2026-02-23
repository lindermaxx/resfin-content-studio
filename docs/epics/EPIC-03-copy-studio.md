# EPIC-03 — Copy Studio (Claude API + Leandro Ladeira)

> **Status:** Done
> **Prioridade:** P1
> **Data:** 2026-02-22

## Objetivo

Implementar o módulo de geração de copy: usuário seleciona formato e voz, Claude API com persona Leandro Ladeira gera 3 ideias (educativo, provocativo, storytelling). Se houver rascunho colado no Research, o agente refina em vez de criar do zero.

## Stories

- [x] 3.1 — API route Claude (`/api/copy/generate`)
- [x] 3.2 — Copy Studio UI (seleção de formato/voz, cards de ideias)

## Dependências

EPIC-02 ✅ Done — contexto do Research via sessionStorage
