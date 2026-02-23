# QA Validation — EPIC-05

Date: 2026-02-23  
Agent: @qa

## Scope

- Story 5.1 (`/api/image/generate` + fallback + persistência)
- Story 5.2 (`/image` UI)
- Integração com Pipeline (badge `Com imagem`)

## Checks Executed

1. Static contract validation
- Route `src/app/api/image/generate/route.ts` validates input and returns contract `{ provider, prompt_used, variants }`.
- Route `src/app/api/posts/[id]/image/route.ts` persists `imagem_url`, `imagem_provider`, `imagem_prompt`.
- Activity log events for image flow are emitted (`image_generated`, `image_selected`).

2. UI flow validation (code-level)
- `src/app/image/page.tsx` carrega `postId` de query/session.
- Geração e regeneração usam `/api/image/generate`.
- Seleção única de variação e persistência via `/api/posts/:id/image`.
- Tratamento de estados: loading, erro, vazio e sucesso.

3. Quality gate
- `npm run lint` executado com sucesso (sem erros).

## Result

- Status: **PASS (code + lint)**
- Bloqueios: **nenhum bloqueio de código**

## Remaining Runtime Validation (post-deploy)

- Validar geração real com `GOOGLE_AI_API_KEY` ativo.
- Forçar erro no Google e validar fallback real para OpenAI.
- Validar persistência fim-a-fim no ambiente de produção:
  - Review -> Image -> Pipeline com imagem aparecendo no card.
