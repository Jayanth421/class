import { createServerClient } from "@supabase/ssr";

function readSupabaseEnv(name) {
  return import.meta.env[name] || import.meta.env[`VITE_${name}`] || "";
}

const supabaseUrl = readSupabaseEnv("SUPABASE_URL") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = readSupabaseEnv("SUPABASE_PUBLISHABLE_KEY") || readSupabaseEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export function createMiddlewareClient(request, response) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });
}
