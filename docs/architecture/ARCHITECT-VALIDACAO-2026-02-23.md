# Architect Validation — EPIC-04/05

Date: 2026-02-23  
Agent: @architect

## Contract Check

- `POST /api/posts` implemented.
- `GET /api/posts` implemented.
- `GET /api/posts/:id` implemented.
- `PATCH /api/posts/:id` implemented.
- `PATCH /api/posts/:id/status` implemented.
- `GET /api/posts/:id/activity` implemented.
- `POST /api/image/generate` implemented.
- `PATCH /api/posts/:id/image` implemented.

## Schema Alignment

- Table `posts` fields used by API/UI are consistent with `docs/architecture/supabase-schema.sql`.
- Table `post_activity_log` event types used by code are consistent with schema:
  - `created`
  - `edited`
  - `status_changed`
  - `image_generated`
  - `image_selected`

## UI Alignment

- `/review` no longer placeholder and persists editable fields in API contract.
- `/pipeline` no longer placeholder and transitions status via API.
- `/image` no longer placeholder and persists selected image in post.

## Residual Risks

- Runtime smoke for provider-specific image generation (Google/OpenAI) depends on valid env vars and deployed environment.
- Production fallback behavior must be validated by QA with live credentials.
