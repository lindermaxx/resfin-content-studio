// Shared types for Copy Studio — kept separate from the route file
// to avoid importing Anthropic SDK in the client bundle.

export interface CopyIdea {
  angulo: "educativo" | "provocativo" | "storytelling";
  hook: string;
  copy: string;
  visual: string;
  cta: string;
}

export interface GenerateCopyRequest {
  tema: string;
  pilar: string | null;
  hook: string | null;
  rascunho: string;
  source: "trend" | "manual";
  formato: "carrossel" | "post_estatico" | "reels" | "stories";
  voz: "max_linder" | "rian_tavares" | "marca_institucional";
  contextoViral: string | null;
  plataforma: string | null;
  metricas: string[];
}
