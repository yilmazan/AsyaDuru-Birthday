// Asya Duru · 4 — fotoğrafı yüklemeden ÖNCE tarayıcıda hazırla:
// EXIF yönüne göre çöz → uzun kenar ≤ PHOTO_MAX_DIM → beyaz zemin → JPEG.

import { CONFIG } from './config.js';

/** Çözülemeyen dosya. Mesajında 'mime' geçer → errorKey() = 'err.badFile'. */
export class BadImageError extends Error {
  constructor(cause) { super('invalid_mime: image could not be decoded'); this.name = 'BadImageError'; this.cause = cause; }
}

async function decode(file) {
  // 1) createImageBitmap + EXIF yönü
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
    } catch { /* eski Safari seçenek nesnesini desteklemeyebilir → <img> yedeği */ }
  }
  // 2) <img> + decode() (modern tarayıcılar EXIF yönünü varsayılan uygular)
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image');
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new BadImageError(e);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
  });
}

/**
 * @param {File|Blob} file
 * @returns {Promise<Blob>} image/jpeg
 */
export async function processPhoto(file) {
  const { source, width, height, release } = await decode(file);
  try {
    const scale = Math.min(1, CONFIG.PHOTO_MAX_DIM / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';               // şeffaf PNG'ler siyaha dönmesin
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await toBlob(canvas, 'image/jpeg', CONFIG.PHOTO_QUALITY);
    canvas.width = canvas.height = 0;     // iOS: tuval belleğini hemen bırak
    return blob;
  } finally {
    release();
  }
}
