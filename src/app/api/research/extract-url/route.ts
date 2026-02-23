import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { ExtractedContent } from "@/lib/research-types";

export const maxDuration = 60;

export type { ExtractedContent };

const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB

function detectPlatform(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("tiktok.com")) return "tiktok";
  return "artigo";
}

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<unknown[]> {
  const actorRef = actorId.replace(/\//g, "~");
  const params = new URLSearchParams({ token, timeout: "25", memory: "256" });
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorRef}/run-sync-get-dataset-items?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    if (res.status === 402 || res.status === 403) {
      throw new Error(
        "Limite/Plano da Apify excedido para extração de conteúdo social."
      );
    }
    throw new Error(`Apify ${actorId}: ${res.status}${details ? ` - ${details.slice(0, 180)}` : ""}`);
  }
  return res.json();
}

async function transcribeVideoBuffer(
  buffer: Buffer,
  googleKey: string,
  googleModel: string
): Promise<string> {
  const fileManager = new GoogleAIFileManager(googleKey);
  const tmpPath = join(tmpdir(), `resfin_video_${Date.now()}.mp4`);
  writeFileSync(tmpPath, buffer);

  let fileUri: string | null = null;
  let fileName: string | null = null;

  try {
    const upload = await fileManager.uploadFile(tmpPath, {
      mimeType: "video/mp4",
      displayName: "video_ref",
    });
    fileUri = upload.file.uri;
    fileName = upload.file.name;

    const genAI = new GoogleGenerativeAI(googleKey);
    const model = genAI.getGenerativeModel({ model: googleModel });

    const result = await model.generateContent([
      { fileData: { mimeType: "video/mp4", fileUri } },
      {
        text: "Transcreva em português tudo que é falado neste vídeo. Retorne apenas a transcrição, sem timestamps nem formatação extra.",
      },
    ]);

    return result.response.text().trim();
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    if (fileName) await fileManager.deleteFile(fileName).catch(() => {});
  }
}

async function ocrImageBase64(
  imageBase64: string,
  mimeType: string,
  googleKey: string,
  googleModel: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(googleKey);
  const model = genAI.getGenerativeModel({ model: googleModel });
  const result = await model.generateContent([
    { inlineData: { mimeType, data: imageBase64 } },
    {
      text: "Extraia todo o texto visível nesta imagem de carrossel do Instagram. Retorne apenas o texto encontrado, sem comentários.",
    },
  ]);
  return result.response.text().trim();
}

// ─── Extractors ─────────────────────────────────────────────────────────────

async function extractYouTube(url: string): Promise<ExtractedContent> {
  const { YoutubeTranscript } = await import("youtube-transcript");

  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  if (!match) throw new Error("URL do YouTube inválida");
  const videoId = match[1];

  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "pt" });
  } catch {
    items = await YoutubeTranscript.fetchTranscript(videoId);
  }
  const transcricao = items.map((t: { text: string }) => t.text).join(" ");

  const oembedRes = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  ).catch(() => null);
  const titulo = oembedRes?.ok
    ? (await oembedRes.json()).title
    : "Vídeo YouTube";

  return { titulo, plataforma: "YouTube", tipo: "video", transcricao };
}

async function extractInstagram(
  url: string,
  apifyToken: string,
  googleKey: string,
  googleModel: string
): Promise<ExtractedContent> {
  const items = await runApifyActor(
    "apify/instagram-scraper",
    { directUrls: [url], resultsLimit: 1 },
    apifyToken
  );
  if (!items.length) throw new Error("Post do Instagram não encontrado via Apify");

  const post = items[0] as Record<string, unknown>;
  const caption = (post.caption as string) || "";
  const titulo = caption.slice(0, 80) || "Post Instagram";

  const isVideo =
    (post.type as string) === "Video" || Boolean(post.isVideo) || Boolean(post.videoUrl);
  const childPosts = (post.childPosts as Record<string, unknown>[]) || [];
  const isCarousel =
    (post.type as string) === "Sidecar" || childPosts.length > 1;

  // ── Carrossel ───────────────────────────────────────────────────────────
  if (isCarousel) {
    // Collect image URLs from childPosts or images array
    const imageUrls: string[] = childPosts
      .slice(0, 10)
      .map((c) => (c.displayUrl as string) || (c.imageUrl as string))
      .filter(Boolean);

    if (!imageUrls.length) {
      const imagesField = post.images as Array<{ url: string }> | undefined;
      imageUrls.push(...(imagesField?.map((i) => i.url) ?? []));
    }

    // OCR each slide in parallel
    const slideTexts = await Promise.all(
      imageUrls.map(async (imgUrl) => {
        try {
          const res = await fetch(imgUrl, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok) return "";
          const buf = Buffer.from(await res.arrayBuffer());
          const mimeType =
            (res.headers.get("content-type") || "image/jpeg").split(";")[0];
          const base64 = buf.toString("base64");
          return await ocrImageBase64(base64, mimeType, googleKey, googleModel);
        } catch {
          return "";
        }
      })
    );

    const slidesJoined = slideTexts
      .map((t, i) => (t ? `[Slide ${i + 1}]\n${t}` : ""))
      .filter(Boolean)
      .join("\n\n");

    const transcricao = [
      caption && `Caption: ${caption}`,
      slidesJoined && `\nTexto dos slides:\n${slidesJoined}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return { titulo, plataforma: "Instagram", tipo: "carrossel", transcricao };
  }

  // ── Reels / vídeo ───────────────────────────────────────────────────────
  if (isVideo) {
    const videoUrl =
      (post.videoUrl as string) ||
      (post.video_url as string) ||
      ((post.videoMeta as Record<string, string>)?.downloadAddr);

    if (videoUrl) {
      try {
        const res = await fetch(videoUrl, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.byteLength <= MAX_VIDEO_BYTES) {
            const transcricao = await transcribeVideoBuffer(buf, googleKey, googleModel);
            return {
              titulo,
              plataforma: "Instagram",
              tipo: "reels",
              transcricao: caption
                ? `Caption: ${caption}\n\nTranscrição do vídeo:\n${transcricao}`
                : transcricao,
            };
          }
        }
      } catch { /* fall through to caption */ }
    }

    return {
      titulo,
      plataforma: "Instagram",
      tipo: "reels",
      transcricao: caption || "Vídeo muito grande ou inacessível para transcrição.",
    };
  }

  // ── Post estático ────────────────────────────────────────────────────────
  return { titulo, plataforma: "Instagram", tipo: "post", transcricao: caption };
}

async function extractTikTok(
  url: string,
  apifyToken: string,
  googleKey: string,
  googleModel: string
): Promise<ExtractedContent> {
  const items = await runApifyActor(
    "clockworks/free-tiktok-scraper",
    { postURLs: [url], resultsPerPage: 1 },
    apifyToken
  );
  if (!items.length) throw new Error("Vídeo do TikTok não encontrado via Apify");

  const post = items[0] as Record<string, unknown>;
  const caption = (post.text as string) || "";
  const titulo = caption.slice(0, 80) || "Vídeo TikTok";
  const videoUrl =
    (post.downloadURL as string) ||
    ((post.videoMeta as Record<string, string>)?.downloadAddr);

  if (videoUrl) {
    try {
      const res = await fetch(videoUrl, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength <= MAX_VIDEO_BYTES) {
          const transcricao = await transcribeVideoBuffer(buf, googleKey, googleModel);
          return {
            titulo,
            plataforma: "TikTok",
            tipo: "video",
            transcricao: caption
              ? `Caption: ${caption}\n\nTranscrição do vídeo:\n${transcricao}`
              : transcricao,
          };
        }
      }
    } catch { /* fall through */ }
  }

  return { titulo, plataforma: "TikTok", tipo: "video", transcricao: caption };
}

async function extractArticle(url: string): Promise<ExtractedContent> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ResfinBot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Não foi possível acessar a URL (${res.status})`);

  const html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titulo = titleMatch ? titleMatch[1].trim() : url;

  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  return { titulo, plataforma: "Artigo", tipo: "artigo", transcricao: clean };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL obrigatória" }, { status: 400 });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    const googleModel = process.env.GOOGLE_TEXT_MODEL || "gemini-1.5-flash";

    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_API_KEY não configurado" },
        { status: 500 }
      );
    }

    const platform = detectPlatform(url);
    let content: ExtractedContent;

    if (platform === "youtube") {
      content = await extractYouTube(url);
    } else if (platform === "instagram") {
      if (!apifyToken) {
        return NextResponse.json(
          { error: "APIFY_API_TOKEN necessário para Instagram" },
          { status: 500 }
        );
      }
      content = await extractInstagram(url, apifyToken, googleKey, googleModel);
    } else if (platform === "tiktok") {
      if (!apifyToken) {
        return NextResponse.json(
          { error: "APIFY_API_TOKEN necessário para TikTok" },
          { status: 500 }
        );
      }
      content = await extractTikTok(url, apifyToken, googleKey, googleModel);
    } else {
      content = await extractArticle(url);
    }

    return NextResponse.json(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/research/extract-url]", message);
    return NextResponse.json(
      { error: `Erro ao extrair conteúdo: ${message}` },
      { status: 500 }
    );
  }
}
