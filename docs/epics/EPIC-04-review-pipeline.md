# EPIC-04 — Review + Pipeline (mockup, status, persistência)

> **Status:** Ready
> **Prioridade:** P1
> **Criado por:** @pm (Morgan)
> **Data:** 2026-02-23

## Objetivo

Implementar o fluxo pós-copy: revisão visual da copy aprovada, persistência no banco e gestão do pipeline de conteúdo em 3 estados (`pending`, `approved`, `published`).

## Acceptance Criteria

- [ ] Tela `/review` renderiza mockup do post com a copy selecionada no Copy Studio
- [ ] Usuário consegue editar a copy inline antes de aprovar
- [ ] Ações disponíveis no Review: Aprovar, Rejeitar, Nova versão
- [ ] Post aprovado é salvo/atualizado no Supabase com metadados completos
- [ ] Tela `/pipeline` mostra 3 colunas (Pending, Approved, Published) com cards reais
- [ ] Mudança de status no Pipeline persiste no Supabase
- [ ] Log de atividade de mudança de status é registrado por post

## Stories

- [ ] 4.1 — Review UI + ações de aprovação/rejeição
- [ ] 4.2 — API de posts + persistência Supabase
- [ ] 4.3 — Pipeline Kanban com transição de status
- [ ] 4.4 — Activity log do post

## Dependências

EPIC-03 ✅ Done

## Bloqueia

EPIC-05 (Image Studio usa post aprovado como entrada)
