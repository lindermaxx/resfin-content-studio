# AIOS Master Verification & Delegation Plan

Date: 2026-02-23
Agent: aios-master (Orion)
Project: resfin-content-studio
Updated at: 2026-02-23 (post-deploy checkpoint `2448c8e`)

## 1) Verification Summary

Completed in production:
- Research endpoints remain operational with curated monitoring setup (hashtags, seeds, keywords).
- Apify actor-path bug (`404` by wrong id format) is no longer reproducing.
- `competitor-posts` now returns explicit no-data guidance when profiles have no public posts.
- Posts/pipeline runtime was unblocked in production via Storage fallback when SQL schema is absent.

Runtime verification after deploy `2448c8e`:
- `GET /api/posts` => `200`
- `POST /api/posts` => `201`
- `PATCH /api/posts/:id/status` => `200`
- `PATCH /api/posts/:id/image` => `200`
- `GET /api/posts/:id/activity` => `200`
- `POST /api/research/trends?debug=1` => `200` (Instagram active; TikTok may timeout)
- `POST /api/research/extract-url` => `200`
- `POST /api/research/competitor-posts` => functional `404` no-data (expected for some handles)

Remaining production items:
- Canonical Supabase schema (`public.posts`, `public.post_activity_log`) still pending manual apply.
- `POST /api/image/generate` currently returns provider error (`503` with `Google AI 404`) requiring env/model validation.

## 2) Delegated Instructions by Agent (Execution Order)

1. @qa (next agent)
- Execute E2E regression do funil completo:
  - Research -> Copy -> Review -> Image -> Pipeline.
- Validate UX for:
  - no-data monitored profiles,
  - provider error in image generation,
  - transitions/status persistence in pipeline.
- Attach evidence with status code + payload summary.

2. @devops
- Apply `docs/architecture/supabase-schema.sql` in Supabase production.
- Validate Vercel env vars for image generation:
  - `GOOGLE_AI_API_KEY`
  - `GOOGLE_IMAGE_MODEL`
  - `OPENAI_API_KEY`
- Re-run smoke checks after schema apply and image env correction.

3. @architect
- Update architecture note for dual-mode persistence:
  - canonical DB mode
  - temporary Storage fallback mode
- Define exit criteria to disable fallback after schema migration.

4. @dev
- Address residual QA findings.
- Keep current social-monitoring config data-driven and stable.
- Remove/debug-prune fields only after QA sign-off.

5. @pm / @sm / @po
- Mark EPIC-04/05 as delivered.
- Track remaining scope as:
  - infra hardening (schema apply + image provider config),
  - final QA sign-off.

## 3) Finalization Plan

Phase A - Stability (in progress)
1. [x] Publish latest production build with EPIC-04/05 routes.
2. [x] Remove posts schema outage impact via runtime fallback.
3. [ ] Fix image provider runtime (`Google AI 404`) and re-test.

Phase B - Canonical Infra
1. [ ] Apply Supabase schema SQL in production.
2. [ ] Verify parity between canonical DB and fallback contracts.
3. [ ] Disable fallback gate when DB path is healthy.

Phase C - Sign-off
1. [ ] QA E2E pass with evidence.
2. [ ] Production smoke pass (all critical endpoints).
3. [ ] Final completion handoff.

## 4) AIOS Master Authorization

Authorization recorded:
- AIOS Master remains authorized to continue delegation and execution in this project scope without additional user prompts.
