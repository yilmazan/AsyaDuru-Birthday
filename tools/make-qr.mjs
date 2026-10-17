#!/usr/bin/env node
// Usage: node make-qr.mjs <url>
// Writes print/qr.svg, print/qr.png (2048 px), print/qr.json and copies the SVG to assets/img/qr.svg,
// then decodes the PNG (full size and small sizes) to prove it scans to exactly <url>.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildQrSvg, shortUrl } from './lib/qr.mjs';
import { launch } from './lib/browser.mjs';
import { ROOT, PRINT, TOOLS } from './lib/art.mjs';

const url = process.argv[2];
if (!url || !/^https?:\/\/\S+$/.test(url)) {
  console.error('usage: node make-qr.mjs <url>\n  e.g. node make-qr.mjs https://yourname.github.io/asya4/');
  process.exit(2);
}

mkdirSync(PRINT, { recursive: true });
let { svg, version, size, plateRatio, plateModules } = buildQrSvg(url);
const svgPath = path.join(PRINT, 'qr.svg');
const pngPath = path.join(PRINT, 'qr.png');

async function renderPng(markup) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${markup.replace(/width="\d+" height="\d+"/, 'width="2048" height="2048"')}</body></html>`);
  await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 2048, height: 2048 } });
  await browser.close();
}

function verify() {
  const r = spawnSync('python3', [path.join(TOOLS, 'verify-qr.py'), pngPath, url], { encoding: 'utf8' });
  if (r.error) { console.warn('  ! python3 not found, skipped decode check'); return null; }
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  return r.status;
}

writeFileSync(svgPath, svg);
await renderPng(svg);
console.log(`QR for ${url}\n  version ${version}, ${size}×${size} modules, EC level H, crown plate ${plateModules}×${plateModules} = ${(plateRatio * 100).toFixed(1)} % of symbol`);
console.log('Decode check:');
let status = verify();
if (status === 1) {
  console.warn('  ! Stylised QR did not decode everywhere — falling back to the plain version without the crown.');
  ({ svg, version, size, plateRatio } = buildQrSvg(url, { withCrown: false }));
  writeFileSync(svgPath, svg);
  await renderPng(svg);
  status = verify();
  if (status === 1) { console.error('QR still does not decode. Do not print.'); process.exit(1); }
}

copyFileSync(svgPath, path.join(ROOT, 'assets/img/qr.svg'));
writeFileSync(path.join(PRINT, 'qr.json'), JSON.stringify({ url, short: shortUrl(url), version, size, plateRatio, verified: status === 0, generated_at: new Date().toISOString() }, null, 2) + '\n');
console.log(`Wrote\n  ${svgPath}\n  ${pngPath}\n  ${path.join(ROOT, 'assets/img/qr.svg')}\nNext: node make-cards.mjs`);
