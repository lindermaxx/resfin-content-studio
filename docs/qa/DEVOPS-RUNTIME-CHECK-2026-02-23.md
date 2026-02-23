# DevOps Runtime Check — Production

Date: 2026-02-23  
Agent: @devops

## Scope

- Validate production deployment state after EPIC-04/05 merges.
- Validate research and posts/image runtime after latest hotfix deploy.

## Historical Context (same date)

Initial blockers observed earlier:
- `GET /api/posts` => `500` with schema-cache error (`public.posts` missing).
- `POST /api/image/generate` and `PATCH /api/posts/:id/image` were not yet published in old deploy.

After deploy `5692350`:
- New UI/routes were published.
- Schema blocker remained (`public.posts` missing).

## Current Fix Applied

Commit: `2448c8e`  
Deploy status: **success** (`Vercel` check completed)

Runtime mitigation implemented:
- Added automatic fallback to Supabase Storage when schema for `posts`/`post_activity_log` is missing.
- Endpoints now persist and read post/activity data from Storage fallback without breaking API contracts.

Files touched by runtime mitigation:
- `src/lib/posts-service.ts`
- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/app/api/posts/[id]/status/route.ts`
- `src/app/api/posts/[id]/activity/route.ts`
- `src/app/api/posts/[id]/image/route.ts`
- `src/app/api/image/generate/route.ts`

## Production Smoke Results (post-deploy `2448c8e`)

1. Posts and pipeline data flow
- `GET /api/posts` => `200`
- `POST /api/posts` => `201` (new post created)
- `PATCH /api/posts/:id/status` => `200`
- `PATCH /api/posts/:id/image` => `200`
- `GET /api/posts/:id/activity` => `200`

2. Research flow
- `POST /api/research/trends?debug=1` => `200`
  - Social-heavy payload with Instagram active.
  - TikTok source still can timeout (known external instability).
- `POST /api/research/competitor-posts` => functional `404` (no public posts found), no actor-path `404` error.
- `POST /api/research/extract-url` => `200` for Instagram URL.

3. Image generation
- `POST /api/image/generate` => `503` with `Google AI 404` in current provider config.
- Endpoint behavior is operational (no schema crash), but image provider env/model needs devops tuning.

## Current Status

- Critical production outage for posts/pipeline is resolved via runtime fallback.
- MVP flow can continue while SQL schema access is pending.
- Remaining infra task:
  - Apply `docs/architecture/supabase-schema.sql` in Supabase when admin access path is available.
- Remaining provider task:
  - Validate image provider configuration (`GOOGLE_AI_API_KEY`, `GOOGLE_IMAGE_MODEL`, `OPENAI_API_KEY`).

## Next Ops Actions

1. Apply SQL schema in Supabase to move from fallback to canonical tables.
2. Revalidate image generation model/provider configuration in Vercel env.
3. Run final E2E QA sign-off (Research -> Copy -> Review -> Image -> Pipeline).
