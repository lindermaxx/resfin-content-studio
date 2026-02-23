-- EPIC-04/05 schema
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('pending', 'approved', 'published');
  end if;
end$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status post_status not null default 'pending',
  status_updated_at timestamptz not null default now(),
  approved_at timestamptz null,
  published_at timestamptz null,

  tema text not null,
  pilar text null,
  source text not null check (source in ('trend', 'manual')),
  source_url text null,
  hook text null,
  rascunho text not null default '',

  formato text not null check (formato in ('carrossel', 'post_estatico', 'reels', 'stories')),
  voz text not null check (voz in ('max_linder', 'rian_tavares', 'marca_institucional')),

  copy_text text not null,
  visual_descricao text not null default '',
  cta text not null default '',
  keyword_manychat text null,

  contexto_viral text null,
  plataforma_origem text null,
  metricas jsonb not null default '[]'::jsonb,

  imagem_url text null,
  imagem_prompt text null,
  imagem_provider text null check (imagem_provider in ('google', 'openai')),

  notes text null
);

create table if not exists public.post_activity_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'edited', 'status_changed', 'image_generated', 'image_selected')),
  from_status post_status null,
  to_status post_status null,
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_status_updated_at
  on public.posts(status, updated_at desc);

create index if not exists idx_posts_created_at
  on public.posts(created_at desc);

create index if not exists idx_post_activity_post_id_created_at
  on public.post_activity_log(post_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_posts_set_updated_at on public.posts;
create trigger trg_posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

