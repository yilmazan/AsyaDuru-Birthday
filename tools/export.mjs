#!/usr/bin/env node
// Usage:
//   SUPABASE_OWNER_EMAIL=you@example.com SUPABASE_OWNER_PASSWORD='…' node export.mjs [exportDir]
//
// Signs in as the album owner, downloads every non-hidden letter (oldest first) and all its photos and
// voice notes from the private "memories" bucket into
//   tools/export/<YYYYMMDD-HHMM>/memories.json
//   tools/export/<YYYYMMDD-HHMM>/files/<memory id>/photo-1.jpg | audio.webm …
// Pass an existing export folder to refresh it: files already on disk are skipped (safe to re-run).
import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../assets/js/config.js';
import { TOOLS } from './lib/art.mjs';

const email = process.env.SUPABASE_OWNER_EMAIL;
const password = process.env.SUPABASE_OWNER_PASSWORD;
if (!email || !password) {
  console.error(`Missing credentials.
  SUPABASE_OWNER_EMAIL=you@example.com SUPABASE_OWNER_PASSWORD='…' node export.mjs
Use the same account you use to sign in to album.html.`);
  process.exit(2);
}

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
const outDir = path.resolve(process.argv[2] || path.join(TOOLS, 'export', stamp()));
const filesDir = path.join(outDir, 'files');

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { error: authErr } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
if (authErr) {
  console.error(`Sign-in failed: ${authErr.message}
Check SUPABASE_OWNER_EMAIL / SUPABASE_OWNER_PASSWORD (the album.html login).`);
  process.exit(1);
}
console.log(`Signed in as ${email}`);

const { data: rows, error } = await sb
  .from('memories')
  .select('id, created_at, lang, guest_name, wish, memory, photo_paths, audio_path, audio_seconds, favorite, hidden')
  .eq('hidden', false)
  .order('created_at', { ascending: true });
if (error) {
  console.error('Could not read memories:', error.message);
  process.exit(1);
}
if (!rows.length) {
  console.error(`Zero letters returned.
Either nothing has been submitted yet, or this account is not an album owner: row-level security returns
an empty list (not an error) for accounts missing from public.album_owners. Check in the Supabase SQL editor:
  select * from public.album_owners;   -- must contain '${email.trim().toLowerCase()}'`);
  process.exit(3);
}

mkdirSync(filesDir, { recursive: true });
let downloaded = 0, skipped = 0, failed = 0;
async function fetchFile(storagePath) {
  const local = path.join(filesDir, storagePath);           // files/<id>/photo-1.jpg
  const rel = path.posix.join('files', storagePath);
  if (existsSync(local) && statSync(local).size > 0) { skipped++; return rel; }
  mkdirSync(path.dirname(local), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error: e } = await sb.storage.from(CONFIG.BUCKET).download(storagePath);
    if (!e && data) {
      writeFileSync(local, Buffer.from(await data.arrayBuffer()));
      downloaded++;
      return rel;
    }
    if (attempt === 3) {
      console.warn(`  ! could not download ${storagePath}: ${e?.message || 'unknown error'}`);
      failed++;
      return null;
    }
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
}

const memories = [];
for (const [i, r] of rows.entries()) {
  const photos = [];
  for (const p of r.photo_paths || []) { const rel = await fetchFile(p); if (rel) photos.push(rel); }
  const audio = r.audio_path ? await fetchFile(r.audio_path) : null;
  memories.push({ ...r, files: { photos, audio } });
  process.stdout.write(`\r  ${i + 1}/${rows.length} letters`);
}
process.stdout.write('\n');

const out = {
  source: 'supabase',
  sample: false,
  exported_at: new Date().toISOString(),
  project: CONFIG.SUPABASE_URL,
  count: memories.length,
  memories,
};
writeFileSync(path.join(outDir, 'memories.json'), JSON.stringify(out, null, 2) + '\n');
await sb.auth.signOut().catch(() => {});

const nPhotos = memories.reduce((a, m) => a + m.files.photos.length, 0);
const nAudio = memories.filter((m) => m.files.audio).length;
console.log(`Exported ${memories.length} letters, ${nPhotos} photos, ${nAudio} voice notes
  downloaded ${downloaded}, already present ${skipped}${failed ? `, FAILED ${failed} (re-run with this folder to retry)` : ''}
  ${outDir}
Next: node make-book.mjs "${path.relative(TOOLS, outDir).startsWith('..') ? outDir : path.relative(TOOLS, outDir)}"`);
if (failed) process.exit(4);
