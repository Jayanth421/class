import { createBrowserClient } from "@supabase/ssr";

function readSupabaseEnv(name) {
  return import.meta.env[name] || import.meta.env[`VITE_${name}`] || "";
}

const supabaseUrl = readSupabaseEnv("SUPABASE_URL") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = readSupabaseEnv("SUPABASE_PUBLISHABLE_KEY") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

export const supabase = createClient();
