# AIOS Execution Board

Date: 2026-02-23  
Project: resfin-content-studio

## Snapshot (updated 2026-02-23)

- [x] Lane 2 / EPIC-04 concluída por `@dev` (Stories 4.1, 4.2, 4.3, 4.4)
- [x] Lane 3 / EPIC-05 concluída por `@dev` (Stories 5.1, 5.2)
- [x] Lane 1 / devops desbloqueou runtime de posts com fallback em produção
- [ ] Lane 4 / QA E2E em andamento (funnel completo ainda pendente)
- [x] Lane 5 / architect validação de contratos concluída

## Lane 1 - @devops

Task:
- Apply `docs/architecture/supabase-schema.sql` in Supabase (canonical DB path).
- Keep production stable meanwhile via runtime fallback.
- Confirm image provider env vars in Vercel.

Done when:
- [x] `GET /api/posts` and status/image/activity routes respond sem schema `500`.
- [ ] Tables `posts` and `post_activity_log` exist in Supabase e fallback pode ser desativado.
- [ ] `POST /api/image/generate` validado com provider ativo no ambiente.

Runtime checkpoint (2026-02-23):
- Deploy `2448c8e` concluído com sucesso.
- Post flow em produção funcional com fallback:
  - `GET /api/posts` => `200`
  - `POST /api/posts` => `201`
  - `PATCH /api/posts/:id/status` => `200`
  - `PATCH /api/posts/:id/image` => `200`
  - `GET /api/posts/:id/activity` => `200`
- Research endpoints estáveis:
  - `POST /api/research/trends?debug=1` => `200` (Instagram ativo)
  - `POST /api/research/competitor-posts` => `404` funcional de no-data (sem erro de actor 404)
  - `POST /api/research/extract-url` => `200`
- Ponto pendente:
  - `POST /api/image/generate` => `503` (`Google AI 404`) por configuração/modelo de provider.

## Lane 2 - @dev (EPIC-04)

Task:
- [x] Implement Story 4.2 first (posts API).
- [x] Implement Story 4.1 (Review UI with approve/reject/new version).
- [x] Implement Story 4.3 (Pipeline board with status transitions).
- [x] Implement Story 4.4 (activity log visualization).

Done when:
- [x] `/review` and `/pipeline` are no longer placeholders.
- [x] Status transitions are persisted and logged.

## Lane 3 - @dev (EPIC-05)

Task:
- [x] Implement Story 5.1 (`/api/image/generate` with fallback).
- [x] Implement Story 5.2 (`/image` UI + selection + save).

Done when:
- [x] `/image` is no longer placeholder.
- [x] Selected image is persisted and visible in pipeline.

## Lane 4 - @qa

Task:
- Regression for Research endpoints and UI.
- Validate EPIC-04/05 end-to-end flow.
- Validate Portuguese error UX and no-data paths.
- Validate image generation error/fallback messaging for provider failures.

Done when:
- E2E flow passes: Research -> Copy -> Review -> Image -> Pipeline.
- QA evidence document includes request/response/status.

## Lane 5 - @architect

Task:
- Keep `docs/architecture/epic-04-05-architecture.md` as source of truth.
- Validate fallback strategy note while schema migration remains pending.

Done when:
- [x] API contracts remain aligned with UI.
- [ ] Architecture note updated for canonical-DB + runtime-fallback transition.
