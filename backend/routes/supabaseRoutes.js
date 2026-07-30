const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function getSupabaseClient() {
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

router.get("/health", async (_req, res, next) => {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("todos").select("id", { count: "exact", head: true });
    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    res.status(200).json({ ok: true, message: "Supabase connection is configured" });
  } catch (error) {
    next(error);
  }
});

router.get("/data", async (req, res, next) => {
  try {
    const table = String(req.query.table || "todos").trim();
    const select = String(req.query.select || "*").trim();
    const limit = Number(req.query.limit || 10);

    if (!table) {
      return res.status(400).json({ ok: false, message: "table query param is required" });
    }

    const client = getSupabaseClient();
    let query = client.from(table).select(select);
    if (Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }
    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    res.status(200).json({ ok: true, table, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
