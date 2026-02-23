# EPIC-04/05 Architecture (Review, Pipeline, Image)

Date: 2026-02-23  
Owner: @architect

## 1) Scope

This architecture covers:
- EPIC-04: Review + Pipeline + persistence
- EPIC-05: Image generation + selection + persistence

Out of scope:
- Instagram auto-publishing
- multi-user auth and RBAC (single operator for MVP)

## 2) Core Decisions

1. Persistence uses Supabase Postgres with two tables:
- `posts`
- `post_activity_log`

2. Status lifecycle is constrained:
- `pending` -> `approved` -> `published`
- `approved` -> `pending` allowed (rework)
- `published` is terminal in MVP

3. API routes are server-only (`service role`) and are the only write path.

4. Image generation endpoint returns normalized variants and supports provider fallback.

## 3) Data Model (Logical)

### posts

- `id` UUID PK
- `created_at`, `updated_at`
- `status` (`pending|approved|published`)
- `status_updated_at`, `approved_at`, `published_at`
- `tema`, `pilar`, `source`, `source_url`, `hook`, `rascunho`
- `formato`, `voz`
- `copy_text`, `visual_descricao`, `cta`, `keyword_manychat`
- `contexto_viral`, `plataforma_origem`, `metricas` (JSON array)
- `imagem_url`, `imagem_prompt`, `imagem_provider`
- `notes`

### post_activity_log

- `id` UUID PK
- `post_id` FK -> posts.id
- `event_type` (`created|edited|status_changed|image_generated|image_selected`)
- `from_status`, `to_status` (nullable)
- `actor` (default `system`)
- `payload` JSON
- `created_at`

## 4) API Contracts

### POST `/api/posts`
Create post from selected idea in Copy/Review.

Request:
```json
{
  "tema": "string",
  "pilar": "string|null",
  "source": "trend|manual",
  "source_url": "string|null",
  "hook": "string|null",
  "rascunho": "string",
  "formato": "carrossel|post_estatico|reels|stories",
  "voz": "max_linder|rian_tavares|marca_institucional",
  "copy_text": "string",
  "visual_descricao": "string",
  "cta": "string",
  "keyword_manychat": "string|null",
  "contexto_viral": "string|null",
  "plataforma_origem": "string|null",
  "metricas": ["string"]
}
```

Response: created post (`201`).

### GET `/api/posts?status=pending|approved|published`
List posts for pipeline, ordered by `updated_at desc`.

Response: array of posts (`200`).

### GET `/api/posts/:id`
Fetch full post detail for Review/Image modal.

Response: post object (`200`) or `404`.

### PATCH `/api/posts/:id`
Edit fields allowed in Review:
- `copy_text`
- `visual_descricao`
- `cta`
- `notes`

Response: updated post (`200`).

### PATCH `/api/posts/:id/status`
Transition post status.

Request:
```json
{ "status": "pending|approved|published" }
```

Rules:
- reject invalid transition with `409`
- write activity log `status_changed`

### GET `/api/posts/:id/activity`
Return activity timeline ordered by `created_at desc`.

### POST `/api/image/generate`
Generate image variants for one post.

Request:
```json
{
  "post_id": "uuid",
  "base_prompt": "string",
  "instruction": "string|null"
}
```

Response:
```json
{
  "provider": "google|openai",
  "prompt_used": "string",
  "variants": [
    { "url": "https://...", "provider_image_id": "string|null" }
  ]
}
```

### PATCH `/api/posts/:id/image`
Persist selected image in post.

Request:
```json
{
  "imagem_url": "https://...",
  "imagem_provider": "google|openai",
  "imagem_prompt": "string"
}
```

Writes activity `image_selected`.

## 5) Error Contract (all endpoints)

```json
{ "error": "Mensagem em português" }
```

Status mapping:
- `400` input invalid
- `404` record not found / no public posts
- `409` invalid transition
- `500` internal
- `503` external provider unavailable/quota

## 6) Execution Order

1. Apply DB schema (`supabase-schema.sql`)
2. Implement `/api/posts` + `/api/posts/:id*`
3. Implement Review screen integration
4. Implement Pipeline screen integration
5. Implement `/api/image/generate` + `/api/posts/:id/image`
6. Implement Image Studio screen

## 7) Operational Notes

- Keep `trends` debug payload enabled until QA sign-off, then remove.
- Current social ingestion risk: TikTok actor instability/timeouts.
- Keep Instagram as social priority source in current phase.
