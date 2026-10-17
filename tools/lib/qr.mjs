// Stylised, high-contrast QR code as SVG.
// The `qrcode` package is used ONLY to compute the module matrix (error correction H);
// every shape is drawn here: rounded "pill" modules, custom finder eyes with a wax centre,
// rounded alignment patterns and the shared crown on a small white plate in the middle.
import { createRequire } from 'node:module';
import QRCode from 'qrcode';
import { C, crownInner } from './art.mjs';

const require = createRequire(import.meta.url);
const AlignmentPattern = require('qrcode/lib/core/alignment-pattern.js');

const QUIET = 4;          // modules of quiet zone (spec minimum)
const MAX_PLATE = 0.09;   // crown plate may cover at most 9 % of the symbol area

export function qrMatrix(url) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const N = qr.modules.size;
  const dark = (r, c) => r >= 0 && c >= 0 && r < N && c < N && !!qr.modules.data[r * N + c];
  return { qr, N, dark, version: qr.version };
}

function roundedRect(x, y, w, h, r) {
  if (!r) return `M${x},${y}h${w}v${h}h-${w}z`;
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}

/**
 * @returns {{ svg: string, version: number, size: number, plateRatio: number }}
 */
export function buildQrSvg(url, { withCrown = true, px = 512, eyeR = 0, eyeInnerR = 0.55, eyeColor = C.wax, moduleR = 0.5 } = {}) {
  const { N, dark, version } = qrMatrix(url);
  const T = N + QUIET * 2;
  const o = QUIET;

  // --- areas drawn by hand (finders incl. separators, alignment patterns)
  const custom = new Uint8Array(N * N);
  const mark = (r0, c0, size) => {
    for (let r = r0; r < r0 + size; r++) for (let c = c0; c < c0 + size; c++) if (r >= 0 && c >= 0 && r < N && c < N) custom[r * N + c] = 1;
  };
  const finders = [[0, 0], [0, N - 7], [N - 7, 0]];
  finders.forEach(([r, c]) => mark(r - 1, c - 1, 9));
  const align = AlignmentPattern.getPositions(version).filter(([r, c]) => !custom[r * N + c]);
  align.forEach(([r, c]) => mark(r - 2, c - 2, 5));

  // --- centre plate for the crown (odd size, centred on the module grid, ≤ 9 % of area)
  let s = 0;
  if (withCrown) {
    s = Math.floor(Math.sqrt(MAX_PLATE * N * N));
    if (s % 2 !== N % 2) s -= 1;
    const overlaps = (sz) => {
      const a = (N - sz) / 2;
      for (let r = a; r < a + sz; r++) for (let c = a; c < a + sz; c++) if (custom[r * N + c]) return true;
      return false;
    };
    while (s >= 5 && overlaps(s)) s -= 2;
    if (s < 5) s = 0;
  }
  const p0 = (N - s) / 2;
  const inPlate = (r, c) => s > 0 && r >= p0 && r < p0 + s && c >= p0 && c < p0 + s;

  // --- data / timing / format modules: filled squares whose convex corners are rounded
  // (isolated modules become dots, runs become pills; the module centre is always solid ink)
  const on = (r, c) => dark(r, c) && !custom[r * N + c] && !inPlate(r, c);
  const R = moduleR;
  let d = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!on(r, c)) continue;
      const x = c + o, y = r + o;
      const up = on(r - 1, c), dn = on(r + 1, c), lf = on(r, c - 1), rt = on(r, c + 1);
      const tl = !up && !lf ? R : 0, tr = !up && !rt ? R : 0, br = !dn && !rt ? R : 0, bl = !dn && !lf ? R : 0;
      d += `M${x + tl},${y}H${x + 1 - tr}`;
      d += tr ? `A${tr},${tr} 0 0 1 ${x + 1},${y + tr}` : '';
      d += `V${y + 1 - br}`;
      d += br ? `A${br},${br} 0 0 1 ${x + 1 - br},${y + 1}` : '';
      d += `H${x + bl}`;
      d += bl ? `A${bl},${bl} 0 0 1 ${x},${y + 1 - bl}` : '';
      d += `V${y + tl}`;
      d += tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '';
      d += 'Z';
    }
  }

  // --- finder "eyes": crisp 7×7 ring in ink + soft 3×3 wax centre.
  // Outer corners stay square on purpose: rounded finder rings broke OpenCV's detector at
  // phone-distance sizes in testing (zxing coped, OpenCV didn't). Scannability first.
  const eyes = finders.map(([r, c]) => {
    const x = c + o, y = r + o;
    return `<path fill="${C.ink}" fill-rule="evenodd" d="${roundedRect(x, y, 7, 7, eyeR)}${roundedRect(x + 1, y + 1, 5, 5, eyeR * 0.69)}"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${eyeInnerR}" fill="${eyeColor}"/>`;
  }).join('');

  const aligns = align.map(([r, c]) => {
    const x = c - 2 + o, y = r - 2 + o;
    return `<path fill="${C.ink}" fill-rule="evenodd" d="${roundedRect(x, y, 5, 5, 1.5)}${roundedRect(x + 1, y + 1, 3, 3, 0.9)}"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="1" height="1" rx="0.3" fill="${C.ink}"/>`;
  }).join('');

  // --- crown plate
  let plate = '';
  if (s > 0) {
    const x = p0 + o, y = p0 + o;
    const inset = 0.45;
    const cw = s - 2.0;                      // crown width in modules
    const ch = cw * (84 / 120);
    plate = `<rect x="${x + inset}" y="${y + inset}" width="${s - 2 * inset}" height="${s - 2 * inset}" rx="${s * 0.22}" fill="#FFFFFF" stroke="${C.gold}" stroke-width="0.16"/>` +
      `<svg x="${x + (s - cw) / 2}" y="${y + (s - ch) / 2 + 0.1}" width="${cw}" height="${ch}" viewBox="0 0 120 84" preserveAspectRatio="xMidYMid meet">${crownInner('qrc')}</svg>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${px}" height="${px}" role="img" aria-label="QR: ${url.replace(/[<&"]/g, '')}">
<rect width="${T}" height="${T}" rx="${QUIET * 0.3}" fill="#FFFFFF"/>
<path fill="${C.ink}" d="${d}"/>
${eyes}
${aligns}
${plate}
</svg>
`;
  return { svg, version, size: N, plateRatio: (s * s) / (N * N), plateModules: s };
}

/** Short human-readable form of the URL for printing under the QR. */
export function shortUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
