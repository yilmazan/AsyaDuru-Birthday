// Asya Duru · 4 — veri katmanı. Sayfalar Supabase'i DOĞRUDAN çağırmaz; sadece bu modülü kullanır.
// ?demo=1 iken her şey bellekte/sahte veriyle çalışır (ağ yok).

import { CONFIG, DEMO } from './config.js';

export { DEMO };

// ------------------------------------------------------------------ yardımcılar
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lsGet(key) {
  try { return localStorage.getItem(CONFIG.STORAGE_PREFIX + key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(CONFIG.STORAGE_PREFIX + key, val); } catch { /* yok say */ }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // eski tarayıcılar için RFC4122 v4
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Cihaz kimliği (spam limiti için; kişisel veri değil). */
export function deviceId() {
  let id = lsGet('device');
  if (!id) { id = uuid(); lsSet('device', id); }
  return id;
}

/** 'audio/webm;codecs=opus' → { contentType:'audio/webm', ext:'webm' } */
export function audioTypeInfo(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  const map = {
    'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/x-m4a': 'm4a', 'audio/aac': 'mp4',
    'audio/ogg': 'ogg', 'video/webm': 'webm', 'video/mp4': 'mp4',
  };
  const ext = map[base] || 'webm';
  const contentType = base.startsWith('video/') ? base.replace('video/', 'audio/') : (base || 'audio/webm');
  return { contentType: contentType === 'audio/aac' ? 'audio/mp4' : contentType, ext };
}

/** Hata → i18n anahtarı (sayfalar t(key) ile gösterir). */
export function errorKey(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('rate limited')) return 'err.rateLimited';
  if (msg.includes('limit reached')) return 'err.full';
  if (msg.includes('payload too large') || msg.includes('exceeded the maximum')) return 'err.tooLarge';
  if (msg.includes('mime') || msg.includes('invalid_mime')) return 'err.badFile';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) return 'err.network';
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'err.badLogin';
  return 'err.generic';
}

async function retry(fn, { tries = 3, base = 700 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(i); } catch (e) {
      last = e;
      const k = errorKey(e);
      if (k === 'err.rateLimited' || k === 'err.full' || k === 'err.tooLarge' || k === 'err.badFile') break;
      await sleep(base * 2 ** i);
    }
  }
  throw last;
}

// ------------------------------------------------------------------ Supabase istemcisi (tembel yükleme)
let _client;
export async function client() {
  if (DEMO) throw new Error('demo mode: no client');
  if (!_client) {
    const { createClient } = await import(CONFIG.SUPABASE_JS);
    _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: CONFIG.STORAGE_PREFIX + 'auth' },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return _client;
}

// =================================================================== MİSAFİR
/**
 * Bir anı gönderir.
 * @param {object} p
 * @param {'tr'|'en'} p.lang
 * @param {string} [p.guestName]
 * @param {string} [p.wish]      Asya'ya dilek / mesaj
 * @param {string} [p.memory]    Paylaşılan anı
 * @param {Blob[]} [p.photos]    En fazla 3 adet, ZATEN sıkıştırılmış image/jpeg blob
 * @param {{blob:Blob, mime:string, seconds:number}|null} [p.audio]
 * @param {(done:number,total:number)=>void} [p.onProgress]
 * @returns {Promise<{id:string, count:number|null}>}  count = toplam anı sayısı (teşekkür ekranı)
 */
export async function submitMemory({ lang, guestName = '', wish = '', memory = '', photos = [], audio = null, onProgress } = {}) {
  photos = photos.slice(0, CONFIG.MAX_PHOTOS);
  const id = uuid();
  const total = photos.length + (audio ? 1 : 0) + 1;
  let done = 0;
  const tick = () => onProgress?.(++done, total);
  onProgress?.(0, total);

  if (DEMO) {
    for (let i = 0; i < total; i++) { await sleep(450); tick(); }
    const n = Number(lsGet('demoCount') || 22) + 1; lsSet('demoCount', String(n));
    return { id, count: n };
  }

  const sb = await client();
  const bucket = sb.storage.from(CONFIG.BUCKET);
  const upload = (path, blob, contentType) => retry(async () => {
    const { error } = await bucket.upload(path, blob, { contentType, upsert: false, cacheControl: '31536000' });
    if (error) {
      // tekrar denemede "zaten var" → önceki deneme başarılı olmuş demektir
      const m = String(error.message || '').toLowerCase();
      if (m.includes('exists') || m.includes('duplicate') || error.statusCode === '409') return;
      throw error;
    }
  });

  const photo_paths = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `${id}/photo-${i + 1}.jpg`;
    await upload(path, photos[i], 'image/jpeg');
    photo_paths.push(path); tick();
  }

  let audio_path = null, audio_seconds = null;
  if (audio?.blob) {
    const { contentType, ext } = audioTypeInfo(audio.mime || audio.blob.type);
    audio_path = `${id}/audio.${ext}`;
    await upload(audio_path, audio.blob, contentType);
    audio_seconds = Math.max(1, Math.min(90, Math.round(audio.seconds || 1)));
    tick();
  }

  await retry(async (attempt) => {
    const { error } = await sb.from('memories').insert({
      id, lang,
      guest_name: guestName.trim().slice(0, CONFIG.MAX_NAME) || null,
      wish: wish.trim().slice(0, CONFIG.MAX_TEXT),
      memory: memory.trim().slice(0, CONFIG.MAX_TEXT),
      photo_paths, audio_path, audio_seconds,
      device_id: deviceId(),
    });
    if (error) {
      // ilk deneme sunucuya ulaşıp yanıt kaybolduysa → birincil anahtar çakışması = başarı
      if (attempt > 0 && (error.code === '23505')) return;
      throw error;
    }
  });
  tick();

  return { id, count: await memoryCount() };
}

/** Toplam (gizlenmemiş) anı sayısı; hata olursa null. */
export async function memoryCount() {
  if (DEMO) return Number(lsGet('demoCount') || 22);
  try {
    const sb = await client();
    const { data, error } = await sb.rpc('memory_count');
    if (error) throw error;
    return typeof data === 'number' ? data : null;
  } catch { return null; }
}

// =================================================================== ALBÜM SAHİBİ
const DEMO_USER = { email: 'demo@asya4.local' };
let _demoSession = null;

/** @returns {Promise<{email:string}|null>} */
export async function currentUser() {
  if (DEMO) return _demoSession;
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.user ? { email: data.session.user.email } : null;
}

export async function signIn(email, password) {
  if (DEMO) { await sleep(400); _demoSession = DEMO_USER; return _demoSession; }
  const sb = await client();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return { email: data.user.email };
}

export async function signOut() {
  if (DEMO) { _demoSession = null; return; }
  const sb = await client();
  await sb.auth.signOut();
}

/**
 * @typedef {object} Memory
 * @property {string} id
 * @property {string} created_at   ISO
 * @property {'tr'|'en'} lang
 * @property {string|null} guest_name
 * @property {string} wish
 * @property {string} memory
 * @property {string[]} photo_paths
 * @property {string[]} photoUrls  imzalı (geçici) URL'ler, photo_paths ile aynı sıra
 * @property {string|null} audio_path
 * @property {string|null} audioUrl
 * @property {number|null} audio_seconds
 * @property {boolean} hidden
 * @property {boolean} favorite
 */

async function signRows(sb, rows) {
  const paths = rows.flatMap((r) => [...(r.photo_paths || []), ...(r.audio_path ? [r.audio_path] : [])]);
  const urlOf = new Map();
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await sb.storage.from(CONFIG.BUCKET).createSignedUrls(chunk, CONFIG.SIGNED_URL_TTL);
    if (error) throw error;
    for (const d of data || []) if (d.signedUrl) urlOf.set(d.path, d.signedUrl);
  }
  return rows.map((r) => ({
    ...r,
    photoUrls: (r.photo_paths || []).map((p) => urlOf.get(p)).filter(Boolean),
    audioUrl: r.audio_path ? urlOf.get(r.audio_path) || null : null,
  }));
}

/**
 * Tüm anılar, eskiden yeniye.
 * Albüm sahibi değilse boş dizi döner (RLS).
 * @returns {Promise<Memory[]>}
 */
export async function listMemories() {
  if (DEMO) return (await loadDemo()).map((r) => ({ ...r }));
  const sb = await client();
  const { data, error } = await sb.from('memories').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return signRows(sb, data || []);
}

export async function setHidden(id, hidden) { return patch(id, { hidden: !!hidden }); }
export async function setFavorite(id, favorite) { return patch(id, { favorite: !!favorite }); }

async function patch(id, fields) {
  if (DEMO) { const r = (await loadDemo()).find((x) => x.id === id); if (r) Object.assign(r, fields); return; }
  const sb = await client();
  const { error } = await sb.from('memories').update(fields).eq('id', id);
  if (error) throw error;
}

/** Kalıcı silme (dosyalar dahil). Sadece bilinçli kullanıcı eylemiyle çağırın. */
export async function deleteMemory(id) {
  if (DEMO) { const a = await loadDemo(); const i = a.findIndex((x) => x.id === id); if (i >= 0) a.splice(i, 1); return; }
  const sb = await client();
  const { data: row, error: e1 } = await sb.from('memories').select('photo_paths,audio_path').eq('id', id).single();
  if (e1) throw e1;
  const files = [...(row.photo_paths || []), ...(row.audio_path ? [row.audio_path] : [])];
  if (files.length) await sb.storage.from(CONFIG.BUCKET).remove(files);
  const { error } = await sb.from('memories').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Yeni anı geldiğinde çağrılır (canlı duvar). Dönüş: aboneliği kapatan fonksiyon.
 * @param {(m:Memory)=>void} onInsert
 * @param {(status:string)=>void} [onStatus]  'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
 */
export function subscribeNew(onInsert, onStatus) {
  if (DEMO) {
    // demo: 25 sn'de bir sahte yeni anı
    let n = 0;
    onStatus?.('SUBSCRIBED');
    const t = setInterval(async () => {
      const pool = await loadDemo();
      const src = pool[n++ % pool.length];
      const m = { ...src, id: uuid(), created_at: new Date().toISOString(), hidden: false };
      pool.push(m); onInsert(m);
    }, 25000);
    return () => clearInterval(t);
  }
  let channel; let closed = false;
  (async () => {
    const sb = await client();
    const { data } = await sb.auth.getSession();
    if (data.session) sb.realtime.setAuth(data.session.access_token);
    channel = sb.channel('memories-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memories' }, async (payload) => {
        try { const [m] = await signRows(sb, [payload.new]); onInsert(m); } catch (e) { console.warn('[asya4] sign', e); }
      })
      .subscribe((status) => onStatus?.(status));
    if (closed) sb.removeChannel(channel);
  })();
  return async () => { closed = true; if (channel) (await client()).removeChannel(channel); };
}

// ------------------------------------------------------------------ demo verisi
let _demo;
async function loadDemo() {
  if (!_demo) {
    const res = await fetch(new URL('../demo/demo-memories.json', import.meta.url));
    _demo = await res.json();
  }
  return _demo;
}
