// Shared types used by both server routes and client components.
// Kept separate to avoid importing Node.js-only route files in the client bundle.

export interface Trend {
  titulo: string;
  plataforma: string;
  metricas: string[];
  fonte: string;
  url: string;
  contexto: string;
}

export interface ExtractedContent {
  titulo: string;
  plataforma: string;
  tipo: "reels" | "carrossel" | "video" | "artigo" | "post";
  transcricao: string;
}

export interface CompetitorPost {
  url: string;
  username: string;
  caption: string;
  tipo: "reels" | "carrossel" | "post";
  likesCount: number;
  commentsCount: number;
  videoViewCount: number;
  timestamp: string;
  thumbnailUrl: string;
  engagementScore: number;
}
