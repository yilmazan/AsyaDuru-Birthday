#!/usr/bin/env node
// Usage: node make-cards.mjs           (run `node make-qr.mjs <url>` first)
// Renders print-ready PDFs + PNG previews from print/qr.svg:
//   print/table-card-A6.pdf      print-shop tent: two A6 faces (105×148) on a 105×296 strip, 3 mm bleed,
//                                crop + fold marks; top face is upside down so both read upright when folded
//   print/table-card-A4-2up.pdf  home printing: two tents side by side on A4 (cut down the middle, fold across)
//   print/cards-A4-4up.pdf       four flat A6 cards on A4 with cut lines
//   print/poster-A3.pdf          A3 poster (same design scaled ×2.83, QR ≈ 158 mm)
//   print/previews/*.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { launch, settle, FONTS_HREF } from './lib/browser.mjs';
import { C, PRINT, TOOLS, crownSvg, sealSvg, nameSvg, TEXTURE_SCRIPT, esc, typo } from './lib/art.mjs';
import { STRINGS } from '../assets/js/i18n.js';

const qrJsonPath = path.join(PRINT, 'qr.json');
if (!existsSync(qrJsonPath)) {
  console.error('print/qr.json not found. Run first:  node make-qr.mjs <url>');
  process.exit(2);
}
const QR = JSON.parse(readFileSync(qrJsonPath, 'utf8'));
// Inline the QR without its own white plate: the letter paper is its quiet zone (still light, high contrast).
const qrSvg = readFileSync(path.join(PRINT, 'qr.svg'), 'utf8')
  .replace(/<rect width="[\d.]+" height="[\d.]+" rx="[\d.]+" fill="#FFFFFF"\/>/, '')
  .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"');

// ---- copy (both languages carry equal weight: same face, size, colour)
const COPY = {
  ctaTr: typo(STRINGS.tr['welcome.title']),           // Prenses Asya’ya bir mektup yaz
  ctaEn: typo(STRINGS.en['welcome.title']),           // Write a letter to Princess Asya
  howTr: 'Telefonunun kamerasıyla okut',
  howEn: 'Scan with your phone camera',
};

const PREVIEWS = path.join(PRINT, 'previews');
mkdirSync(PREVIEWS, { recursive: true });

// --------------------------------------------------------------------------- one A6 face
// Everything is measured in --u (1 mm on an A6 face). The poster sets --u to 2.83 mm.
const u = (x) => `calc(var(--u) * ${x})`;
let faceN = 0;
function face({ x = 0, y = 0, rotate = false, unit = '1mm' } = {}) {
  const n = ++faceN;
  return `
<section class="face" style="--u:${unit}; left:${x}mm; top:${y}mm;${rotate ? ' transform:rotate(180deg);' : ''}">
  <div class="crown">${crownSvg('cr' + n)}</div>
  <h1 class="name">${nameSvg({ id: 'nm' + n })}</h1>
  <p class="cta" lang="tr">${esc(COPY.ctaTr)}</p>
  <svg class="rule" viewBox="0 0 120 8" aria-hidden="true">
    <path d="M6 4 Q33 1.8 52 4 Q33 6.2 6 4Z" fill="${C.gold}"/>
    <path d="M114 4 Q87 1.8 68 4 Q87 6.2 114 4Z" fill="${C.gold}"/>
    <path d="M60 .6 L63.2 4 L60 7.4 L56.8 4Z" fill="${C.wax}"/>
  </svg>
  <p class="cta" lang="en">${esc(COPY.ctaEn)}</p>
  <div class="letter">
    <div class="qr">${qrSvg}</div>
    <div class="seal-wrap">${sealSvg({ id: 'sl' + n })}</div>
  </div>
  <p class="url">${esc(QR.short)}</p>
  <p class="how"><span lang="tr">${esc(COPY.howTr)}</span><span lang="en">${esc(COPY.howEn)}</span></p>
</section>`;
}

const CSS = `
@page { margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: ${C.ink}; font-family: 'Nunito', system-ui, sans-serif; }
.sheet { position: relative; overflow: hidden; break-after: page; background: #fff; }
.sheet:last-child { break-after: auto; }
.petal {
  position: absolute;
  background-color: ${C.petal};
  background-image: var(--tex),
    radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%),
    radial-gradient(90% 60% at 50% 105%, rgba(220,203,240,.45), rgba(220,203,240,0) 70%);
  background-size: 64mm 64mm, 100% 100%, 100% 100%;
}
.face {
  position: absolute; width: ${u(105)}; height: ${u(148)};
  display: flex; flex-direction: column; align-items: center;
  padding: ${u(8)} ${u(8)} ${u(7)};
  transform-origin: 50% 50%;
}
.crown { width: ${u(15.5)}; margin-bottom: ${u(-1)}; }
.crown svg { width: 100%; height: auto; display: block; }
.name { margin: 0; width: ${u(74)}; line-height: 0; font-weight: 400; }
.name svg { display: block; width: 100%; height: auto; overflow: visible; }
.cta {
  margin: 0; font-family: 'Yeseva One', Georgia, serif; font-weight: 400;
  font-size: ${u(4.95)}; line-height: 1.2; letter-spacing: .005em; text-align: center; white-space: nowrap;
}
.cta[lang="tr"] { margin-top: ${u(1)}; }
.rule { width: ${u(36)}; height: ${u(2.6)}; margin: ${u(1.9)} 0 ${u(1.6)}; display: block; }
.letter {
  position: relative; margin-top: ${u(4.4)};
  width: ${u(61)}; padding: ${u(2.2)};
  background-color: ${C.paper};
  background-image: var(--tex-paper);
  background-size: 50mm 50mm;
  border-radius: ${u(1.2)};
  box-shadow: 0 ${u(0.25)} 0 rgba(94,24,56,.10), 0 ${u(2.4)} ${u(4.5)} ${u(-1.6)} rgba(94,24,56,.38);
  transform: rotate(-1.1deg);
}
.qr { width: ${u(56.6)}; height: ${u(56.6)}; }
.qr svg { display: block; }
.url {
  margin: ${u(3.9)} 0 0; text-align: center; font-weight: 700; font-size: ${u(2.45)};
  letter-spacing: .015em; color: ${C.inkSoft}; white-space: nowrap;
}
.seal-wrap { position: absolute; width: ${u(17)}; height: ${u(17)}; right: ${u(-10)}; bottom: ${u(-10)}; transform: rotate(-8deg);
  filter: drop-shadow(0 ${u(0.6)} ${u(0.8)} rgba(94,24,56,.45)); }
.seal { width: 100%; height: 100%; display: block; }
.how {
  margin: auto 0 0; padding-top: ${u(2)}; display: flex; flex-direction: column; align-items: center; gap: ${u(0.3)};
  font-size: ${u(3.15)}; font-weight: 700; line-height: 1.25; color: ${C.ink}; text-align: center;
}
/* marks */
.mark { position: absolute; background: #000; }
.cut { position: absolute; border: 0 dashed ${C.inkSoft}; opacity: .55; }
.note { position: absolute; font: 600 2.3mm/1.2 'Nunito', sans-serif; color: #555; white-space: nowrap; }
`;

function doc(pages, size) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_HREF}">
<style>${CSS} @page { size: ${size.w}mm ${size.h}mm; } .sheet { width: ${size.w}mm; height: ${size.h}mm; }</style>
<script>${TEXTURE_SCRIPT}</script>
</head><body>${pages.join('\n')}</body></html>`;
}

// crop mark helpers (black hairlines outside the bleed)
function cropMarks(tx, ty, tw, th, { gap = 3.5, len = 5, w = 0.2 } = {}) {
  const m = [];
  for (const x of [tx, tx + tw]) {
    m.push(`<div class="mark" style="left:${x - w / 2}mm; top:${ty - gap - len}mm; width:${w}mm; height:${len}mm"></div>`);
    m.push(`<div class="mark" style="left:${x - w / 2}mm; top:${ty + th + gap}mm; width:${w}mm; height:${len}mm"></div>`);
  }
  for (const y of [ty, ty + th]) {
    m.push(`<div class="mark" style="top:${y - w / 2}mm; left:${tx - gap - len}mm; height:${w}mm; width:${len}mm"></div>`);
    m.push(`<div class="mark" style="top:${y - w / 2}mm; left:${tx + tw + gap}mm; height:${w}mm; width:${len}mm"></div>`);
  }
  return m.join('');
}

// --------------------------------------------------------------------------- layouts
function tentPrintShop() {
  // trim 105×296, bleed 3, slug 10 → media 125×316
  const S = 10, B = 3, W = 105, H = 296;
  const tx = S, ty = S;
  const fold = ty + H / 2;
  const marks = cropMarks(tx, ty, W, H) +
    // fold marks (dashed) in the slug
    `<div class="cut" style="left:${tx - S + 1}mm; top:${fold}mm; width:${S - 1 - B - 1}mm; border-top-width:.25mm"></div>` +
    `<div class="cut" style="left:${tx + W + B + 1}mm; top:${fold}mm; width:${S - 1 - B - 1}mm; border-top-width:.25mm"></div>`;
  const page = `<div class="sheet">
    <div class="petal" style="left:${tx - B}mm; top:${ty - B}mm; width:${W + 2 * B}mm; height:${H + 2 * B}mm"></div>
    ${face({ x: tx, y: ty, rotate: true })}
    ${face({ x: tx, y: ty + H / 2 })}
    ${marks}
  </div>`;
  return { html: doc([page], { w: W + 2 * S, h: H + 2 * S }), size: { w: W + 2 * S, h: H + 2 * S }, trim: { x: tx, y: ty, w: W, h: H }, bleed: B };
}

function tentA4() {
  const W = 210, H = 297;
  const faces = [0, 105].map((x) => face({ x, y: 0, rotate: true }) + face({ x, y: H / 2 })).join('');
  const guides =
    `<div class="cut" style="left:105mm; top:0; height:${H}mm; border-left-width:.2mm"></div>` +
    // fold ticks at the outer edges and centre
    [0, 101, 105.4, 206].map((x) => `<div class="cut" style="left:${x}mm; top:${H / 2}mm; width:4mm; border-top-width:.25mm; opacity:.45"></div>`).join('');
  const page = `<div class="sheet"><div class="petal" style="inset:0"></div>${faces}${guides}</div>`;
  return { html: doc([page], { w: W, h: H }), size: { w: W, h: H } };
}

function fourUp() {
  const W = 210, H = 297;
  const faces = [[0, 0], [105, 0], [0, 148.5], [105, 148.5]].map(([x, y]) => face({ x, y: y + 0.25 })).join('');
  const guides =
    `<div class="cut" style="left:105mm; top:0; height:${H}mm; border-left-width:.2mm"></div>` +
    `<div class="cut" style="top:148.5mm; left:0; width:${W}mm; border-top-width:.2mm"></div>`;
  const page = `<div class="sheet"><div class="petal" style="inset:0"></div>${faces}${guides}</div>`;
  return { html: doc([page], { w: W, h: H }), size: { w: W, h: H } };
}

function posterA3() {
  const W = 297, H = 420, k = W / 105; // 2.829
  const page = `<div class="sheet"><div class="petal" style="inset:0; background-size: 90mm 90mm, 100% 100%, 100% 100%"></div>
    ${face({ x: 0, y: (H - 148 * k) / 2, unit: `${k}mm` })}</div>`;
  return { html: doc([page], { w: W, h: H }), size: { w: W, h: H } };
}

// --------------------------------------------------------------------------- render
const browser = await launch();
async function render(name, { html, size, trim, bleed }) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await settle(page);
  const pdfPath = path.join(PRINT, name + '.pdf');
  await page.pdf({ path: pdfPath, width: `${size.w}mm`, height: `${size.h}mm`, printBackground: true, preferCSSPageSize: true });
  await page.close();
  if (trim) setBoxes(pdfPath, trim, bleed, size);
  // preview straight from the PDF (what the printer gets)
  for (const f of readdirSync(PREVIEWS)) if (f.startsWith(name + '-') || f === name + '.png') unlinkSync(path.join(PREVIEWS, f));
  const r = spawnSync('pdftoppm', ['-png', '-r', name.startsWith('poster') ? '60' : '150', '-singlefile', pdfPath, path.join(PREVIEWS, name)]);
  if (r.error) console.warn('  ! pdftoppm missing, no PNG preview for', name);
  console.log(`  ${pdfPath}  (${size.w}×${size.h} mm)`);
  return path.join(PREVIEWS, name + '.png');
}

/** Sets TrimBox/BleedBox so print-shop software knows where to cut. */
function setBoxes(pdfPath, trim, bleed, size) {
  const mm = 72 / 25.4;
  const py = `
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
r = PdfReader(sys.argv[1]); w = PdfWriter()
H = ${size.h * mm}
for p in r.pages:
    tx, ty, tw, th, b = ${trim.x * mm}, ${trim.y * mm}, ${trim.w * mm}, ${trim.h * mm}, ${bleed * mm}
    p.trimbox = RectangleObject([tx, H - ty - th, tx + tw, H - ty])
    p.bleedbox = RectangleObject([tx - b, H - ty - th - b, tx + tw + b, H - ty + b])
    w.add_page(p)
w.add_metadata(r.metadata or {})
w.write(sys.argv[1])
`;
  const r = spawnSync('python3', ['-c', py, pdfPath], { encoding: 'utf8' });
  if (r.status !== 0) console.warn('  ! could not set TrimBox/BleedBox (pip install pypdf --break-system-packages):', (r.stderr || '').trim().split('\n').pop());
}

console.log(`Cards for ${QR.url}`);
const previews = [];
previews.push(await render('table-card-A6', tentPrintShop()));
previews.push(await render('table-card-A4-2up', tentA4()));
previews.push(await render('cards-A4-4up', fourUp()));
previews.push(await render('poster-A3', posterA3()));
await browser.close();

console.log('Scan check on the rendered previews (every QR on the page must read the URL):');
const expectCodes = { 'table-card-A6': 2, 'table-card-A4-2up': 4, 'cards-A4-4up': 4, 'poster-A3': 1 };
const v = spawnSync('python3', [path.join(TOOLS, 'verify-scan.py'), QR.url,
  ...previews.filter(existsSync).map((f) => `${f}:${expectCodes[path.basename(f, '.png')] || 1}`)], { encoding: 'utf8' });
process.stdout.write(v.stdout || '');
if (v.status === 1) { console.error('A card QR did not decode. Do not print.'); process.exit(1); }
console.log(`Previews in ${PREVIEWS}`);
