import { createClient } from "@supabase/supabase-js";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: never[];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, LooseTable>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Cliente Supabase server-side (service role) para uso exclusivo em API routes.
 * NUNCA importar em componentes client-side — a service role key não deve
 * ser exposta ao browser.
 */
let cachedClient: ReturnType<typeof createClient<LooseDatabase>> | null = null;

export function getSupabase(): ReturnType<typeof createClient<LooseDatabase>> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados."
    );
  }

  if (!cachedClient) {
    cachedClient = createClient<LooseDatabase>(supabaseUrl, supabaseServiceKey);
  }

  return cachedClient;
}
