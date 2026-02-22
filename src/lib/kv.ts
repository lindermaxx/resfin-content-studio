import { kv } from "@vercel/kv";

/**
 * Cliente Vercel KV para persistência do pipeline de conteúdo.
 *
 * Em produção (Vercel), as variáveis KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN
 * são injetadas automaticamente quando o KV é conectado ao projeto.
 *
 * Em desenvolvimento local, configure o .env.local com as variáveis do KV
 * (disponíveis no Vercel Dashboard → Storage → seu banco → .env.local tab).
 */
export { kv };
