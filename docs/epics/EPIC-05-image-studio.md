# EPIC-05 — Image Studio (geração e seleção de imagem)

> **Status:** Ready
> **Prioridade:** P2
> **Criado por:** @pm (Morgan)
> **Data:** 2026-02-23

## Objetivo

Implementar geração de imagem a partir da copy aprovada, com múltiplas variações, seleção final e fallback automático quando o provedor principal falhar.

## Acceptance Criteria

- [ ] Tela `/image` carrega contexto do post aprovado (tema + copy + visual sugerido)
- [ ] API `/api/image/generate` gera 2-4 variações por requisição
- [ ] Fluxo usa provedor principal configurado e fallback automático para OpenAI
- [ ] Usuário consegue selecionar uma imagem e salvar no post
- [ ] Usuário consegue regenerar com instrução adicional (refine prompt)
- [ ] Imagem final aparece no Pipeline vinculada ao post

## Stories

- [ ] 5.1 — API de geração de imagem com fallback
- [ ] 5.2 — UI Image Studio + seleção + regeneração

## Dependências

EPIC-04 ✅ Done

## Bloqueia

Entrega final do MVP ponta a ponta
