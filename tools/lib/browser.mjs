// Shared Chromium helpers (playwright-core + the pre-installed Chromium).
// Override the binary with CHROMIUM_PATH if you run this on another machine.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function chromePath() {
  const p = CANDIDATES.find((c) => existsSync(c));
  if (!p) throw new Error('No Chromium/Chrome found. Set CHROMIUM_PATH=/path/to/chrome');
  return p;
}

export async function launch() {
  return chromium.launch({ executablePath: chromePath(), args: ['--font-render-hinting=none'] });
}

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Pinyon+Script&family=Yeseva+One&display=block';

/** Waits until web fonts (incl. latin-ext subsets for Turkish) are loaded and images decoded. */
export async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    const sample = 'Asya Duru İıŞşĞğÜüÖöÇç 0123456789 ’';
    await Promise.all([
      document.fonts.load(`400 20px "Pinyon Script"`, sample),
      document.fonts.load(`400 20px "Yeseva One"`, sample),
      document.fonts.load(`400 20px "Nunito"`, sample),
      document.fonts.load(`700 20px "Nunito"`, sample),
      document.fonts.load(`italic 400 20px "Nunito"`, sample),
    ]).catch(() => {});
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => {}))));
  });
  const ok = await page.evaluate(() => document.fonts.check('20px "Yeseva One"', 'İş') && document.fonts.check('20px "Pinyon Script"', 'Asya'));
  if (!ok) console.warn('  ! Web fonts did not load (offline?). Output will use fallback fonts.');
}
