// Asya Duru · 4 — tek yapılandırma noktası.
// Publishable key herkese açık bir anahtardır (istemciye gömülür); güvenliği RLS sağlar.

export const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://pnijbgaeqcslskdugfop.supabase.co',
  SUPABASE_KEY: 'sb_publishable_r4_g6z-0e6p0rLLqfJGs_w_tAeqKPg9',
  SUPABASE_JS: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm',
  BUCKET: 'memories',

  CHILD_NAME: 'Asya Duru',
  CHILD_FULL_NAME: 'Asya Duru Yılmaz',
  AGE: 4,
  PARTY_DATE: '2026-10-31',

  MAX_PHOTOS: 3,
  PHOTO_MAX_DIM: 1600,      // px, uzun kenar
  PHOTO_QUALITY: 0.82,      // JPEG kalitesi
  MAX_NAME: 60,
  MAX_TEXT: 1000,           // dilek ve anı alanı, her biri
  ENABLE_AUDIO: true,
  MAX_AUDIO_SECONDS: 60,

  SIGNED_URL_TTL: 6 * 3600, // albümde imzalı URL ömrü (sn)
  SLIDE_SECONDS: 8,         // canlı duvar / slayt gösterisi

  STORAGE_PREFIX: 'asya4.', // localStorage anahtar öneki
});

// ?demo=1 → Supabase'e hiç bağlanmadan çalışır (yerel test / önizleme)
export const DEMO = (() => {
  try { return new URLSearchParams(location.search).get('demo') === '1'; }
  catch { return false; }
})();
