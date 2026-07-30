import { createServerClient } from "@supabase/ssr";

function readSupabaseEnv(name) {
  return import.meta.env[name] || import.meta.env[`VITE_${name}`] || "";
}

const supabaseUrl = readSupabaseEnv("SUPABASE_URL") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = readSupabaseEnv("SUPABASE_PUBLISHABLE_KEY") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export function createClient(cookieStore) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll?.() || [];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore?.set?.(name, value, options));
        } catch {
          // Ignore server-component-only cookie writes in the Vite frontend.
        }
      }
    }
  });
}
