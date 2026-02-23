export type PostStatus = "pending" | "approved" | "published";
export type PostActivityEventType =
  | "created"
  | "edited"
  | "status_changed"
  | "image_generated"
  | "image_selected";

export type PostSource = "trend" | "manual";
export type PostFormato = "carrossel" | "post_estatico" | "reels" | "stories";
export type PostVoz = "max_linder" | "rian_tavares" | "marca_institucional";
export type ImageProvider = "google" | "openai";

export interface CreatePostRequest {
  tema: string;
  pilar: string | null;
  source: PostSource;
  source_url: string | null;
  hook: string | null;
  rascunho: string;
  formato: PostFormato;
  voz: PostVoz;
  copy_text: string;
  visual_descricao: string;
  cta: string;
  keyword_manychat: string | null;
  contexto_viral: string | null;
  plataforma_origem: string | null;
  metricas: string[];
}

export interface UpdatePostRequest {
  copy_text?: string;
  visual_descricao?: string;
  cta?: string;
  notes?: string | null;
}

export interface UpdatePostStatusRequest {
  status: PostStatus;
}

export interface SelectPostImageRequest {
  imagem_url: string;
  imagem_provider: ImageProvider;
  imagem_prompt: string;
}

export interface GenerateImageRequest {
  post_id: string;
  base_prompt: string;
  instruction: string | null;
}

export interface ImageVariant {
  url: string;
  provider_image_id: string | null;
}

export interface GenerateImageResponse {
  provider: ImageProvider;
  prompt_used: string;
  variants: ImageVariant[];
}

export interface PostRecord {
  id: string;
  created_at: string;
  updated_at: string;
  status: PostStatus;
  status_updated_at: string;
  approved_at: string | null;
  published_at: string | null;
  tema: string;
  pilar: string | null;
  source: PostSource;
  source_url: string | null;
  hook: string | null;
  rascunho: string;
  formato: PostFormato;
  voz: PostVoz;
  copy_text: string;
  visual_descricao: string;
  cta: string;
  keyword_manychat: string | null;
  contexto_viral: string | null;
  plataforma_origem: string | null;
  metricas: string[];
  imagem_url: string | null;
  imagem_prompt: string | null;
  imagem_provider: ImageProvider | null;
  notes: string | null;
}

export interface PostActivityRecord {
  id: string;
  post_id: string;
  event_type: PostActivityEventType;
  from_status: PostStatus | null;
  to_status: PostStatus | null;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
}
