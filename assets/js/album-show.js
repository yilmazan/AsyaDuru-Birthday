// Asya Duru · 4 — slayt gösterisi ve canlı duvar (TV / iPad için tam ekran gösterimler).
// Slayt: mektuplar tek tek, sırayla. Canlı duvar: gece sarayı; yeni mektup gelince zarf uçar, açılır, mektup gösterilir.

import { CONFIG } from './config.js';
import { subscribeNew } from './api.js';
import { t } from './i18n.js';
import {
  $, el, seeded, between, signature, letterText, voicePlayer, stopAllAudio,
  reduceMotion, preloadImages, wait,
} from './album-ui.js';

/**
 * @param {object} ctx
 * @param {() => object[]} ctx.memories          Tüm anılar (eskiden yeniye)
 * @param {(m:object) => boolean} ctx.slideMatches Slayt gösterisinde albümün mevcut süzgecine uyuyor mu
 * @param {(m:object) => boolean} ctx.addMemory   Yeni anıyı albüme ekler; zaten varsa false
 * @param {() => Promise<object[]>} ctx.sync      Sunucudan tazeler; yeni eklenenleri döndürür
 * @param {(el:Element) => void} ctx.onMediaError İmzalı URL süresi dolmuş olabilir
 * @param {() => void} [ctx.onClose]
 */
export function createShow(ctx) {
  const root = $('#show');
  const page = $('.page');
  const stage = $('#stage');
  const banner = $('#wallBanner');
  const envLayer = $('#envLayer');
  const waitBox = $('#wallWait');
  const pos = $('#showPos');
  const statusEl = $('#wallStatus');
  const statusText = $('#wallStatusText');
  const pauseBtn = $('#ctlPause');

  /** Etkin oturum; kapanınca null. Her async akış kendi oturumunu yakalar ve `closed` bayrağına bakar. */
  let S = null;

  // ---------------------------------------------------------------- aç / kapat
  function open(mode) {
    if (S) close();
    const sess = S = {
      mode, curId: null, paused: false, arriving: false, audioPlaying: false, closed: false,
      timer: 0, idleTimer: 0, syncTimer: 0, token: 0, queue: [], unsub: null, fs: false, status: 'connecting',
    };
    root.classList.toggle('is-wall', mode === 'wall');
    root.classList.remove('is-paused', 'idle');
    root.setAttribute('aria-label', t(mode === 'wall' ? 'album.liveWall' : 'album.slideshow'));
    pauseBtn.setAttribute('aria-label', t('album.pauseShow'));
    stage.replaceChildren(); envLayer.replaceChildren();
    setBanner(false);
    page.inert = true;
    document.documentElement.classList.add('is-showing');
    root.hidden = false;
    root.focus({ preventScroll: true });
    goFullscreen(sess);

    if (mode === 'wall') {
      setStatus(navigator.onLine === false ? 'offline' : 'connecting');
      loadQr();
      try {
        sess.unsub = subscribeNew((m) => onInsert(sess, m), (st) => onStatus(sess, st));
      } catch (e) {
        console.warn('[asya4] subscribe', e);
        setStatus('offline');
      }
      sess.syncTimer = setInterval(() => syncNow(sess), 60_000);
    }

    poke();
    const list = order();
    if (list.length) showLetter(list[0]); else showWaiting(true);
  }

  function close() {
    const sess = S;
    if (!sess) return;
    sess.closed = true; S = null;
    clearTimeout(sess.timer); clearTimeout(sess.idleTimer); clearInterval(sess.syncTimer);
    try { sess.unsub?.(); } catch { /* yok say */ }
    stopAllAudio();
    stage.replaceChildren(); envLayer.replaceChildren();
    setBanner(false);
    root.hidden = true;
    root.classList.remove('idle', 'is-paused', 'is-wall', 'is-arriving');
    page.inert = false;
    document.documentElement.classList.remove('is-showing');
    // tam ekrandan çıkış bitince odağı açan düğmeye geri ver (aksi hâlde tarayıcı odağı body'ye atar)
    if (fsElement()) exitFullscreen().then(() => requestAnimationFrame(() => ctx.onClose?.()));
    else ctx.onClose?.();
  }

  // ---------------------------------------------------------------- tam ekran
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  async function goFullscreen(sess) {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req || fsElement()) return;
    try {
      await req.call(root, { navigationUI: 'hide' });
      if (!sess.closed) sess.fs = true;
    } catch { /* izin yok ya da desteklenmiyor: pencere içinde devam */ }
  }
  function exitFullscreen() {
    try {
      const p = (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return Promise.resolve(p).catch(() => {});
    } catch { return Promise.resolve(); }
  }
  const onFsChange = () => { if (S && S.fs && !fsElement()) close(); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ---------------------------------------------------------------- sıra ve gezinme
  function order() {
    if (!S) return [];
    const all = ctx.memories().filter((m) => !m.hidden && (S.mode === 'wall' || ctx.slideMatches(m)));
    // slayt: hikâye sırası (eskiden yeniye); duvar: en yeni önce
    return S.mode === 'wall' ? all.slice().reverse() : all;
  }

  function step(dir) {
    if (!S) return;
    const list = order();
    if (!list.length) { showWaiting(true); return; }
    let i = list.findIndex((m) => m.id === S.curId);
    i = i < 0 ? 0 : (i + dir + list.length) % list.length;
    showLetter(list[i]);
  }

  function dwell(m) {
    // uzun mektuplara biraz daha zaman (en fazla +10 sn)
    const chars = (m.wish || '').length + (m.memory || '').length;
    return (CONFIG.SLIDE_SECONDS + Math.min(10, Math.floor(chars / 110))) * 1000;
  }

  function schedule(sess, m) {
    clearTimeout(sess.timer);
    if (sess.closed || sess.paused || sess.arriving || sess.audioPlaying) return;
    sess.timer = setTimeout(() => { if (S === sess) step(1); }, dwell(m));
  }

  function togglePause() {
    const sess = S;
    if (!sess) return;
    sess.paused = !sess.paused;
    root.classList.toggle('is-paused', sess.paused);
    pauseBtn.setAttribute('aria-label', t(sess.paused ? 'album.resumeShow' : 'album.pauseShow'));
    if (sess.paused) { clearTimeout(sess.timer); return; }
    const m = ctx.memories().find((x) => x.id === sess.curId);
    if (m && !m.hidden) schedule(sess, m); else step(1);
  }

  function updatePos() {
    if (!S || S.mode === 'wall') { pos.textContent = ''; return; }
    const list = order();
    const i = list.findIndex((m) => m.id === S.curId);
    pos.textContent = i >= 0 ? `${i + 1} / ${list.length}` : '';
  }

  function showWaiting(on) {
    waitBox.hidden = !on;
    if (on) { stage.replaceChildren(); pos.textContent = ''; if (S) S.curId = null; }
  }

  // ---------------------------------------------------------------- slayt
  async function showLetter(m) {
    const sess = S;
    if (!sess) return;
    clearTimeout(sess.timer);
    const token = ++sess.token;
    sess.curId = m.id;
    sess.audioPlaying = false;
    stopAllAudio();
    showWaiting(false);
    updatePos();

    const slide = buildSlide(sess, m);
    await preloadImages([...slide.querySelectorAll('img')]);
    if (sess.closed || token !== sess.token) return;

    stage.append(slide);
    await fit(slide);
    if (sess.closed || token !== sess.token) { slide.remove(); return; }

    const olds = [...stage.children].filter((c) => c !== slide);
    void slide.offsetWidth;                 // geçiş için başlangıç stilini sabitle
    root.classList.remove('is-arriving');
    slide.classList.add('is-in');
    olds.forEach((o) => { o.classList.add('is-out'); o.setAttribute('aria-hidden', 'true'); });
    setTimeout(() => olds.forEach((o) => o.remove()), reduceMotion() ? 0 : 1000);
    schedule(sess, m);
  }

  function buildSlide(sess, m) {
    const rnd = seeded(`${m.id}:show`);
    const urls = (m.photoUrls || []).slice(0, CONFIG.MAX_PHOTOS);
    const n = urls.length;
    const hasText = !!((m.wish || '').trim() || (m.memory || '').trim());
    const kind = n && hasText ? 'mixed' : n ? 'photos' : 'text';
    const slide = el('article', { class: `slide slide--${kind} n${n}`, 'data-id': m.id });

    if (n) {
      const ph = el('div', { class: 'slide-photos' });
      urls.forEach((u, i) => {
        const img = el('img', { src: u, alt: '', decoding: 'async', 'data-mid': m.id, 'data-idx': i });
        img.addEventListener('error', () => ctx.onMediaError(img));
        const rot = (i % 2 ? 1 : -1) * between(rnd, 1.5, 4.5);
        ph.append(el('figure', { class: `spola s${i}`, vars: { '--prot': `${rot.toFixed(1)}deg` } }, img));
      });
      slide.append(ph);
    }

    const paper = el('div', { class: 'slide-letter', lang: m.lang, vars: { '--rot': `${between(rnd, -1.1, 1.1).toFixed(2)}deg` } });
    if (hasText) paper.append(el('div', { class: 'slide-text' }, ...letterText(m)));
    else if (!n) paper.append(el('div', { class: 'slide-text' }, el('p', { class: 'salute', text: t('guest.wishLabel', {}, m.lang) })));

    const foot = el('footer', { class: 'slide-foot' });
    if (m.audioUrl) {
      foot.append(voicePlayer(m, {
        onPlay: () => { sess.audioPlaying = true; clearTimeout(sess.timer); },
        onStop: () => { sess.audioPlaying = false; if (sess.curId === m.id) schedule(sess, m); },
        onError: (w) => ctx.onMediaError(w),
      }));
    }
    foot.append(el('p', { class: 'slide-sig', text: signature(m) }));
    paper.append(foot);
    slide.append(paper);
    return slide;
  }

  /** Metni kutuya sığdırır: en büyük yazı boyutunu ikili aramayla bulur; asla taşmaz. */
  async function fit(slide) {
    try { await Promise.race([document.fonts?.ready, wait(1500)]); } catch { /* yok say */ }
    const box = slide.querySelector('.slide-text');
    if (!box) return;
    const H = innerHeight, W = innerWidth;
    const portrait = W < H;
    const isText = slide.classList.contains('slide--text');
    let hi = H * (isText ? 0.066 : 0.054);
    if (portrait) hi = Math.min(hi, W * 0.075);
    let lo = Math.max(12, H * (portrait ? 0.015 : 0.0185));
    const over = () => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
    box.style.fontSize = `${hi}px`;
    if (!over()) { box.classList.remove('is-clipped'); return; }
    let best = lo;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      box.style.fontSize = `${mid}px`;
      if (over()) hi = mid; else { best = mid; lo = mid; }
    }
    box.style.fontSize = `${best}px`;
    box.classList.toggle('is-clipped', over());
  }

  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { const s = S && stage.lastElementChild; if (s) fit(s); }, 150);
  });

  // ---------------------------------------------------------------- canlı duvar
  function setStatus(st) {
    if (S) S.status = st;
    statusEl.dataset.state = st;
    statusText.textContent = t(st === 'live' ? 'album.live' : st === 'offline' ? 'album.offline' : 'album.connecting');
  }
  function onStatus(sess, status) {
    if (sess.closed) return;
    if (status === 'SUBSCRIBED') setStatus('live');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setStatus('offline');
  }
  addEventListener('offline', () => { if (S?.mode === 'wall') setStatus('offline'); });
  addEventListener('online', () => { if (S?.mode === 'wall') { setStatus('connecting'); syncNow(S); } });

  function loadQr() {
    const box = $('#wallQr');
    const img = $('#wallQrImg');
    try {
      const u = new URL('./', location.href);
      $('#wallUrl').textContent = `${u.host}${u.pathname}`.replace(/\/$/, '');
    } catch { /* yok say */ }
    img.alt = t('album.qrAlt');
    img.onerror = () => box.classList.add('no-qr');
    img.onload = () => box.classList.remove('no-qr');
    if (!img.getAttribute('src')) img.src = 'assets/img/qr.svg';
  }

  function setBanner(on) {
    banner.classList.toggle('is-on', on);
    banner.textContent = on ? t('album.newMemory') : '';
  }

  function onInsert(sess, m) {
    if (sess.closed || !m?.id) return;
    const hasContent = (m.wish || '').trim() || (m.memory || '').trim() || m.photo_paths?.length || m.audio_path;
    if (!hasContent) return;                       // sunucu zaten engeller; boş satır gösterme
    if (!ctx.addMemory({ ...m })) return;          // zaten listede
    if (m.hidden) return;
    sess.queue.push(m.id);
    if (!sess.arriving) runArrivals(sess);
  }

  async function syncNow(sess) {
    if (!sess || sess.closed) return;
    let added = [];
    try { added = (await ctx.sync()) || []; } catch { /* yok say */ }
    if (sess.closed) return;
    for (const m of added) if (!m.hidden && !sess.queue.includes(m.id)) sess.queue.push(m.id);
    if (sess.queue.length && !sess.arriving) { runArrivals(sess); return; }
    // ekrandaki mektup başka cihazdan gizlendiyse hemen geç
    const cur = ctx.memories().find((x) => x.id === sess.curId);
    if (sess.curId && (!cur || cur.hidden) && !sess.arriving) step(1);
    if (!sess.curId && order().length && !sess.arriving) step(1);
  }

  async function runArrivals(sess) {
    sess.arriving = true;
    clearTimeout(sess.timer);
    while (!sess.closed && sess.queue.length) {
      const id = sess.queue.shift();
      const m = ctx.memories().find((x) => x.id === id);
      if (!m || m.hidden) continue;
      showWaiting(false);
      if (!reduceMotion()) root.classList.add('is-arriving');
      await flyEnvelope(sess, m);
      if (sess.closed) return;
      setBanner(true);
      await showLetter(m);
      await wait(dwell(m) + 1500);
      if (sess.closed) return;
      setBanner(false);
    }
    if (sess.closed) return;
    sess.arriving = false;
    await wait(400);
    if (!sess.closed && !sess.arriving && S === sess) step(1);
  }

  /** Zarf köşeden süzülerek gelir, mühür kırılır, kapak açılır, mektup yükselir. */
  async function flyEnvelope(sess, m) {
    if (reduceMotion()) return;
    const seal = el('img', { class: 'env-seal', src: 'assets/img/album/seal.svg', alt: '' });
    const flap = el('div', { class: 'env-flap' });
    const letter = el('div', { class: 'env-letter', lang: m.lang },
      el('span', { text: t('guest.wishLabel', {}, m.lang) }), el('i'), el('i'), el('i'));
    const sparks = [[-6, 18], [104, 10], [96, 88], [-4, 80], [48, -14], [20, 104]].map(([x, y]) =>
      el('span', { class: 'env-spark', vars: { left: `${x}%`, top: `${y}%` } }));
    const env = el('div', { class: 'env' }, el('div', { class: 'env-back' }), letter, el('div', { class: 'env-front' }), flap, seal, ...sparks);
    envLayer.replaceChildren(env);
    try {
      await env.animate([
        { transform: 'translate(48vw, -64vh) rotate(-34deg) scale(.26)', opacity: 0 },
        { transform: 'translate(36vw, -50vh) rotate(-26deg) scale(.38)', opacity: 1, offset: 0.16 },
        { transform: 'translate(12vw, -20vh) rotate(-10deg) scale(.78)', offset: 0.66 },
        { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
      ], { duration: 1750, easing: 'cubic-bezier(.3, .7, .3, 1)', fill: 'forwards' }).finished;
      if (sess.closed) return;
      await env.animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-2.2deg)' }, { transform: 'rotate(1deg)' }, { transform: 'rotate(0deg)' },
      ], { duration: 460, easing: 'ease-out' }).finished;
      await seal.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(1.22)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%, -20%) scale(.5) rotate(30deg)', opacity: 0 },
      ], { duration: 460, easing: 'ease-in', fill: 'forwards' }).finished;
      await flap.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }],
        { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished;
      flap.style.zIndex = '1';
      await flap.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(180deg)' }],
        { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished;
      if (sess.closed) return;
      sparks.forEach((s, i) => s.animate([
        { transform: 'scale(.2) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.4 },
        { transform: 'scale(.6) rotate(90deg)', opacity: 0 },
      ], { duration: 900, delay: i * 70, easing: 'ease-out' }));
      await letter.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-58%)' }],
        { duration: 700, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'forwards' }).finished;
      await wait(350);
      env.animate([
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(1.1) translateY(-3vh)' },
      ], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished
        .then(() => { if (envLayer.firstChild === env) envLayer.replaceChildren(); })
        .catch(() => {});
    } catch {
      envLayer.replaceChildren();
    }
  }

  // ---------------------------------------------------------------- girdi
  function poke() {
    const sess = S;
    if (!sess) return;
    root.classList.remove('idle');
    clearTimeout(sess.idleTimer);
    sess.idleTimer = setTimeout(() => { if (!sess.closed) root.classList.add('idle'); }, 2800);
  }
  root.addEventListener('pointermove', poke);
  root.addEventListener('pointerdown', poke);

  document.addEventListener('keydown', (e) => {
    if (!S) return;
    poke();
    const onButton = !!e.target.closest?.('button');
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if ((e.key === ' ' || e.key === 'Spacebar') && !onButton) { e.preventDefault(); togglePause(); }
  });

  // dokunarak gezinme: sol üçte bir geri, sağ üçte bir ileri, orta kontrolleri gösterir
  stage.addEventListener('click', (e) => {
    if (!S || e.target.closest('button, .voice')) return;
    const x = e.clientX / innerWidth;
    if (x < 0.3) step(-1); else if (x > 0.7) step(1); else poke();
  });

  $('#ctlPrev').addEventListener('click', () => step(-1));
  $('#ctlNext').addEventListener('click', () => step(1));
  pauseBtn.addEventListener('click', togglePause);
  $('#ctlExit').addEventListener('click', close);

  document.addEventListener('langchange', () => {
    if (!S) return;
    root.setAttribute('aria-label', t(S.mode === 'wall' ? 'album.liveWall' : 'album.slideshow'));
    pauseBtn.setAttribute('aria-label', t(S.paused ? 'album.resumeShow' : 'album.pauseShow'));
    setStatus(S.status);
  });

  return {
    open,
    close,
    isOpen: () => !!S,
    /** Albümde gizle/sil sonrası gösterimin güncel kalması için. */
    notify() {
      if (!S) return;
      const cur = ctx.memories().find((x) => x.id === S.curId);
      if (S.curId && (!cur || cur.hidden) && !S.arriving) step(1);
      else updatePos();
    },
  };
}
