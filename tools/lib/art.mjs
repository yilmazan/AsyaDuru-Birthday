// Shared print artwork: the crown (reused from assets/img/crown.svg), the wax seal "4",
// a paper-fibre texture and the print palette.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TOOLS = path.join(ROOT, 'tools');
export const PRINT = path.join(ROOT, 'print');

// Same values as assets/css/theme.css (kept here because print pages don't load theme.css).
export const C = {
  petal: '#FBE4E8', petalDeep: '#F5CCD6', paper: '#FFFAF7', paperLine: '#EBD3DA',
  ink: '#5E1838', inkSoft: '#8A4F69', wax: '#B8325F', waxDeep: '#8E1F46', waxGlow: '#E7799C',
  gold: '#C9A13B', goldLight: '#F0D88E', goldDeep: '#96711E', lilac: '#DCCBF0', lilacDeep: '#9B7FC4',
  night: '#2A1433',
};

/** Crown SVG markup with ids prefixed so several copies can live on one page. */
export function crownSvg(prefix = 'cr', attrs = '') {
  let s = readFileSync(path.join(ROOT, 'assets/img/crown.svg'), 'utf8');
  s = s.replace(/id="([^"]+)"/g, `id="${prefix}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
  return s.replace('<svg ', `<svg ${attrs} `);
}

/** Inner content (no outer <svg>) of the crown, for nesting inside another SVG. */
export function crownInner(prefix = 'cr') {
  const s = crownSvg(prefix);
  return s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

/** Deterministic PRNG so every render is identical. */
export function rng(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wax seal with an embossed "4". Organic, slightly irregular edge like pressed wax.
 * Uses Yeseva One from the page's fonts.
 */
export function sealSvg({ id = 'seal', label = '4', seed = 4 } = {}) {
  const r = rng(seed);
  const pts = [];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rad = 46 + (r() - 0.5) * 3.2 + (i % 2 ? 1.6 : -0.4);
    pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]);
  }
  // smooth closed path through points (Catmull-Rom → Bézier)
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `<svg class="seal" viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-w" cx=".36" cy=".3" r=".8">
      <stop offset="0" stop-color="#E7799C"/><stop offset=".42" stop-color="#B8325F"/><stop offset="1" stop-color="#7A1A3C"/>
    </radialGradient>
    <radialGradient id="${id}-in" cx=".62" cy=".7" r=".75">
      <stop offset="0" stop-color="#C23D69"/><stop offset=".7" stop-color="#A02852"/><stop offset="1" stop-color="#8E1F46"/>
    </radialGradient>
  </defs>
  <path d="${d}" fill="url(#${id}-w)"/>
  <circle cx="50" cy="50" r="35.5" fill="url(#${id}-in)"/>
  <circle cx="50" cy="50" r="35.5" fill="none" stroke="#7A1A3C" stroke-width="1.6" opacity=".55"/>
  <circle cx="50.6" cy="50.8" r="35.5" fill="none" stroke="#F3A3BD" stroke-width=".9" opacity=".55" stroke-dasharray="60 160" stroke-dashoffset="-120"/>
  <circle cx="50" cy="50" r="30.5" fill="none" stroke="#F0D88E" stroke-width=".7" stroke-dasharray=".2 2.4" stroke-linecap="round" opacity=".9"/>
  <text x="51.2" y="70.6" text-anchor="middle" font-family="'Yeseva One', Georgia, serif" font-size="54" fill="#6E1535" opacity=".7">${label}</text>
  <text x="50" y="69" text-anchor="middle" font-family="'Yeseva One', Georgia, serif" font-size="54" fill="#FFE9EF">${label}</text>
  <path d="M24 32 Q30 22 42 18" fill="none" stroke="#FFD3E0" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
</svg>`;
}

/** "Asya Duru" set in Pinyon Script with a gold-leaf gradient (SVG text → stays vector in PDF). */
export function nameSvg({ id = 'nm', text = 'Asya Duru', width = 100, shadow = true } = {}) {
  // viewBox sized for Pinyon Script at font-size 100; generous so swashes are never clipped
  return `<svg class="name-svg" viewBox="0 0 520 150" style="width:${width}%" aria-label="${text}">
  <defs>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2=".35">
      <stop offset="0" stop-color="#8A6518"/><stop offset=".22" stop-color="#C9A13B"/>
      <stop offset=".40" stop-color="#E9CC7A"/><stop offset=".52" stop-color="#B98E2C"/>
      <stop offset=".74" stop-color="#D9B65C"/><stop offset="1" stop-color="#8A6518"/>
    </linearGradient>
  </defs>
  ${shadow ? `<text x="261.5" y="104" text-anchor="middle" font-family="'Pinyon Script', cursive" font-size="112" fill="#7A1A3C" opacity=".14">${text}</text>` : ''}
  <text x="260" y="102" text-anchor="middle" font-family="'Pinyon Script', cursive" font-size="112" fill="url(#${id}-g)" stroke="#7E5C14" stroke-width=".6" stroke-opacity=".55">${text}</text>
</svg>`;
}

/**
 * In-page script that paints a subtle paper-fibre texture onto a canvas and exposes it as
 * CSS custom property --tex (data URL). Deterministic.
 */
export const TEXTURE_SCRIPT = `
(() => {
  function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function make(seed, ink, light, n){
    const S = 900, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < n; i++) {               // soft mottling
      const x = r()*S, y = r()*S, rad = 30 + r()*120;
      const grd = g.createRadialGradient(x,y,0,x,y,rad);
      const col = r() < .5 ? ink : light;
      grd.addColorStop(0, col.replace('A', (0.018 + r()*0.02).toFixed(3)));
      grd.addColorStop(1, col.replace('A', '0'));
      g.fillStyle = grd; g.fillRect(x-rad, y-rad, rad*2, rad*2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {             // fibres
      const x = r()*S, y = r()*S, len = 4 + r()*16, a = r()*Math.PI*2;
      g.strokeStyle = (r() < .6 ? ink : light).replace('A', (0.05 + r()*0.08).toFixed(3));
      g.lineWidth = .5 + r()*.8;
      g.beginPath(); g.moveTo(x,y);
      g.quadraticCurveTo(x + Math.cos(a+.6)*len*.5, y + Math.sin(a+.6)*len*.5, x + Math.cos(a)*len, y + Math.sin(a)*len);
      g.stroke();
    }
    for (let i = 0; i < 2600; i++) {            // specks
      g.fillStyle = (r() < .55 ? ink : light).replace('A', (0.04 + r()*0.07).toFixed(3));
      const s = .6 + r()*1.1; g.fillRect(r()*S, r()*S, s, s);
    }
    return c.toDataURL('image/png');
  }
  const root = document.documentElement.style;
  root.setProperty('--tex', 'url(' + make(11, 'rgba(142,31,70,A)', 'rgba(255,255,255,A)', 160) + ')');
  root.setProperty('--tex-paper', 'url(' + make(23, 'rgba(150,113,30,A)', 'rgba(255,255,255,A)', 120) + ')');
})();
`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Straight apostrophes → typographic ones for print. */
export const typo = (s) => String(s).replace(/'/g, '’');
