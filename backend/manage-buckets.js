const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env.local' });

(async () => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env.local');
      process.exit(1);
    }

    const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    console.log('Checking or creating bucket:', BUCKET);
    // Try to create the bucket. If it exists, Supabase may return an error we handle.
    const { data, error } = await client.storage.createBucket(BUCKET, { public: false });
    if (error) {
      // If the bucket already exists, the API may return 409 — try to detect by message
      console.warn('createBucket returned error:', error.message || error);
      // Attempt to list the file to confirm existence
      try {
        const { data: listData, error: listErr } = await client.storage.from(BUCKET).list('', { limit: 1 });
        if (listErr) {
          console.error('Bucket does not seem to exist and listing failed:', listErr);
          process.exit(1);
        }
        console.log('Bucket exists (listing succeeded).');
        process.exit(0);
      } catch (e) {
        console.error('Listing attempt failed:', e);
        process.exit(1);
      }
    }

    console.log('Bucket created:', data);
    process.exit(0);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(1);
  }
})();