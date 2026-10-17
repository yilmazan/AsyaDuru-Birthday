// Asya Duru · 4 — sesli not kaydı (MediaRecorder). Kayıt bitince mikrofon her zaman kapatılır.

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

export function canRecord() {
  return typeof window.MediaRecorder === 'function' && !!navigator.mediaDevices?.getUserMedia;
}

export function pickMime() {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
}

/** İzin reddi mi, yoksa cihaz/destek sorunu mu? */
export function isPermissionError(err) {
  const n = err?.name || '';
  return n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError';
}

/**
 * Kaydı başlatır.
 * @param {{maxSeconds:number, onTick?:(sec:number)=>void}} opts
 * @returns {Promise<{stop:()=>Promise<Rec>, done:Promise<Rec>}>}
 * @typedef {{blob:Blob, mime:string, seconds:number}} Rec
 */
export async function startRecording({ maxSeconds, onTick }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const stopTracks = () => stream.getTracks().forEach((tr) => { try { tr.stop(); } catch { /* yok say */ } });

  const mime = pickMime();
  let rec;
  try {
    rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    try { rec = new MediaRecorder(stream); } catch (e) { stopTracks(); throw e; }
  }

  const chunks = [];
  const t0 = performance.now();
  let elapsed = 0;
  let timer = 0;
  let stopping = false;

  const done = new Promise((resolve, reject) => {
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(timer); stopTracks();
      const type = rec.mimeType || mime || chunks[0]?.type || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (!blob.size) { reject(new Error('empty recording')); return; }
      resolve({ blob, mime: type, seconds: Math.max(1, Math.min(maxSeconds, elapsed || (performance.now() - t0) / 1000)) });
    };
    rec.onerror = (e) => { clearInterval(timer); stopTracks(); reject(e.error || new Error('recorder error')); };
  });

  function stop() {
    if (!stopping) {
      stopping = true;
      elapsed = Math.min(maxSeconds, (performance.now() - t0) / 1000);
      clearInterval(timer);
      try { if (rec.state !== 'inactive') rec.stop(); else stopTracks(); } catch { stopTracks(); }
    }
    return done;
  }

  try { rec.start(250); } catch (e) { stopTracks(); throw e; }  // timeslice: Safari'de parça kaybını önler
  timer = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    onTick?.(Math.min(s, maxSeconds));
    if (s >= maxSeconds) stop();                                // süre sınırında otomatik dur
  }, 100);

  return { stop, done };
}
