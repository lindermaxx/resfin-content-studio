# DevOps Runtime Check — Production

Date: 2026-02-23  
Agent: @devops

## Scope

- Validate production deployment state after EPIC-04/05 merges.
- Smoke test key endpoints in `https://resfin-content-studio.vercel.app`.

## Results

1. Research endpoint status
- `POST /api/research/trends?debug=1` responded successfully.
- Observed social-heavy payload (Instagram active, TikTok unstable timeout in debug failures).

2. Posts API status
- `GET /api/posts` returned `500`.
- Error payload:
  - `Erro ao buscar posts: Could not find the table 'public.posts' in the schema cache`
- Conclusion: production Supabase schema migration not applied for `posts` / `post_activity_log`.

3. Image flow endpoint status
- `POST /api/image/generate` returned `405` mapped to Vercel `404`.
- `PATCH /api/posts/:id/image` returned `405` mapped to Vercel `404`.
- Conclusion: production deployment currently serving older build without EPIC-05 routes.

4. UI deployment check
- `/pipeline` and `/image` pages still show placeholder UI in production.
- Confirms production deploy is behind latest `main`.

5. Deploy tooling status
- Vercel CLI available (`50.22.1`).
- `vercel whoami` failed with `No existing credentials found`.
- No local `.vercel/project.json` present.

## Follow-up (same date)

After commit `5692350`:
- GitHub status `Vercel`: **success** (`Deployment has completed`).
- Production UI updated:
  - `/pipeline` now renders new Kanban UI (not placeholder).
  - `/image` no longer serves old placeholder page.
- Production API routes for EPIC-05 are now published:
  - `POST /api/image/generate` responds from new route.
  - `PATCH /api/posts/:id/image` responds from new route.

Remaining blocker after deploy fix:
- All post/image endpoints still fail due missing DB schema in production Supabase:
  - `Could not find the table 'public.posts' in the schema cache`

## Required Actions (Ops)

1. Authenticate Vercel CLI or trigger deploy via dashboard.
2. Deploy latest `main` (`4c25b19`) to production.
3. Apply `docs/architecture/supabase-schema.sql` in production Supabase.
4. Validate Vercel env vars for image generation:
   - `GOOGLE_AI_API_KEY`
   - `GOOGLE_IMAGE_MODEL`
   - `OPENAI_API_KEY`
5. Re-run smoke checks for:
   - `GET /api/posts`
   - `POST /api/image/generate`
   - `PATCH /api/posts/:id/image`
   - plus existing Research routes.
