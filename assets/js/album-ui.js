// Asya Duru · 4 — albüm ve gösterim için ortak küçük yapı taşları.
// Misafir içeriği HER ZAMAN textContent / append(string) ile yazılır; innerHTML yalnızca sabit ikonlar için.

import { t, lang } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reduceMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Küçük DOM kurucu. Çocuk string'ler metin düğümü olarak eklenir (XSS yok). */
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'vars') for (const [p, val] of Object.entries(v)) n.style.setProperty(p, val);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c);
  return n;
}

// ------------------------------------------------------------------ sabit ikonlar
const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z" fill="currentColor"/>',
  starLine: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.5-3.2 3.8M6.6 7.7C4.6 9 3.1 10.9 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9M9.9 10a3 3 0 0 0 4.1 4.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  eye: '<path d="M2.5 12c1-1.8 4.5-6 9.5-6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  trash: '<path d="M4.5 7h15M10 7V4.8h4V7M6.5 7l.9 12.2h9.2L17.5 7M10.2 10.5v5.5M13.8 10.5v5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = ICONS[name] || '';   // sabit metin, kullanıcı verisi değil
  return s;
}

/** Altın varak yıldız etiketi (favori işareti). */
export function goldStar(cls = 'fav-mark') {
  return el('img', { class: cls, src: 'assets/img/album/star.svg', alt: '', width: 40, height: 40 });
}

// ------------------------------------------------------------------ belirlenimci rastgelelik (id → hep aynı eğim)
export function seeded(id) {
  let h = 2166136261 >>> 0;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (rnd, lo, hi) => lo + (hi - lo) * rnd();

// ------------------------------------------------------------------ biçimlendirme
export function fmtTime(iso, forLang = lang()) {
  try {
    return new Intl.DateTimeFormat(forLang === 'en' ? 'en-GB' : 'tr-TR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return ''; }
}
export function fmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** İmza metni — mektubun kendi dilinde ("— Elif Teyze"). */
export function signature(m) {
  const name = (m.guest_name || '').trim() || t('album.anonymous', {}, m.lang);
  return t('book.from', { name }, m.lang);
}
export function signerName(m) {
  return (m.guest_name || '').trim() || t('album.anonymous');
}

/** Selamlama + dilek + "Not:" — mektubun dilinde, içerik çevrilmez. */
export function letterText(m, { salute = true } = {}) {
  const out = [];
  const wish = (m.wish || '').trim();
  const mem = (m.memory || '').trim();
  if (salute && (wish || mem)) out.push(el('p', { class: 'salute', text: t('guest.wishLabel', {}, m.lang) }));
  if (wish) out.push(el('p', { class: 'wish', dir: 'auto', text: wish }));
  if (mem) {
    out.push(el('p', { class: 'ps', dir: 'auto' },
      el('span', { class: 'ps-label', text: t('album.ps', {}, m.lang) }), mem));
  }
  return out;
}

// ------------------------------------------------------------------ sesli not oynatıcı
let playing = null;   // aynı anda tek ses
export function stopAllAudio() { if (playing) { playing.pause(); } }

/**
 * Özel oynatıcı: mum mühür biçiminde düğme + ilerleme çizgisi + süre.
 * @param {object} m Memory
 * @param {{onPlay?:Function, onStop?:Function, onError?:Function}} [hooks]
 */
export function voicePlayer(m, hooks = {}) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.src = m.audioUrl;
  const fill = el('span', { class: 'voice-fill' });
  const time = el('span', { class: 'voice-time', text: fmtDur(m.audio_seconds) });
  const btn = el('button', { type: 'button', class: 'voice-btn', 'aria-label': t('album.play') },
    icon('play', 'i-play'), icon('pause', 'i-pause'));
  const wrap = el('div', { class: 'voice', 'data-mid': m.id },
    btn,
    el('span', { class: 'voice-meta' },
      el('span', { class: 'voice-label', text: t('album.voiceNote') }),
      el('span', { class: 'voice-bar', 'aria-hidden': 'true' }, fill)),
    time);
  wrap._audio = audio;

  const total = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(m.audio_seconds) || 0);
  const setPlaying = (on) => {
    wrap.classList.toggle('is-playing', on);
    btn.setAttribute('aria-label', on ? t('album.pause') : t('album.play'));
  };

  btn.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    if (playing && playing !== audio) playing.pause();
    try { await audio.play(); } catch (err) {
      if (err?.name !== 'AbortError') { wrap.classList.add('is-error'); hooks.onError?.(wrap); }
    }
  });
  audio.addEventListener('play', () => { playing = audio; setPlaying(true); hooks.onPlay?.(); });
  audio.addEventListener('pause', () => { if (playing === audio) playing = null; setPlaying(false); hooks.onStop?.(); });
  audio.addEventListener('ended', () => {
    fill.style.width = '100%';
    time.textContent = fmtDur(total());
    setTimeout(() => { fill.style.width = '0%'; }, 600);
  });
  audio.addEventListener('timeupdate', () => {
    const d = total();
    if (d > 0) {
      fill.style.width = `${Math.min(100, (audio.currentTime / d) * 100)}%`;
      time.textContent = fmtDur(Math.max(0, d - audio.currentTime));
    }
  });
  audio.addEventListener('error', () => { setPlaying(false); wrap.classList.add('is-error'); hooks.onError?.(wrap); });
  return wrap;
}

/** Resim önyükleme (gösterimde geçişin pürüzsüz olması için), zaman aşımlı. */
export function preloadImages(imgs, ms = 2500) {
  const all = imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve()
    : (img.decode ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = img.onerror = r; }))));
  return Promise.race([Promise.all(all), new Promise((r) => setTimeout(r, ms))]);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
