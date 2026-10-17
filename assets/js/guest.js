// Asya Duru · 4 — misafir sayfası: kapak → mektup → mühür + uçuş → teşekkür.
// Kullanıcı içeriği her zaman textContent / value ile yazılır.

import { CONFIG } from './config.js';
import { submitMemory, errorKey } from './api.js';
import { t, lang, setLang, savedLang, applyI18n } from './i18n.js';
import { processPhoto } from './image.js';
import { canRecord, startRecording, isPermissionError } from './recorder.js';

// ------------------------------------------------------------------ kısayollar
const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SVGNS = 'http://www.w3.org/2000/svg';
const DRAFT_KEY = CONFIG.STORAGE_PREFIX + 'draft';
const RING_C = 2 * Math.PI * 29; // ses halkasının çevresi (r=29)

const el = {
  langSwitch: $('#langSwitch'),
  screens: {
    hero: $('#screen-hero'),
    letter: $('#screen-letter'),
    send: $('#screen-send'),
    thanks: $('#screen-thanks'),
  },
  heroTitleTr: $('#heroTitleTr'),
  heroTitleEn: $('#heroTitleEn'),
  startBtn: $('#startBtn'),

  form: $('#letterForm'),
  fields: $('#letterFields'),
  wishLabel: $('#wishLabel'),
  wish: $('#wish'),
  memory: $('#memory'),
  wishCount: $('#wishCount'),
  memoryCount: $('#memoryCount'),
  name: $('#guestName'),

  photosHint: $('#photosHint'),
  polaroids: $('#polaroids'),
  photoCam: $('#photoCam'),
  photoLib: $('#photoLib'),
  photoNote: $('#photoNote'),

  audioPart: $('#audioPart'),
  audioHint: $('#audioHint'),
  voice: $('#voice'),
  voiceBtn: $('#voiceBtn'),
  voiceBtnText: $('#voiceBtnText'),
  voiceIcon: $('#voiceIcon'),
  voiceAction: $('#voiceAction'),
  voiceTime: $('#voiceTime'),
  voiceTimeText: $('#voiceTimeText'),
  voiceDelete: $('#voiceDelete'),
  ringFill: $('#ringFill'),
  audioNote: $('#audioNote'),

  sealBtn: $('#sealBtn'),
  formAlert: $('#formAlert'),
  formAlertText: $('#formAlertText'),
  retryBtn: $('#retryBtn'),

  stage: $('#stage'),
  flight: $('#flight'),
  mini: $('#mini'),
  p1: $('#p1'), p2: $('#p2'), p3: $('#p3'),
  envBack: $('.env-back'),
  envFront: $('.env-front'),
  envFlap: $('#envFlap'),
  envSeal: $('#envSeal'),
  sealRing: $('#sealRing'),
  sendBar: $('#sendBar'),
  sendStatus: $('.send-status'),
  sendProgress: $('#sendProgress'),
  sparkles: $('#sparkles'),

  thanksTitle: $('#thanksTitle'),
  thanksCount: $('#thanksCount'),
  pmTop: $('#pmTop'),
  pmBottom: $('#pmBottom'),
  pmNum: $('#pmNum'),
  pmCrown: $('#pmCrown'),
  againBtn: $('#againBtn'),
};

const state = {
  screen: 'hero',
  photos: [],          // { id, blob, url }
  processing: 0,       // hazırlanmakta olan foto sayısı
  photoQueue: Promise.resolve(),
  photoNote: null,     // { key, vars }
  audio: null,         // { blob, mime, seconds, url }
  rec: null,           // kayıt denetleyicisi
  recStarting: false,
  recSeconds: 0,
  player: null,
  playing: false,
  audioNote: null,     // i18n anahtarı
  alert: null,         // { key, retry }
  sending: false,
  progress: { done: 0, total: 0 },
  count: null,
};

// ================================================================== ekranlar
function show(name, { focus = true } = {}) {
  state.screen = name;
  for (const [key, node] of Object.entries(el.screens)) node.hidden = key !== name;
  document.body.dataset.screen = name;
  el.langSwitch.hidden = name === 'send' || (name === 'hero' && !savedLang());
  window.scrollTo(0, 0);
  if (name === 'letter') requestAnimationFrame(growAll);
  if (!focus) return;
  const target = name === 'letter' ? el.wishLabel : name === 'thanks' ? el.thanksTitle : null;
  target?.focus({ preventScroll: true });
}

// ================================================================== kapak
function renderHero() {
  const choose = !savedLang();
  el.screens.hero.dataset.mode = choose ? 'choose' : 'saved';
  el.heroTitleTr.textContent = t('welcome.title', {}, 'tr');
  el.heroTitleEn.textContent = t('welcome.title', {}, 'en');
  if (state.screen === 'hero') el.langSwitch.hidden = choose;
}

function renderLangSwitch() {
  const other = lang() === 'tr' ? 'en' : 'tr';
  el.langSwitch.setAttribute('lang', other);
}

// ================================================================== mektup alanları
function grow(ta) {
  ta.style.height = 'auto';
  const rows = Number(ta.getAttribute('rows')) || 3;
  const rule = parseFloat(getComputedStyle(ta).lineHeight) || 32;
  // yükseklik daima satır aralığının katı → çizgiler metinle hizalı kalır
  const h = Math.max(rows * rule, Math.ceil(ta.scrollHeight / rule) * rule);
  ta.style.height = `${h}px`;
}
function growAll() { grow(el.wish); grow(el.memory); }

function renderCounter(ta, out) {
  const left = CONFIG.MAX_TEXT - ta.value.length;
  if (left <= 150) {
    out.hidden = false;
    out.textContent = t('guest.charsLeft', { n: Math.max(0, left) });
    out.classList.toggle('is-low', left <= 30);
  } else {
    out.hidden = true;
  }
}
function renderCounters() { renderCounter(el.wish, el.wishCount); renderCounter(el.memory, el.memoryCount); }

// ---- taslak (yalnızca metin)
let draftTimer = 0;
function saveDraftSoon() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 250); }
function saveDraft() {
  clearTimeout(draftTimer);
  try {
    const d = { name: el.name.value, wish: el.wish.value, memory: el.memory.value };
    if (!d.name && !d.wish && !d.memory) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch { /* özel mod vb. → yok say */ }
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d || typeof d !== 'object') return;
    el.name.value = String(d.name || '').slice(0, CONFIG.MAX_NAME);
    el.wish.value = String(d.wish || '').slice(0, CONFIG.MAX_TEXT);
    el.memory.value = String(d.memory || '').slice(0, CONFIG.MAX_TEXT);
  } catch { /* bozuk taslak → yok say */ }
}
function clearDraft() {
  clearTimeout(draftTimer);
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* yok say */ }
}

// ================================================================== uyarılar
function setAlert(key, { retry = false } = {}) { state.alert = key ? { key, retry } : null; renderAlert(); }
function renderAlert() {
  const a = state.alert;
  el.formAlert.hidden = !a;
  if (!a) return;
  el.formAlertText.textContent = t(a.key);
  el.retryBtn.hidden = !a.retry;
}
function clearValidation() { if (state.alert && !state.alert.retry) setAlert(null); }

function setPhotoNote(key, vars = {}) { state.photoNote = key ? { key, vars } : null; renderPhotoNote(); }
function renderPhotoNote() {
  const n = state.photoNote;
  el.photoNote.hidden = !n;
  if (n) el.photoNote.textContent = t(n.key, n.vars);
}

// ================================================================== fotoğraflar
const photoRoom = () => CONFIG.MAX_PHOTOS - state.photos.length - state.processing;
let photoSeq = 0;

function addFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  clearValidation();
  setPhotoNote(null);
  const room = photoRoom();
  if (files.length > room) setPhotoNote('guest.photosFull', { max: CONFIG.MAX_PHOTOS });
  const take = files.slice(0, Math.max(0, room));
  if (!take.length) return;
  state.processing += take.length;
  renderPhotos();
  // sırayla işle: telefon belleği için tek seferde bir tuval
  for (const file of take) {
    state.photoQueue = state.photoQueue.then(async () => {
      try {
        const blob = await processPhoto(file);
        state.photos.push({ id: ++photoSeq, blob, url: URL.createObjectURL(blob) });
      } catch (e) {
        console.warn('[asya4] photo', e);
        setPhotoNote('err.badFile');
      } finally {
        state.processing -= 1;
        renderPhotos();
      }
    });
  }
}

function removePhoto(id) {
  const i = state.photos.findIndex((p) => p.id === id);
  if (i < 0) return;
  const [p] = state.photos.splice(i, 1);
  URL.revokeObjectURL(p.url);
  setPhotoNote(null);
  renderPhotos();
  const next = el.polaroids.querySelectorAll('.photo-remove')[Math.min(i, state.photos.length - 1)];
  (next || el.photoLib).focus({ preventScroll: true });
}

function icon(id) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVGNS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function renderPhotos() {
  const items = [];
  state.photos.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'polaroid';
    const img = new Image();
    img.src = p.url;
    img.alt = t('guest.photoAlt', { n: i + 1 });
    img.decoding = 'async';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-remove';
    btn.setAttribute('aria-label', t('guest.removePhoto'));
    const dot = document.createElement('span');
    dot.append(icon('i-x'));
    btn.append(dot);
    btn.addEventListener('click', () => removePhoto(p.id));
    li.append(img, btn);
    items.push(li);
  });
  for (let k = 0; k < state.processing; k++) {
    const li = document.createElement('li');
    li.className = 'polaroid is-processing';
    const ph = document.createElement('span');
    ph.className = 'ph';
    ph.textContent = t('guest.photoProcessing');
    li.append(ph);
    items.push(li);
  }
  el.polaroids.replaceChildren(...items);
  el.polaroids.hidden = items.length === 0;
  const full = photoRoom() <= 0;
  el.photoCam.disabled = el.photoLib.disabled = full || state.sending;
}

// ================================================================== sesli not
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function voiceMode() {
  if (state.rec || state.recStarting) return 'recording';
  if (state.audio) return state.playing ? 'playing' : 'recorded';
  return 'idle';
}

function setRing(p) { el.ringFill.style.strokeDashoffset = String(RING_C * (1 - Math.max(0, Math.min(1, p)))); }

function renderAudio() {
  const mode = voiceMode();
  el.voice.dataset.state = mode;
  const actionKey = { idle: 'guest.audioStart', recording: 'guest.audioStop', recorded: 'guest.audioPlay', playing: 'guest.audioPause' }[mode];
  const iconId = { idle: 'i-mic', recording: 'i-stop', recorded: 'i-play', playing: 'i-pause' }[mode];
  el.voiceAction.textContent = t(actionKey);
  el.voiceBtnText.textContent = t(actionKey);
  el.voiceIcon.firstElementChild.setAttribute('href', `#${iconId}`);
  el.voiceDelete.hidden = !(mode === 'recorded' || mode === 'playing');
  el.voiceTime.hidden = mode === 'idle';
  if (mode === 'recording') {
    el.voiceTimeText.textContent = `${fmt(state.recSeconds)} / ${fmt(CONFIG.MAX_AUDIO_SECONDS)}`;
    setRing(state.recSeconds / CONFIG.MAX_AUDIO_SECONDS);
  } else if (mode === 'recorded') {
    el.voiceTimeText.textContent = fmt(state.audio.seconds);
    setRing(0);
  } else if (mode === 'playing') {
    const cur = state.player?.currentTime || 0;
    el.voiceTimeText.textContent = `${fmt(cur)} / ${fmt(state.audio.seconds)}`;
    setRing(cur / state.audio.seconds);
  } else {
    setRing(0);
  }
  el.audioNote.hidden = !state.audioNote;
  if (state.audioNote) el.audioNote.textContent = t(state.audioNote);
}

async function onVoiceButton() {
  if (state.sending) return;
  const mode = voiceMode();
  if (mode === 'recording') { if (state.rec) await stopRecording(); return; }
  if (mode === 'recorded') { playAudio(); return; }
  if (mode === 'playing') { pauseAudio(); return; }
  // idle → kaydı başlat
  state.recStarting = true;
  state.audioNote = null;
  state.recSeconds = 0;
  renderAudio();
  try {
    const ctl = await startRecording({
      maxSeconds: CONFIG.MAX_AUDIO_SECONDS,
      onTick: (s) => { state.recSeconds = s; renderAudio(); },
    });
    state.rec = ctl;
    clearValidation();
    ctl.done.then(
      (res) => { setAudio(res); },
      (err) => { console.warn('[asya4] record', err); state.audioNote = 'guest.audioUnsupported'; },
    ).finally(() => { state.rec = null; renderAudio(); });
  } catch (err) {
    state.audioNote = isPermissionError(err) ? 'guest.audioDenied' : 'guest.audioUnsupported';
  } finally {
    state.recStarting = false;
    renderAudio();
  }
}

async function stopRecording() {
  const ctl = state.rec;
  if (!ctl) return;
  try { await ctl.stop(); } catch { /* done handler'ı ele alır */ }
}

function setAudio(rec) {
  discardAudio();
  const url = URL.createObjectURL(rec.blob);
  state.audio = { blob: rec.blob, mime: rec.mime, seconds: rec.seconds, url };
  const player = new Audio();
  player.preload = 'auto';
  player.src = url;
  player.addEventListener('timeupdate', () => { if (state.playing) renderAudio(); });
  player.addEventListener('ended', () => { state.playing = false; renderAudio(); });
  player.addEventListener('pause', () => { if (state.playing) { state.playing = false; renderAudio(); } });
  state.player = player;
}

function playAudio() {
  const p = state.player;
  if (!p) return;
  state.playing = true;
  renderAudio();
  const r = p.play();
  if (r?.catch) r.catch((e) => { console.warn('[asya4] play', e); state.playing = false; renderAudio(); });
}
function pauseAudio() { state.player?.pause(); state.playing = false; renderAudio(); }

function discardAudio() {
  if (state.player) { try { state.player.pause(); } catch { /* yok say */ } state.player.removeAttribute('src'); state.player = null; }
  if (state.audio?.url) URL.revokeObjectURL(state.audio.url);
  state.audio = null;
  state.playing = false;
}

// ================================================================== gönderim
function hasContent() {
  return !!(el.wish.value.trim() || el.memory.value.trim() || state.photos.length || state.audio);
}

async function onSubmit(e) {
  e?.preventDefault();
  if (state.sending) return;           // çift gönderim koruması
  state.sending = true;
  try {
    if (state.rec) await stopRecording();
    pauseAudio();
    await state.photoQueue;            // hazırlanan fotoğrafları bekle
  } catch { /* yok say */ }

  if (!hasContent()) {
    state.sending = false;
    setAlert('guest.needSomething');
    return;
  }
  setAlert(null);
  saveDraft();
  lockForm(true);
  await send();
}

function lockForm(on) {
  el.fields.disabled = on;
  el.sealBtn.disabled = on;
  el.voiceBtn.disabled = on;
  if (!on) renderPhotos();
}

async function send() {
  const payload = {
    lang: lang(),
    guestName: el.name.value.trim().slice(0, CONFIG.MAX_NAME),
    wish: el.wish.value.trim().slice(0, CONFIG.MAX_TEXT),
    memory: el.memory.value.trim().slice(0, CONFIG.MAX_TEXT),
    photos: state.photos.map((p) => p.blob),
    audio: state.audio ? { blob: state.audio.blob, mime: state.audio.mime, seconds: state.audio.seconds } : null,
    onProgress: (done, total) => { state.progress = { done, total }; renderProgress(); },
  };

  state.progress = { done: 0, total: payload.photos.length + (payload.audio ? 1 : 0) + 1 };
  renderProgress();
  buildMiniLetter(payload);
  resetStage();

  const still = reduceMotion();
  el.stage.classList.toggle('is-static', still);
  show('send', { focus: false });

  const uploading = submitMemory(payload).then((r) => ({ ok: true, r }), (err) => ({ ok: false, err }));
  const sealed = still ? Promise.resolve() : sealSequence().catch((e) => console.warn('[asya4] anim', e));

  await sealed;
  let settled = false;
  uploading.then(() => { settled = true; });
  if (!still) { await wait(0); if (!settled) startFloat(); }
  const res = await uploading;

  if (!res.ok) {
    console.warn('[asya4] submit', res.err);
    resetStage();
    state.sending = false;
    lockForm(false);
    show('letter', { focus: false });
    setAlert(errorKey(res.err), { retry: true });
    requestAnimationFrame(() => el.sealBtn.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' }));
    el.retryBtn.focus({ preventScroll: true });
    return;
  }

  if (!still) { try { await flyAway(); } catch (e) { console.warn('[asya4] anim', e); } }
  clearDraft();
  state.count = typeof res.r?.count === 'number' ? res.r.count : null;
  renderThanks();
  state.sending = false;
  show('thanks');
}

function renderProgress() {
  const { done, total } = state.progress;
  el.sendBar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  el.sendProgress.textContent = total ? t('guest.progress', { done, total }) : '';
}

// ------------------------------------------------------------------ sahne: mini mektup
function buildMiniLetter(p) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const crown = new Image();
  crown.src = 'assets/img/crown.svg';
  crown.alt = '';
  crown.className = 'sheet-crown';
  const hello = document.createElement('p');
  hello.className = 'sheet-hello';
  hello.textContent = t('guest.wishLabel');
  const text = document.createElement('p');
  text.className = 'sheet-text';
  text.textContent = (p.wish || p.memory || '').slice(0, 260);
  sheet.append(crown, hello, text);
  if (p.guestName) {
    const sign = document.createElement('p');
    sign.className = 'sheet-sign';
    sign.textContent = p.guestName;
    sheet.append(sign);
  }
  if (state.photos[0]) {
    const fig = document.createElement('div');
    fig.className = 'sheet-photo';
    const img = new Image();
    img.src = state.photos[0].url;
    img.alt = '';
    fig.append(img);
    sheet.append(fig);
  }
  for (const panel of [el.p1, el.p2, el.p3]) panel.querySelector('.mini-face').replaceChildren(sheet.cloneNode(true));
}

// ------------------------------------------------------------------ sahne: animasyon (Web Animations API)
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let floatAnim = null;

function A(node, frames, opts = {}) {
  return node.animate(frames, { duration: 400, easing: EASE, fill: 'forwards', ...opts }).finished;
}

function resetStage() {
  el.stage.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
  el.sendStatus.getAnimations?.().forEach((a) => a.cancel());
  floatAnim = null;
  for (const p of [el.p1, el.p2, el.p3]) p.classList.remove('is-flipped');
  el.envFlap.classList.remove('is-front', 'is-closed-side');
  el.stage.classList.remove('is-static');
  el.sparkles.replaceChildren();
}

async function fold(panel, dir) {
  const shade = panel.querySelector('.mini-shade');
  const half = 90 * dir;
  const persp = 'perspective(720px)';
  A(shade, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-in' });
  await A(panel, [{ transform: `${persp} rotateX(0deg)` }, { transform: `${persp} rotateX(${half}deg)` }], { duration: 230, easing: 'cubic-bezier(.5,0,.85,.45)' });
  panel.classList.add('is-flipped');   // kenardan görünürken arka yüze geç
  A(shade, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
  await A(panel, [{ transform: `${persp} rotateX(${half}deg)` }, { transform: `${persp} rotateX(${half * 2}deg)` }], { duration: 240, easing: 'cubic-bezier(.15,.55,.35,1)' });
}

async function sealSequence() {
  const flapT = (deg) => ({ transform: `perspective(900px) rotateX(${deg}deg)` });
  // 1) mektup belirir
  await A(el.mini, [{ opacity: 0, transform: 'translateY(18px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 420 });
  await wait(180);
  // 2) üçe katlanır: önce alt, sonra üst parça
  await fold(el.p3, 1);
  await fold(el.p1, -1);
  // 3) zarf belirir
  const envIn = [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'translateY(0)' }];
  A(el.envBack, envIn, { duration: 420 });
  A(el.envFront, envIn, { duration: 420 });
  A(el.envFlap, [{ opacity: 0 }, { opacity: 1 }], { duration: 420 });
  await wait(240);
  // 4) mektup cebe kayar (katlı parça mini y=90..180 → sahne y=320..410)
  await A(el.mini, [{ transform: 'translateY(0)' }, { transform: 'translateY(230px)' }], { duration: 580, easing: 'cubic-bezier(.5,0,.2,1)' });
  // 5) kapak kapanır
  await A(el.envFlap, [flapT(180), flapT(90)], { duration: 230, easing: 'cubic-bezier(.5,0,.85,.45)' });
  el.envFlap.classList.add('is-front', 'is-closed-side');
  await A(el.envFlap, [flapT(90), flapT(0)], { duration: 300, easing: 'cubic-bezier(.2,.7,.3,1.15)' });
  await wait(120);
  // 6) mühür basılır
  A(el.envSeal, [
    { opacity: 0, transform: 'scale(2.4) rotate(-26deg)' },
    { opacity: 1, transform: 'scale(.88) rotate(0deg)', offset: 0.68 },
    { opacity: 1, transform: 'scale(1.05) rotate(0deg)', offset: 0.84 },
    { opacity: 1, transform: 'scale(1) rotate(0deg)' },
  ], { duration: 540, easing: 'cubic-bezier(.3,0,.45,1)' });
  await wait(370);
  A(el.sealRing, [{ opacity: 0.95, transform: 'scale(.55)' }, { opacity: 0, transform: 'scale(1.8)' }], { duration: 650, easing: 'ease-out' });
  await A(el.flight, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(3px) scale(.985)', offset: 0.4 }, { transform: 'translateY(0) scale(1)' }], { duration: 260 });
  await wait(180);
}

function startFloat() {
  floatAnim = el.flight.animate(
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }],
    { duration: 1800, iterations: Infinity, easing: 'ease-in-out' },
  );
}

async function flyAway() {
  if (floatAnim) { floatAnim.cancel(); floatAnim = null; }
  const vh = window.innerHeight;
  const flight = el.flight.animate([
    { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
    { transform: 'translate(-6px, 16px) rotate(2deg) scale(1.02)', opacity: 1, offset: 0.14 },
    { transform: `translate(64px, ${-0.42 * vh}px) rotate(-9deg) scale(.62)`, opacity: 1, offset: 0.62 },
    { transform: `translate(118px, ${-1.0 * vh}px) rotate(-16deg) scale(.3)`, opacity: 0 },
  ], { duration: 1400, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
  // durum yazısı zarfla birlikte çekilir; sahnede boş bekleme kalmasın
  A(el.sendStatus, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 250, easing: 'ease-in' });

  // altın ışıltı izi
  let last = 0;
  let running = true;
  flight.finished.finally(() => { running = false; });
  const tick = (now) => {
    if (!running) return;
    if (now - last > 18 && (flight.currentTime || 0) > 160) {
      last = now;
      const r = el.envBack.getBoundingClientRect();
      if (r.width) {
        // zarfın alt-sol kenarından dökülür (uçuş yönünün tersi)
        const n = Math.random() < 0.5 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          spawnSparkle(r.left + r.width * (0.05 + Math.random() * 0.55), r.top + r.height * (0.55 + Math.random() * 0.5));
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await flight.finished;
}

function spawnSparkle(x, y) {
  const s = document.createElement('span');
  const dot = Math.random() < 0.35;
  s.className = dot ? 'sparkle is-dot' : 'sparkle';
  const size = dot ? 3 + Math.random() * 4 : 9 + Math.random() * 13;
  s.style.width = s.style.height = `${size}px`;
  if (!dot) s.append(icon('i-spark'));
  el.sparkles.append(s);
  const dx = (Math.random() - 0.5) * 44;
  const dy = 30 + Math.random() * 60;
  const x0 = x - size / 2;
  const y0 = y - size / 2;
  s.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(0) rotate(0deg)`, opacity: 1 },
    { transform: `translate(${x0 + dx * 0.15}px, ${y0 + dy * 0.15}px) scale(1) rotate(30deg)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${x0 + dx}px, ${y0 + dy}px) scale(.15) rotate(130deg)`, opacity: 0 },
  ], { duration: 900 + Math.random() * 600, easing: 'ease-out', fill: 'forwards' }).finished.then(() => s.remove(), () => s.remove());
}

// ================================================================== teşekkür
function renderThanks() {
  const n = state.count;
  el.thanksCount.hidden = n == null;
  if (n != null) el.thanksCount.textContent = t('thanks.count', { n });
  el.pmNum.textContent = n != null ? String(n) : '';
  el.pmCrown.style.display = n != null ? 'none' : '';
  el.pmTop.textContent = t('app.partyDate');
  el.pmBottom.textContent = t('app.childName');
}

function resetLetter() {
  el.wish.value = '';
  el.memory.value = '';
  el.name.value = '';
  for (const p of state.photos) URL.revokeObjectURL(p.url);
  state.photos = [];
  discardAudio();
  state.audioNote = null;
  state.photoNote = null;
  state.alert = null;
  state.progress = { done: 0, total: 0 };
  resetStage();
  // mini mektuptaki eski küçük resimleri de temizle
  for (const panel of [el.p1, el.p2, el.p3]) panel.querySelector('.mini-face').replaceChildren();
  clearDraft();
  lockForm(false);
  renderPhotos(); renderPhotoNote(); renderAudio(); renderAlert(); renderCounters();
}

// ================================================================== dil değişimi
function renderAll() {
  renderHero();
  renderLangSwitch();
  renderCounters();
  renderPhotos();
  renderPhotoNote();
  renderAudio();
  renderAlert();
  renderProgress();
  renderThanks();
  if (state.screen === 'letter') requestAnimationFrame(growAll);
}

// ================================================================== başlat
function init() {
  document.documentElement.lang = lang();

  // limitler config'den
  el.wish.maxLength = CONFIG.MAX_TEXT;
  el.memory.maxLength = CONFIG.MAX_TEXT;
  el.name.maxLength = CONFIG.MAX_NAME;
  el.photosHint.dataset.i18n = 'guest.photosHint';
  el.photosHint.dataset.i18nVars = JSON.stringify({ max: CONFIG.MAX_PHOTOS });
  el.audioHint.dataset.i18n = 'guest.audioHint';
  el.audioHint.dataset.i18nVars = JSON.stringify({ sec: CONFIG.MAX_AUDIO_SECONDS });
  el.audioPart.hidden = !(CONFIG.ENABLE_AUDIO && canRecord());

  applyI18n();
  loadDraft();
  renderAll();
  show('hero', { focus: false });

  // --- kapak
  document.querySelectorAll('[data-pick-lang]').forEach((b) => b.addEventListener('click', () => {
    setLang(b.dataset.pickLang);
    show('letter');
  }));
  el.startBtn.addEventListener('click', () => show('letter'));
  el.langSwitch.addEventListener('click', () => setLang(lang() === 'tr' ? 'en' : 'tr'));
  document.addEventListener('langchange', renderAll);

  // --- metin alanları
  for (const ta of [el.wish, el.memory]) {
    ta.addEventListener('input', () => { grow(ta); renderCounters(); clearValidation(); saveDraftSoon(); });
  }
  el.name.addEventListener('input', saveDraftSoon);
  el.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.name.blur(); } });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; if (state.screen === 'letter') growAll(); } });
  document.fonts?.ready.then(() => { if (state.screen === 'letter') growAll(); });
  window.addEventListener('pagehide', () => { saveDraft(); state.rec?.stop(); });  // mikrofonu açık bırakma
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveDraft(); });

  // --- fotoğraflar
  for (const input of [el.photoCam, el.photoLib]) {
    input.addEventListener('change', () => { const files = [...(input.files || [])]; input.value = ''; addFiles(files); });
  }

  // --- ses
  el.voiceBtn.addEventListener('click', onVoiceButton);
  el.voiceDelete.addEventListener('click', () => { discardAudio(); renderAudio(); el.voiceBtn.focus({ preventScroll: true }); });

  // --- gönder
  el.form.addEventListener('submit', onSubmit);
  el.retryBtn.addEventListener('click', () => onSubmit());

  // --- yeni mektup
  el.againBtn.addEventListener('click', () => { resetLetter(); show('letter'); });
}

init();
