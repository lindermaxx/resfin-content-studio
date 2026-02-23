# AIOS Master Verification & Delegation Plan

Date: 2026-02-23
Agent: aios-master (Orion)
Project: resfin-content-studio
Updated at: 2026-02-23 (EPIC-04/05 delivery checkpoint)

## 1) Verification Summary

Completed in production:
- Fixed Apify actor path formatting (`/` -> `~`) for Research routes.
- Added resilient social-source fallback strategy in `trends` endpoint.
- Switched monitoring to curated hashtags + seed accounts + keywords.
- Added explicit and user-friendly quota-limit errors for Apify (402/403) in:
  - `/api/research/trends`
  - `/api/research/competitor-posts`
  - `/api/research/extract-url`
- Stabilized trends source priority to favor Instagram hashtag sources (direct URL strategy).

Current blocker validated in production:
- TikTok source remains unstable (timeout on actor execution in current environment).
- `competitor-posts` can return no public posts for specific handles; API now returns explicit 404 message with actionable guidance.

Current production status (latest validation):
- `POST /api/research/trends` stable with social-heavy payload:
  - Typical distribution: `Instagram=8`, `Google Trends=2` (10 total cards).
- `POST /api/research/extract-url` for Instagram URL: operational.
- `POST /api/research/competitor-posts`: operational with explicit no-data guidance when no public posts are found.

Production runtime checkpoint (2026-02-23, after EPIC-05 merge):
- `GET /api/posts` => `500` with error:
  - `Could not find the table 'public.posts' in the schema cache`
- `/pipeline` and `/image` pages in production still show placeholder version.
- `POST /api/image/generate` and `PATCH /api/posts/:id/image` return `404/405` in production,
  indicating deploy not yet updated to latest `main`.
- Vercel CLI is available locally but not authenticated (`vercel whoami` => no credentials).

Completed in codebase (pending post-deploy QA validation):
- EPIC-04 Story 4.2: Posts API completed
  - `/api/posts` (GET/POST)
  - `/api/posts/:id` (GET/PATCH)
  - `/api/posts/:id/status` (PATCH)
  - `/api/posts/:id/activity` (GET)
- EPIC-04 Story 4.1: `/review` implemented (editor + mockup + actions Aprovar/Rejeitar/Nova versão)
- EPIC-04 Story 4.3: `/pipeline` implemented (3 colunas + transições de status)
- EPIC-04 Story 4.4: timeline de atividade exibida por card no Pipeline
- Story docs updated to `Done` for `4.1`, `4.2`, `4.3`, `4.4`
- EPIC-05 Story 5.1: image API implemented
  - `/api/image/generate` (Google primary + OpenAI fallback)
  - `/api/posts/:id/image` (persistência de imagem selecionada)
- EPIC-05 Story 5.2: `/image` implemented
  - geração, regeneração, seleção e persistência da imagem
- Story docs updated to `Done` for `5.1`, `5.2`

## 2) Delegated Instructions by Agent

1. @devops (highest priority)
- Restore Apify capacity for this project (increase monthly hard limit / plan / token scope).
- Confirm `APIFY_API_TOKEN` in Vercel points to account with active usage quota.
- Execute production release ops:
  - authenticate Vercel CLI (or trigger deploy via dashboard)
  - redeploy `main` (commit `4c25b19`)
  - apply `docs/architecture/supabase-schema.sql` in production Supabase
  - validate image env vars in Vercel (`GOOGLE_AI_API_KEY`, `GOOGLE_IMAGE_MODEL`, `OPENAI_API_KEY`)
- After update, run smoke checks:
  - `POST /api/research/trends?debug=1`
  - `POST /api/research/competitor-posts`
  - `POST /api/research/extract-url`
  - `GET /api/posts`
  - `POST /api/image/generate`
  - `PATCH /api/posts/:id/image`
- Acceptance gate:
  - `trends` endpoint remains stable with social cards on consecutive calls.
  - `trends?debug=1` shows at least one active social source (`instagram > 0` or `tiktok > 0`).
  - `posts` and `image` endpoints respond with contract status (no `404` and no schema `500`).

2. @qa
- Execute regression on Research flow:
  - Trends fetch success and timeout behavior
  - Profiles monitored (list + no crashes)
  - URL extract for Instagram/TikTok/YouTube/article
- Execute regression on Image flow:
  - `/image` loading with approved post
  - generation endpoint success/fallback/error states
  - persistence of selected image on pipeline card
- Validate error UX text in Portuguese for quota-limit scenarios.
- Validate no-data scenario UX for monitored profiles (new explicit 404 message).
- Record evidence (request payload + response + status code) in QA notes.

3. @dev
- Keep current social monitoring config and make it data-driven if needed:
  - `RESEARCH_INSTAGRAM_HASHTAGS`
  - `RESEARCH_TIKTOK_HASHTAGS`
  - `RESEARCH_SEED_ACCOUNTS`
  - `RESEARCH_KEYWORDS`
- Remove debug-only payload fields from production response once QA passes.
- Resolve residual QA findings (if any) and proceed only with polishing/perf tasks.

4. @architect
- Validate long-term social ingestion strategy (cost/reliability):
  - Apify-only vs mixed providers
  - Quota-aware fallback policy
- Define architecture note for source-priority logic and fail-open vs fail-closed behavior.
- Validate EPIC-04/05 implementation against `docs/architecture/epic-04-05-architecture.md`
  and flag any contract divergence before release.

5. @pm / @sm / @po
- Track blocker as external dependency (Apify quota).
- Mark EPIC-04 and EPIC-05 as delivered and move execution focus to QA E2E sign-off.
- Use stories in `docs/stories/4.x` and `docs/stories/5.x` as source of truth.

## 3) Finalization Plan (Execution)

Phase A - Unblock Social Sources
1. Restore Apify quota/plan.
2. Re-run production debug checks.
3. Confirm social cards appear in Research.

Phase B - Validation Hardening
1. QA regression pass (Research endpoints + UX errors).
2. Remove debug fields and keep only operational logs.
3. Production smoke test and sign-off.

Phase C - Complete MVP Remaining Scope
1. [x] Implement EPIC-04 (Review + Pipeline).
2. [x] Implement EPIC-05 (Image Studio + fallback).
3. [ ] E2E validation for full funnel:
   Research -> Copy -> Review -> Image -> Pipeline.

## 4) AIOS Master Authorization

Authorization recorded:
- AIOS Master is authorized to continue delegation to agents and run each execution lane above without waiting for additional user prompts in this project scope.

