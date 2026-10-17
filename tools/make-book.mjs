#!/usr/bin/env node
// Usage: node make-book.mjs <exportDir>        e.g.  node make-book.mjs export/20261101-1030
//                                                    node make-book.mjs sample-export
// Builds a 200×200 mm square photo book (206×206 mm pages incl. 3 mm bleed) from an export made by export.mjs:
//   print/book/asya-duru-4-fotokitap.pdf               (real export; private, git-ignored)
//   print/book/asya-duru-4-fotokitap-ornek-sample.pdf  (when the export is the sample)
//   print/book/previews[-real]/page-NN.png
//   <exportDir>/sesli-notlar/NN - Name.webm             voice notes named by the book page they appear on
// Page count is padded to a multiple of 4 with "Notes for Asya" pages.

// ============================================================================================
//  EDIT ME: the family's own words (dedication page, page 2). Plain text, both languages.
// ============================================================================================
const DEDICATION = {
  tr: 'Sevgili Asya Duru, dördüncü yaş gününde seni sevenler sana bu mektupları yazdı. Hepsini sen büyüyünce okuyasın diye sakladık.',
  en: 'Dear Asya Duru, on your fourth birthday the people who love you wrote you these letters. We kept every one for you to read when you are older.',
  signTr: 'Sevgiyle, annen ve baban',
  signEn: 'With love, Mum and Dad',
};
const PLACE = { tr: 'Abu Dabi', en: 'Abu Dhabi' };
const TIMEZONE = 'Asia/Dubai';   // party time zone, used for the date/time printed under each letter
// ============================================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, settle, FONTS_HREF } from './lib/browser.mjs';
import { C, PRINT, TOOLS, crownSvg, sealSvg, nameSvg, TEXTURE_SCRIPT, esc, typo } from './lib/art.mjs';
import { STRINGS } from '../assets/js/i18n.js';
import { CONFIG } from '../assets/js/config.js';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node make-book.mjs <exportDir>\n  e.g. node make-book.mjs sample-export');
  process.exit(2);
}
const exportDir = [path.resolve(arg), path.resolve(TOOLS, arg)].find((d) => existsSync(path.join(d, 'memories.json')));
if (!exportDir) {
  console.error(`No memories.json found in "${arg}". Run export.mjs first (or use: node make-book.mjs sample-export).`);
  process.exit(2);
}
const exp = JSON.parse(readFileSync(path.join(exportDir, 'memories.json'), 'utf8'));
const isSample = !!exp.sample;
const BOOK = path.join(PRINT, 'book');
const pdfPath = path.join(BOOK, isSample ? 'asya-duru-4-fotokitap-ornek-sample.pdf' : 'asya-duru-4-fotokitap.pdf');
const previewDir = path.join(BOOK, isSample ? 'previews' : 'previews-real');
mkdirSync(previewDir, { recursive: true });

// ---- letters for the page script (paths relative to book.html, which lives in exportDir)
const missing = [];
const letters = exp.memories.filter((m) => !m.hidden).map((m) => {
  const photos = (m.files?.photos || []).filter((p) => existsSync(path.join(exportDir, p)) || (missing.push(p), false));
  return {
    id: m.id, lang: m.lang === 'en' ? 'en' : 'tr', name: (m.guest_name || '').trim() || null,
    wish: tidy(m.wish), memory: tidy(m.memory), created_at: m.created_at,
    photos: photos.map((p) => p.split('/').map(encodeURIComponent).join('/')),
    audio: m.files?.audio || null, audioSeconds: m.audio_seconds || null,
  };
});
if (missing.length) console.warn(`  ! ${missing.length} photo file(s) missing in the export (re-run export.mjs with this folder):\n    ${missing.join('\n    ')}`);
function tidy(s) {
  return String(s || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const pick = (lang) => Object.fromEntries(Object.entries(STRINGS[lang]).filter(([k]) =>
  /^(book\.|album\.anonymous|album\.count|guest\.wishLabel|thanks\.signoff|app\.)/.test(k)));
const DATA = {
  letters, sample: isSample, tz: TIMEZONE, partyDate: CONFIG.PARTY_DATE,
  strings: { tr: pick('tr'), en: pick('en') },
};

// ============================================================================================ page CSS
const CSS = `
@page { size: 206mm 206mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  -webkit-print-color-adjust: exact; print-color-adjust: exact; color: ${C.ink};
  font-family: 'Nunito', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif;
  font-variant-ligatures: common-ligatures; text-rendering: geometricPrecision;
}
.page {
  position: relative; width: 206mm; height: 206mm; overflow: hidden; break-after: page;
  background-color: ${C.paper}; background-image: var(--tex-paper); background-size: 72mm 72mm;
}
.page:last-child { break-after: auto; }
.page.petal {
  background-color: ${C.petal};
  background-image: var(--tex),
    radial-gradient(110% 70% at 50% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 62%),
    radial-gradient(90% 55% at 50% 108%, rgba(220,203,240,.5), rgba(220,203,240,0) 70%);
  background-size: 70mm 70mm, 100% 100%, 100% 100%;
}
.box { position: absolute; }
.folio { position: absolute; bottom: 14mm; font: 9pt/1 'Yeseva One', Georgia, serif; color: ${C.inkSoft}; letter-spacing: .04em; }
.recto .folio { right: 16mm; }
.verso .folio { left: 16mm; }
svg { display: block; }

/* ---- polaroids */
.pol { position: absolute; background: #fff; border-radius: .35mm;
  box-shadow: 0 .25mm .5mm rgba(94,24,56,.16), 0 2.6mm 5mm -1.6mm rgba(42,20,51,.34); }
.pol img { position: absolute; display: block; object-fit: cover; background: ${C.petalDeep}; }
.pol::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 .2mm rgba(94,24,56,.06); pointer-events: none; }
.tape { position: absolute; top: -3.1mm; left: 50%; height: 6.6mm; margin-left: -10mm; width: 20mm;
  background: rgba(220,203,240,.78); box-shadow: 0 .2mm .4mm rgba(94,24,56,.12);
  clip-path: polygon(0 6%, 4% 0, 8% 7%, 12% 0, 16% 6%, 100% 0, 96% 8%, 100% 16%, 96% 30%, 100% 46%, 96% 62%, 100% 78%, 96% 92%, 100% 100%, 0 100%, 4% 88%, 0 72%, 4% 56%, 0 40%, 4% 24%); }
.tape.t1 { background: rgba(245,204,214,.85); }
.tape.t2 { background: rgba(240,216,142,.72); }

/* ---- letter text */
.tbox { position: absolute; overflow: hidden; display: flex; flex-direction: column; }
.tbox.center > .lt { margin-block: auto; }
.tbox.middle > .lt { margin-block: auto; }
.lt { font-size: var(--fs, 12pt); line-height: 1.52; overflow-wrap: anywhere; text-wrap: pretty; width: 100%; }
.lt.narrow { max-width: 124mm; margin-inline: auto; }
.lt .orn { width: 2.1em; margin: 0 auto .9em; opacity: .95; }
.lt .salute { font-family: 'Yeseva One', Georgia, serif; font-size: 1.36em; line-height: 1.2; color: ${C.waxDeep}; margin: 0 0 .5em; }
.lt p { margin: 0 0 .62em; }
.lt .ps { margin-top: .95em; font-style: italic; }
.lt .ps-label { font-family: 'Yeseva One', Georgia, serif; font-style: normal; color: ${C.wax}; margin-right: .3em; }
.lt .more { color: ${C.inkSoft}; margin: -.2em 0 0; }
.sign { margin-top: 1.05em; display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: .12em; }
.sign .from { font-family: 'Yeseva One', Georgia, serif; font-size: 1.14em; line-height: 1.25; color: ${C.ink}; }
.sign .when { font-size: .74em; color: ${C.inkSoft}; letter-spacing: .01em; }
.voice { display: inline-flex; align-items: center; gap: .45em; margin-top: .45em; padding: .22em .75em .22em .6em;
  font-size: .74em; font-weight: 700; color: ${C.waxDeep}; border: .25mm solid ${C.waxGlow}; border-radius: 99px; background: rgba(255,255,255,.55); }
.voice svg { width: 1.35em; height: 1em; }
.voice .dur { font-weight: 400; color: ${C.inkSoft}; }
.caption { position: absolute; font: 10.5pt/1.2 'Yeseva One', Georgia, serif; color: ${C.ink}; text-align: right; }
.caption small { display: block; font: 8pt/1.3 'Nunito', sans-serif; color: ${C.inkSoft}; margin-top: .6mm; }

.pair-rule { position: absolute; height: 3mm; }

/* ---- cover */
.cover-in, .center-col { position: absolute; left: 3mm; top: 3mm; width: 200mm; height: 200mm; display: flex; flex-direction: column; align-items: center; }
.cover-in { padding: 17mm 18mm 15mm; }
.cover .crown { width: 27mm; }
.cover .name-svg { width: 160mm !important; margin-top: -3mm; }
.envelope { position: relative; width: 104mm; margin-top: 3mm; filter: drop-shadow(0 2.4mm 3mm rgba(94,24,56,.28)); }
.envelope .seal { position: absolute; width: 29mm; height: 29mm; left: 50%; top: 31mm; margin-left: -14.5mm; transform: rotate(-6deg);
  filter: drop-shadow(0 .8mm 1mm rgba(94,24,56,.45)); }
.cover-sub { margin: 0; font: 13pt/1.32 'Yeseva One', Georgia, serif; text-align: center; }
.cover-subs { margin-top: 8.5mm; display: flex; flex-direction: column; gap: 1.2mm; align-items: center; }
.cover-date { margin-top: auto; display: flex; align-items: center; gap: 4mm; font: 11pt/1 'Yeseva One', Georgia, serif; color: ${C.inkSoft}; letter-spacing: .08em; }
.cover-date i { display: block; width: 16mm; height: .3mm; background: ${C.gold}; }
.sample-tag { position: absolute; top: 16mm; right: 16mm; font: 700 8pt/1 'Nunito', sans-serif; color: ${C.lilacDeep};
  border: .3mm solid ${C.lilacDeep}; border-radius: 99px; padding: 1.3mm 2.6mm; background: rgba(255,255,255,.6); }

/* ---- dedication, notes, ornament, closing */
.center-col { justify-content: center; padding: 22mm 28mm; text-align: center; }
.ded .crown { width: 17mm; margin-bottom: 7mm; }
.ded h2, .closing h2 { margin: 0; font: 17pt/1.25 'Yeseva One', Georgia, serif; font-weight: 400; }
.rule { width: 34mm; height: 2.4mm; margin: 6mm auto; }
.ded p { margin: 0 auto; max-width: 118mm; font-size: 12.5pt; line-height: 1.6; }
.ded p + p { margin-top: 5mm; }
.ded .sig { margin-top: 9mm; font: 12.5pt/1.5 'Yeseva One', Georgia, serif; color: ${C.waxDeep}; }
.notes h2 { position: absolute; top: 24mm; left: 0; right: 0; margin: 0; text-align: center; font: 14pt/1.3 'Yeseva One', Georgia, serif; font-weight: 400; }
.notes .lines { position: absolute; top: 48mm; }
.notes .lines i { display: block; height: 9.5mm; border-bottom: .3mm solid ${C.paperLine}; }
.orn-page .crown { width: 20mm; }
.orn-page .name-svg { width: 74mm !important; margin-top: -1mm; }
.orn-page .when { margin-top: 3mm; font: 10pt/1 'Yeseva One', Georgia, serif; color: ${C.inkSoft}; letter-spacing: .08em; }
.closing .seal-wrap { width: 24mm; height: 24mm; margin-bottom: 9mm; transform: rotate(-6deg); filter: drop-shadow(0 .8mm 1mm rgba(94,24,56,.4)); }
.closing .seal-wrap svg { width: 100%; height: 100%; }
.closing .counts { margin: 0; font-size: 11.5pt; line-height: 1.6; color: ${C.inkSoft}; }
.closing h2 { margin-top: 0; }
.closing .place { margin-top: 9mm; font: 10.5pt/1.6 'Yeseva One', Georgia, serif; color: ${C.inkSoft}; }
.closing .sample-note { margin-top: 10mm; font-size: 8.5pt; color: ${C.lilacDeep}; font-weight: 700; }
`;

const RULE_SVG = `<svg class="rule" viewBox="0 0 120 8" aria-hidden="true"><path d="M6 4 Q33 1.8 52 4 Q33 6.2 6 4Z" fill="${C.gold}"/><path d="M114 4 Q87 1.8 68 4 Q87 6.2 114 4Z" fill="${C.gold}"/><path d="M60 .6 L63.2 4 L60 7.4 L56.8 4Z" fill="${C.wax}"/></svg>`;
const WAVE_SVG = `<svg viewBox="0 0 20 14" aria-hidden="true"><g fill="${C.wax}"><rect x="0" y="5" width="2.2" height="4" rx="1.1"/><rect x="4" y="2.5" width="2.2" height="9" rx="1.1"/><rect x="8" y="0" width="2.2" height="14" rx="1.1"/><rect x="12" y="3.5" width="2.2" height="7" rx="1.1"/><rect x="16" y="5.5" width="2.2" height="3" rx="1.1"/></g></svg>`;

function envelopeSvg() {
  return `<svg viewBox="0 0 120 74" aria-hidden="true">
  <defs><linearGradient id="env-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFCFA"/><stop offset="1" stop-color="#F8EEEA"/></linearGradient></defs>
  <rect x=".4" y=".4" width="119.2" height="73.2" rx="1.6" fill="url(#env-b)" stroke="${C.paperLine}" stroke-width=".5"/>
  <path d="M.6 73.4 L60 36 L119.4 73.4Z" fill="#F7EAE7" stroke="${C.paperLine}" stroke-width=".45" stroke-linejoin="round"/>
  <path d="M.6 .8 L50 41 L.6 73.2Z" fill="#FBF2EF" stroke="${C.paperLine}" stroke-width=".35" stroke-linejoin="round"/>
  <path d="M119.4 .8 L70 41 L119.4 73.2Z" fill="#FBF2EF" stroke="${C.paperLine}" stroke-width=".35" stroke-linejoin="round"/>
  <path d="M.6 .6 L60 45.5 L119.4 .6Z" fill="#FFF8F5" stroke="${C.paperLine}" stroke-width=".5" stroke-linejoin="round"/>
  <path d="M8 3 L60 41.5 L112 3" fill="none" stroke="${C.gold}" stroke-width=".35" opacity=".7"/>
</svg>`;
}

// ============================================================================================ page script
// Runs inside Chromium. All guest text is inserted with textContent (never innerHTML).
const PAGE_SCRIPT = `
(async () => {
const D = JSON.parse(document.getElementById('data').textContent);
const ART = JSON.parse(document.getElementById('art').textContent);
const S = D.strings;
const t = (lang, key, vars = {}) => {
  let s = (S[lang] && S[lang][key]) ?? S.tr[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s.replace(/'/g, '\\u2019');
};
const PS = { tr: 'Not:', en: 'P.S.' };
const VOICE = { tr: 'Sesli not', en: 'Voice note' };
const BLEED = 3, TRIM = 200, M = { top: 17, bottom: 22, inner: 20, outer: 17 };
const BW = TRIM - M.inner - M.outer, BH = TRIM - M.top - M.bottom;   // content box 163 × 161 mm
const P = 2.6, PB = 9.5, GAP = 7;                                        // polaroid frame + gaps (mm)
const book = document.getElementById('book');
const warnings = [];
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const mm = (v) => v.toFixed(2) + 'mm';
const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; return d.firstElementChild; }; // trusted art only
let pageNo = 0;

function newPage(cls = '', { folio = false } = {}) {
  pageNo++;
  const recto = pageNo % 2 === 1;
  const page = el('section', 'page ' + cls + (recto ? ' recto' : ' verso'));
  page.dataset.n = pageNo;
  const box = el('div', 'box');
  Object.assign(box.style, {
    left: mm(BLEED + (recto ? M.inner : M.outer)), top: mm(BLEED + M.top), width: mm(BW), height: mm(BH),
  });
  page.append(box);
  if (folio) page.append(el('div', 'folio', String(pageNo)));
  book.append(page);
  return { page, box, recto, n: pageNo };
}
function dropPage(pg) { pg.page.remove(); pageNo--; }

// ---------------------------------------------------------------- images
async function loadImg(src) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ src, a: i.naturalWidth / i.naturalHeight, w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => { warnings.push('could not load ' + src); res(null); };
    i.src = src;
  });
}
for (const L of D.letters) {
  L.imgs = (await Promise.all(L.photos.map(loadImg))).filter(Boolean);
  L.full = L.wish + L.memory;
}

// ---------------------------------------------------------------- photo arrangement
// Every arrangement returns frames {i, x, y, w, h} (mm, polaroid outer box) inside a W × H area.
const frameW = (a, h) => h * a + 2 * P, frameH = (h) => h + P + PB;
function row(items, W, H) {
  const sa = items.reduce((s, it) => s + it.a, 0), n = items.length;
  let h = Math.min((W - GAP * (n - 1) - 2 * P * n) / sa, H - P - PB);
  if (!(h > 12)) return null;
  let x = 0; const fr = [];
  for (const it of items) { const w = frameW(it.a, h); fr.push({ i: it.i, x, y: 0, w, h: frameH(h), ph: h }); x += w + GAP; }
  return { fr, bw: x - GAP, bh: frameH(h) };
}
function col(items, W, H) {
  const n = items.length, si = items.reduce((s, it) => s + 1 / it.a, 0);
  let pw = Math.min(W - 2 * P, (H - n * (P + PB) - GAP * (n - 1)) / si);
  if (!(pw > 12)) return null;
  let y = 0; const fr = [];
  for (const it of items) { const ph = pw / it.a; fr.push({ i: it.i, x: 0, y, w: pw + 2 * P, h: frameH(ph), ph }); y += frameH(ph) + GAP; }
  const bw = pw + 2 * P;
  return { fr, bw, bh: y - GAP };
}
function shift(r, dx, dy) { r.fr.forEach((f) => { f.x += dx; f.y += dy; }); return r; }
function arrange(imgs, W, H) {
  const items = imgs.map((im, i) => ({ i, a: im.a }));
  const cands = [];
  const add = (r) => { if (r && r.bw <= W + .01 && r.bh <= H + .01) cands.push(r); };
  add(row(items, W, H));
  add(col(items, W, H));
  if (items.length >= 2) {
    for (const hero of items) {
      const rest = items.filter((x) => x !== hero);
      for (const f of [.42, .5, .58, .66]) {               // hero column + stacked rest
        const a = col([hero], W * f - GAP / 2, H), b = col(rest, W * (1 - f) - GAP / 2, H);
        if (a && b) {
          const bh = Math.max(a.bh, b.bh);
          shift(a, 0, (bh - a.bh) / 2); shift(b, a.bw + GAP, (bh - b.bh) / 2);
          add({ fr: [...a.fr, ...b.fr], bw: a.bw + GAP + b.bw, bh, heroSide: true });
        }
      }
      for (const g of [.45, .55, .65]) {                    // hero row + row of the rest
        const a = row([hero], W, H * g - GAP / 2), b = row(rest, W, H * (1 - g) - GAP / 2);
        if (a && b) {
          const bw = Math.max(a.bw, b.bw);
          shift(a, (bw - a.bw) / 2, 0); shift(b, (bw - b.bw) / 2, a.bh + GAP);
          add({ fr: [...a.fr, ...b.fr], bw, bh: a.bh + GAP + b.bh });
        }
      }
    }
  }
  let best = null;
  for (const c of cands) {
    const areas = c.fr.map((f) => (f.w - 2 * P) * f.ph);
    const total = areas.reduce((s, x) => s + x, 0);
    const score = total * Math.pow(Math.min(...areas) / Math.max(...areas), .35);
    if (!best || score > best.score) best = { ...c, score, area: total, minSide: Math.min(...c.fr.map((f) => Math.min(f.w - 2 * P, f.ph))) };
  }
  return best;
}
const TILT = [-2.1, 1.7, -1.2, 2.3, -1.6, 1.1];
function placePhotos(pg, L, arr, ox, oy, W, H, { align = 'center', outer = false } = {}) {
  const dx = ox + (W - arr.bw) / 2, dy = oy + (align === 'top' ? 0 : (H - arr.bh) / 2);
  arr.fr.forEach((f, k) => {
    const im = L.imgs[f.i];
    let x = dx + f.x;
    if (outer && pg.recto && arr.heroSide) x = dx + (arr.bw - f.x - f.w);    // hero towards the outer edge
    const pol = el('div', 'pol');
    Object.assign(pol.style, { left: mm(x), top: mm(dy + f.y), width: mm(f.w), height: mm(f.h),
      transform: 'rotate(' + TILT[(L.idx + k) % TILT.length] + 'deg)' });
    const img = el('img'); img.src = im.src; img.alt = '';
    Object.assign(img.style, { left: mm(P), top: mm(P), width: mm(f.w - 2 * P), height: mm(f.ph) });
    pol.append(img);
    if (f.w > 40) pol.append(el('i', 'tape t' + ((L.idx + k) % 3)));
    pg.box.append(pol);
  });
}

// ---------------------------------------------------------------- letter text
function lines(parent, text) {
  text.split('\\n').forEach((ln, i) => { if (i) parent.append(el('br')); parent.append(document.createTextNode(ln)); });
}
function fmtWhen(L) {
  const loc = L.lang === 'tr' ? 'tr-TR' : 'en-GB', d = new Date(L.created_at);
  const date = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: D.tz }).format(d);
  const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: D.tz }).format(d);
  return date + ', ' + time;
}
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
function signBlock(L) {
  const s = el('div', 'sign');
  s.append(el('span', 'from', t(L.lang, 'book.from', { name: L.name || t(L.lang, 'album.anonymous') })));
  s.append(el('span', 'when', fmtWhen(L)));
  if (L.audioSeconds || L.audio) {
    const v = el('span', 'voice'); v.append(html(ART.wave)); v.append(document.createTextNode(VOICE[L.lang]));
    if (L.audioSeconds) v.append(el('span', 'dur', mmss(L.audioSeconds)));
    s.append(v);
  }
  return s;
}
function buildText(L, { from = 0, to = L.full.length, sign = true, narrow = false, orn = false } = {}) {
  const w = el('div', 'lt' + (narrow ? ' narrow' : ''));
  w.lang = L.lang;
  if (orn && from === 0) w.append(html(ART.crown));
  const wl = L.wish.length;
  // printed salutation ("Sevgili Asya," / "Dear Asya,") unless the guest already greets Asya in their first words
  const greets = /asya/i.test(L.wish.slice(0, 40).split('\\n')[0]);
  if (from === 0 && L.full.trim() && !greets) w.append(el('p', 'salute', t(L.lang, 'guest.wishLabel')));
  const wishPart = L.full.slice(Math.min(from, wl), Math.min(to, wl)).trim();
  const memPart = L.full.slice(Math.max(from, wl), Math.max(to, wl)).trim();
  if (wishPart) wishPart.split(/\\n{2,}/).forEach((para) => { const p = el('p'); lines(p, para); w.append(p); });
  if (memPart) {
    const p = el('p', 'ps');
    if (from <= wl) p.append(el('span', 'ps-label', PS[L.lang]));
    lines(p, memPart); w.append(p);
  }
  if (to < L.full.length) w.append(el('p', 'more', '\\u2026'));
  if (sign) w.append(signBlock(L));
  return w;
}
function tbox(pg, x, y, w, h, cls = '') {
  const b = el('div', 'tbox ' + cls);
  Object.assign(b.style, { left: mm(x), top: mm(y), width: mm(w), height: mm(h) });
  pg.box.append(b);
  return b;
}
const overflows = (b) => b.scrollHeight > b.clientHeight + .5 || b.scrollWidth > b.clientWidth + .5;
function tryText(b, L, fs, opts) {
  b.replaceChildren(buildText(L, opts));
  b.style.setProperty('--fs', fs + 'pt');
  return !overflows(b);
}
// word boundaries where a long letter may break across pages
function cuts(L) {
  const c = [], s = L.full;
  for (let i = 1; i < s.length; i++) if (/\\s/.test(s[i - 1]) && !/\\s/.test(s[i])) c.push(i);
  if (L.wish.length && L.memory.length) c.push(L.wish.length);
  return [...new Set(c)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- layouts
function textFlow(L, fs, from, first) {
  // text-only pages from 'from' to the end, breaking at word boundaries
  const cs = cuts(L);
  let start = from, firstPage = first;
  while (true) {
    const pg = newPage('letter', { folio: true });
    if (firstPage) L.page = L.page || pg.n;
    const b = tbox(pg, 0, 0, BW, BH, 'top');
    if (tryText(b, L, fs, { from: start, narrow: true, orn: firstPage })) return;
    const opts = cs.filter((c) => c > start);
    let lo = 0, hi = opts.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (tryText(b, L, fs, { from: start, to: opts[mid], sign: false, narrow: true, orn: firstPage })) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) { warnings.push('could not fit text of ' + L.id); tryText(b, L, fs, { from: start, narrow: true }); return; }
    tryText(b, L, fs, { from: start, to: opts[best], sign: false, narrow: true, orn: firstPage });
    start = opts[best]; firstPage = false;
  }
}
function layoutTextOnly(L) {
  const pg = newPage('letter', { folio: true });
  L.page = pg.n;
  const b = tbox(pg, 0, 0, BW, BH, 'center');
  for (let fs = 16; fs >= 11; fs -= .5) if (tryText(b, L, fs, { narrow: true, orn: true })) return;
  dropPage(pg);
  textFlow(L, 12, 0, true);
}
function layoutPair(A, B) {
  const pg = newPage('letter', { folio: true });
  const half = (BH - 16) / 2;
  const ba = tbox(pg, 0, 0, BW, half, 'center'), bb = tbox(pg, 0, half + 16, BW, half, 'center');
  for (let fs = 14; fs >= 12; fs -= .5) {
    if (tryText(ba, A, fs, { narrow: true }) && tryText(bb, B, fs, { narrow: true })) {
      const r = html(ART.rule); r.classList.add('pair-rule');
      Object.assign(r.style, { position: 'absolute', left: mm((BW - 34) / 2), top: mm(half + 6.8), width: '34mm', margin: 0 });
      pg.box.append(r);
      A.page = B.page = pg.n;
      return true;
    }
  }
  dropPage(pg);
  return false;
}
function caption(pg, L, withDate) {
  // sender line on a photo page, on the outer side of the page
  const cap = el('div', 'caption');
  Object.assign(cap.style, pg.recto ? { right: '0', bottom: '0', textAlign: 'right' } : { left: '0', bottom: '0', textAlign: 'left' });
  if (withDate) {
    const s = signBlock(L); s.style.marginTop = '0'; s.style.alignItems = pg.recto ? 'flex-end' : 'flex-start'; s.style.textAlign = 'inherit';
    cap.append(s);
  } else cap.textContent = t(L.lang, 'book.from', { name: L.name || t(L.lang, 'album.anonymous') });
  pg.box.append(cap);
}
function layoutPhotoOnly(L) {
  const pg = newPage('letter', { folio: true });
  L.page = pg.n;
  const capH = 16;
  const arr = arrange(L.imgs, BW, BH - capH);
  placePhotos(pg, L, arr, 0, 0, BW, BH - capH, { outer: true });
  caption(pg, L, true);
}
const MAXTW = 140;   // comfortable line length for text under a photo row (mm)
function searchPhotoText(pg, b, L, { minSide, fonts }) {
  const GT = 8, MINW = 66, MINH = 26;
  let best = null;
  for (const fs of fonts) {
    for (const hp of [124, 114, 104, 94, 84, 74, 64, 56]) {      // photos above the text
      const arr = arrange(L.imgs, BW, hp); if (!arr || arr.minSide < minSide) continue;
      const th = BH - arr.bh - GT; if (th < MINH) continue;
      const tw = Math.min(BW, Math.max(arr.bw, 118), MAXTW), tx = (BW - tw) / 2;
      Object.assign(b.style, { left: mm(tx), top: mm(arr.bh + GT), width: mm(tw), height: mm(th) });
      if (tryText(b, L, fs, {})) {
        const score = arr.score * Math.pow(fs / 12, 2.2);
        if (!best || score > best.score) best = { score, fs, kind: 'top', arr, box: { x: tx, y: arr.bh + GT, w: tw, h: th } };
      }
    }
    for (const wp of [104, 96, 88, 80, 72, 64]) {                // photos in the outer column, text inside
      const arr = arrange(L.imgs, wp, BH); if (!arr || arr.minSide < minSide) continue;
      const tw = BW - arr.bw - GT; if (tw < MINW) continue;
      const tx = pg.recto ? 0 : arr.bw + GT;
      Object.assign(b.style, { left: mm(tx), top: '0', width: mm(tw), height: mm(BH) });
      if (tryText(b, L, fs, {})) {
        const score = arr.score * Math.pow(fs / 12, 2.2);
        if (!best || score > best.score) best = { score, fs, kind: 'side', arr, box: { x: tx, y: 0, w: tw, h: BH } };
      }
    }
  }
  return best;
}
const isCrampedBest = (best) => !best || best.fs < 11.75 || best.arr.minSide < 50;
function isCramped(L) {            // dry run: would this letter be squeezed on a single page?
  const pg = newPage('letter');
  const b = tbox(pg, 0, 0, BW, BH, 'top');
  const best = searchPhotoText(pg, b, L, { minSide: 34, fonts: [12.5, 12, 11.5, 11] });
  dropPage(pg);
  return isCrampedBest(best);
}
function layoutPhotoText(L) {
  const pg = newPage('letter', { folio: true });
  L.page = pg.n;
  const b = tbox(pg, 0, 0, BW, BH, 'top');
  let best = searchPhotoText(pg, b, L, { minSide: 34, fonts: [12.5, 12, 11.5, 11] });
  // A letter that only fits with small photos or small type gets a full spread instead
  // (photos on the left page, the letter facing it), but only when this is a left-hand page,
  // so photos and words are never separated by a page turn.
  const cramped = isCrampedBest(best);
  const spread = !pg.recto && (!best || cramped);
  if (!best && pg.recto) best = searchPhotoText(pg, b, L, { minSide: 24, fonts: [12, 11.5, 11, 10.5] });
  if (best && !spread) {
    const { arr, fs, box } = best;
    if (best.kind === 'top') placePhotos(pg, L, arr, 0, 0, BW, arr.bh, {});
    else placePhotos(pg, L, arr, pg.recto ? BW - arr.bw : 0, 0, arr.bw, BH, { outer: true });
    Object.assign(b.style, { left: mm(box.x), top: mm(box.y), width: mm(box.w), height: mm(box.h) });
    b.className = 'tbox ' + (best.kind === 'top' ? 'top' : 'middle');
    tryText(b, L, fs, {});
    return;
  }
  // full photo page, then the letter on the facing page (continuing overleaf if very long)
  b.remove();
  const arr = arrange(L.imgs, BW, BH - 14);
  placePhotos(pg, L, arr, 0, 0, BW, BH - 14, { outer: true });
  caption(pg, L, false);
  const nxt = newPage('letter', { folio: true });
  const tb = tbox(nxt, 0, 0, BW, BH, 'center');
  for (let fs = 14; fs >= 11; fs -= .5) if (tryText(tb, L, fs, { narrow: true, orn: true })) return;
  dropPage(nxt);
  textFlow(L, 12, 0, true);
}

// ---------------------------------------------------------------- front matter
function cover() {
  const pg = newPage('petal cover');
  pg.box.remove();
  const c = el('div', 'cover-in');
  c.append(html(ART.crownCover), html(ART.nameCover));
  const env = el('div', 'envelope'); env.append(html(ART.envelope), html(ART.sealCover)); c.append(env);
  const subs = el('div', 'cover-subs');
  for (const lang of ['tr', 'en']) { const p = el('p', 'cover-sub', t(lang, 'book.subtitle')); p.lang = lang; subs.append(p); }
  c.append(subs);
  const date = el('div', 'cover-date'); date.append(el('i'), el('span', '', D.partyDate.split('-').reverse().join('.')), el('i'));
  c.append(date);
  pg.page.append(c);
  if (D.sample) pg.page.append(el('div', 'sample-tag', '\\u00d6rnek kitap / Sample book'));
}
function dedication() {
  const pg = newPage('ded');
  pg.box.remove();
  const c = el('div', 'center-col');
  c.append(html(ART.crownSmall));
  for (const lang of ['tr', 'en']) { const h = el('h2', '', t(lang, 'book.cover')); h.lang = lang; c.append(h); }
  c.append(html(ART.rule));
  const tr = el('p', '', ART.ded.tr); tr.lang = 'tr';
  const en = el('p', '', ART.ded.en); en.lang = 'en';
  c.append(tr, en);
  const sig = el('div', 'sig'); sig.append(el('div', '', ART.ded.signTr), el('div', '', ART.ded.signEn));
  c.append(sig);
  pg.page.append(c);
}
function notesPage() {
  const pg = newPage('notes', { folio: true });
  const h = el('h2', '', 'Asya\\u2019ya notlar  /  Notes for Asya');
  pg.page.append(h);
  const ls = el('div', 'lines');
  Object.assign(ls.style, { left: pg.box.style.left, width: mm(BW) });
  for (let i = 0; i < 14; i++) ls.append(el('i'));
  pg.page.append(ls);
  pg.box.remove();
}
function ornamentPage() {
  const pg = newPage('orn-page');
  pg.box.remove();
  const c = el('div', 'center-col');
  c.append(html(ART.crownSmall), html(ART.nameSmall), el('div', 'when', D.partyDate.split('-').reverse().join('.')));
  pg.page.append(c);
}
function closing(stats) {
  const pg = newPage('petal closing');
  pg.box.remove();
  const c = el('div', 'center-col');
  const seal = el('div', 'seal-wrap'); seal.append(html(ART.sealBack)); c.append(seal);
  for (const lang of ['tr', 'en']) { const h = el('h2', '', t(lang, 'thanks.signoff')); h.lang = lang; c.append(h); }
  c.append(html(ART.rule));
  for (const lang of ['tr', 'en']) {
    const p = el('p', 'counts', t(lang, 'album.count', { n: stats.letters, p: stats.photos, a: stats.audio })); p.lang = lang; c.append(p);
  }
  const d = new Date(D.partyDate + 'T12:00:00Z');
  const place = el('div', 'place');
  for (const lang of ['tr', 'en']) {
    const ds = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    place.append(el('div', '', ART.place[lang] + ', ' + ds));
  }
  c.append(place);
  if (D.sample) c.append(el('div', 'sample-note', '\\u00d6rnek i\\u00e7erik: misafir mektuplar\\u0131 ve foto\\u011fraflar temsilidir. / Sample content: letters and photos are placeholders.'));
  pg.page.append(c);
}

// ---------------------------------------------------------------- build
cover();
dedication();
const Ls = D.letters;
Ls.forEach((L, i) => { L.idx = i; });
const kind = (L) => !L.full.trim() ? (L.imgs.length ? 'photos' : 'text') : (L.imgs.length ? 'mixed' : 'text');
const pairable = (A, B) => A && B && kind(A) === 'text' && kind(B) === 'text' && A.full.trim() && B.full.trim()
  && A.full.length < 420 && B.full.length < 420;
function layoutOne(L) {
  const k = kind(L);
  if (k === 'text') layoutTextOnly(L); else if (k === 'photos') layoutPhotoOnly(L); else layoutPhotoText(L);
}
for (let i = 0; i < Ls.length; i++) {
  const L = Ls[i];
  const hasText = L.full.trim().length > 0;
  // A letter that needs a whole spread should start on a left-hand page. If it would land on a
  // right-hand page, let the next (single-page) letter go first.
  const N = Ls[i + 1];
  if (kind(L) === 'mixed' && (pageNo + 1) % 2 === 1 && N && isCramped(L)) {
    const nSingle = kind(N) === 'photos' || (kind(N) === 'text' && N.full.length < 700) || (kind(N) === 'mixed' && !isCramped(N));
    if (nSingle) {
      const N2 = Ls[i + 2];
      if (pairable(N, N2) && layoutPair(N, N2)) { layoutPhotoText(L); i += 2; continue; }
      layoutOne(N); layoutPhotoText(L); i++; continue;
    }
  }
  if (!L.imgs.length && hasText) {
    const N = Ls[i + 1];
    if (pairable(L, Ls[i + 1]) && layoutPair(L, Ls[i + 1])) { i++; continue; }
    layoutTextOnly(L);
  } else if (!hasText) {
    if (L.imgs.length) layoutPhotoOnly(L);
    else { // voice-note-only letter
      layoutTextOnly(L);
    }
  } else {
    layoutPhotoText(L);
  }
}
const stats = {
  letters: Ls.length,
  photos: Ls.reduce((s, L) => s + L.imgs.length, 0),
  audio: Ls.filter((L) => L.audio).length,
};
// pad to a multiple of 4 (closing page is the back cover)
const pad = (4 - ((pageNo + 1) % 4)) % 4;
if (pad === 3) ornamentPage();
for (let k = 0; k < Math.min(pad, 2); k++) notesPage();
closing(stats);

await document.fonts.ready;
await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
window.__result = { pages: pageNo, stats, warnings, index: Ls.map((L) => ({ id: L.id, name: L.name, lang: L.lang, page: L.page, audio: L.audio })) };
})().catch((e) => { window.__result = { error: String(e && e.stack || e) }; });
`;

// ============================================================================================ render
const ART = {
  crown: crownSvg('orn').replace('<svg ', '<svg class="orn" '),
  crownCover: crownSvg('cc').replace('<svg ', '<svg class="crown" '),
  crownSmall: crownSvg('cs').replace('<svg ', '<svg class="crown" '),
  nameCover: nameSvg({ id: 'nc' }),
  nameSmall: nameSvg({ id: 'ns', shadow: false }),
  envelope: envelopeSvg(),
  sealCover: sealSvg({ id: 'sc' }),
  sealBack: sealSvg({ id: 'sb', seed: 9 }),
  rule: RULE_SVG,
  wave: WAVE_SVG,
  ded: { tr: typo(DEDICATION.tr), en: typo(DEDICATION.en), signTr: typo(DEDICATION.signTr), signEn: typo(DEDICATION.signEn) },
  place: PLACE,
};
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const htmlDoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>${esc(typo(STRINGS.tr['book.cover']))} / ${esc(typo(STRINGS.en['book.cover']))}</title>
<link rel="stylesheet" href="${FONTS_HREF}">
<style>${CSS}</style>
<script>${TEXTURE_SCRIPT}</script>
</head><body>
<main id="book"></main>
<script type="application/json" id="data">${json(DATA)}</script>
<script type="application/json" id="art">${json(ART)}</script>
<script type="module">
await document.fonts.load('400 12pt "Nunito"', 'İıŞşĞğÜüÖöÇç'); await document.fonts.load('italic 400 12pt "Nunito"', 'İıŞş');
await document.fonts.load('400 12pt "Yeseva One"', 'İıŞşĞğ'); await document.fonts.load('400 12pt "Pinyon Script"', 'Asya Duru');
await document.fonts.ready;
${PAGE_SCRIPT}
</script>
</body></html>`;

const htmlPath = path.join(exportDir, 'book.html');
writeFileSync(htmlPath, htmlDoc);
console.log(`Book from ${exportDir}${isSample ? '  (SAMPLE content)' : ''}: ${letters.length} letters`);

const browser = await launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.warn('  [page]', m.text()); });
page.on('pageerror', (e) => console.warn('  [page error]', e.message));
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.waitForFunction(() => window.__result, null, { timeout: 180000 });
const result = await page.evaluate(() => window.__result);
if (result.error) { console.error('Layout failed:\n' + result.error); await browser.close(); process.exit(1); }
await settle(page);
mkdirSync(BOOK, { recursive: true });
await page.pdf({ path: pdfPath, width: '206mm', height: '206mm', printBackground: true, preferCSSPageSize: true });
await browser.close();
for (const w of result.warnings) console.warn('  !', w);

// ---- verify with pypdf + set TrimBox/BleedBox for the print shop
const py = `
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
r = PdfReader(sys.argv[1]); w = PdfWriter()
mm = 72 / 25.4
sizes = set()
for p in r.pages:
    W, H = float(p.mediabox.width), float(p.mediabox.height)
    sizes.add((round(W / mm, 2), round(H / mm, 2)))
    b = 3 * mm
    p.trimbox = RectangleObject([b, b, W - b, H - b])
    p.bleedbox = RectangleObject([0, 0, W, H])
    w.add_page(p)
w.add_metadata({'/Title': sys.argv[2], '/Author': 'Asya Duru ailesi / family', '/Creator': 'asya4 tools/make-book.mjs'})
w.write(sys.argv[1])
print(len(r.pages), ';'.join(f'{a:.2f}x{b:.2f}' for a, b in sorted(sizes)))
`;
const chk = spawnSync('python3', ['-c', py, pdfPath, `${typo(STRINGS.tr['book.cover'])} / ${typo(STRINGS.en['book.cover'])}`], { encoding: 'utf8' });
let pageCount = result.pages;
if (chk.status === 0) {
  const [n, sizes] = chk.stdout.trim().split(' ');
  pageCount = +n;
  const okSize = sizes.split(';').length === 1 && sizes.split('x').every((v) => Math.abs(parseFloat(v) - 206) < 0.1);
  console.log(`  pypdf: ${n} pages, page size ${sizes} mm ${okSize ? '(200×200 trim + 3 mm bleed) OK' : 'UNEXPECTED'}; multiple of 4: ${n % 4 === 0 ? 'yes' : 'NO'}`);
  if (!okSize || n % 4 !== 0) process.exitCode = 1;
} else {
  console.warn('  ! pypdf check skipped (pip install pypdf --break-system-packages):', (chk.stderr || '').trim().split('\n').pop());
}

// ---- previews
for (const f of readdirSync(previewDir)) if (f.endsWith('.png')) unlinkSync(path.join(previewDir, f));
const pp = spawnSync('pdftoppm', ['-png', '-r', '80', pdfPath, path.join(previewDir, 'page')]);
if (pp.error) console.warn('  ! pdftoppm not found; no PNG previews');

// ---- voice notes, named by the page they appear on
const withAudio = result.index.filter((x) => x.audio);
if (withAudio.length) {
  const vdir = path.join(exportDir, 'sesli-notlar');
  rmSync(vdir, { recursive: true, force: true });
  mkdirSync(vdir, { recursive: true });
  const w = String(pageCount).length;
  for (const x of withAudio) {
    const src = path.join(exportDir, x.audio);
    if (!existsSync(src)) continue;
    const who = (x.name || STRINGS[x.lang]['album.anonymous']).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
    copyFileSync(src, path.join(vdir, `${String(x.page).padStart(w, '0')} - ${who}${path.extname(src)}`));
  }
  console.log(`  ${withAudio.length} voice note(s) copied to ${vdir} (file number = book page)`);
}
console.log(`  ${result.stats.letters} letters, ${result.stats.photos} photos, ${result.stats.audio} voice notes, ${pageCount} pages`);
console.log(`Wrote ${pdfPath}\n  previews: ${previewDir}`);
