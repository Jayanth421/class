import api from "./api";

export async function fetchSupabaseData({ table = "todos", select = "*", limit = 10 } = {}) {
  const params = new URLSearchParams({
    table,
    select,
    limit: String(limit)
  });

  const response = await api.get(`/supabase/data?${params.toString()}`);
  return response.data;
}
