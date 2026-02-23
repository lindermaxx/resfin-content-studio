# AIOS Execution Board

Date: 2026-02-23  
Project: resfin-content-studio

## Lane 1 - @devops

Task:
- Apply `docs/architecture/supabase-schema.sql` in Supabase.
- Confirm required env vars in Vercel for image generation providers.

Done when:
- Tables `posts` and `post_activity_log` exist and are queryable.
- Smoke check of existing routes still passes after schema apply.

## Lane 2 - @dev (EPIC-04)

Task:
- Implement Story 4.2 first (posts API).
- Implement Story 4.1 (Review UI with approve/reject/new version).
- Implement Story 4.3 (Pipeline board with status transitions).
- Implement Story 4.4 (activity log visualization).

Done when:
- `/review` and `/pipeline` are no longer placeholders.
- Status transitions are persisted and logged.

## Lane 3 - @dev (EPIC-05)

Task:
- Implement Story 5.1 (`/api/image/generate` with fallback).
- Implement Story 5.2 (`/image` UI + selection + save).

Done when:
- `/image` is no longer placeholder.
- Selected image is persisted and visible in pipeline.

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
- API contracts and DB schema remain aligned with code.

