const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

(async () => {
  try {
    // Read env from backend/.env.local via process.env (server loads it); but for this script we'll load dotenv
    require('dotenv').config({ path: __dirname + '/.env.local' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BUCKET) {
      console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_STORAGE_BUCKET in backend/.env.local');
      process.exit(1);
    }

    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const content = Buffer.from('hello world from test upload');
    const path = 'debug/test-upload-' + Date.now() + '.txt';
    console.log('Uploading to', BUCKET, path);

    const { data, error } = await client.storage.from(BUCKET).upload(path, content, { contentType: 'text/plain' });
    if (error) {
      console.error('Upload error:', error);
      process.exit(1);
    }

    console.log('Upload success:', data);

    // Optionally get a public URL to confirm
    try {
      const { data: urlData, error: urlErr } = client.storage.from(BUCKET).getPublicUrl(path);
      if (urlErr) console.warn('getPublicUrl error:', urlErr);
      else console.log('Public URL:', urlData.publicUrl);
    } catch (e) {
      console.warn('Could not get public URL:', e.message || e);
    }

    process.exit(0);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(1);
  }
})();