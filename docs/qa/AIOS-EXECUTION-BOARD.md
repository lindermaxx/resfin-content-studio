# AIOS Execution Board

Date: 2026-02-23  
Project: resfin-content-studio

## Snapshot (2026-02-23)

- [x] Lane 2 / EPIC-04 concluída por `@dev` (Stories 4.1, 4.2, 4.3, 4.4)
- [x] Lane 3 / EPIC-05 concluída por `@dev` (Stories 5.1, 5.2)
- [ ] Lane 4 / QA E2E em andamento (code-level validado, runtime pós-deploy pendente)
- [x] Lane 5 / architect validação de contratos concluída
- [ ] Lane 1 / devops bloqueada apenas por schema não aplicado no Supabase produção

## Lane 1 - @devops

Task:
- Apply `docs/architecture/supabase-schema.sql` in Supabase.
- Confirm required env vars in Vercel for image generation providers.

Done when:
- [ ] Tables `posts` and `post_activity_log` exist and are queryable.
- [ ] Smoke check of existing routes still passes after schema apply.

Runtime checkpoint (2026-02-23):
- Deploy de produção atualizado com sucesso (Vercel status: completed no commit `5692350`)
- `/pipeline` e `/image` em produção já estão na versão nova (sem placeholder antigo)
- Rotas de imagem já publicadas em produção:
  - `POST /api/image/generate`
  - `PATCH /api/posts/:id/image`
- Bloqueio remanescente:
  - `GET /api/posts` => `500` (`Could not find the table 'public.posts' in the schema cache`)
  - mesma causa afeta endpoints de imagem/persistência de post

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

Done when:
- E2E flow passes: Research -> Copy -> Review -> Image -> Pipeline.
- QA evidence document includes request/response/status.

## Lane 5 - @architect

Task:
- Keep `docs/architecture/epic-04-05-architecture.md` as source of truth.
- Validate any contract changes from implementation PRs.

Done when:
- [x] API contracts and DB schema remain aligned with code.
