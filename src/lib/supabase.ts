import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Cliente Supabase server-side (service role) para uso exclusivo em API routes.
 * NUNCA importar em componentes client-side — a service role key não deve
 * ser exposta ao browser.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
