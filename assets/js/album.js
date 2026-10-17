// Asya Duru · 4 — albüm sayfası: giriş, "Asya'nın mektup kutusu", süzgeçler, favori/gizle/sil,
// ışık kutusu, JSON yedeği. Gösterimler (slayt, canlı duvar) album-show.js içinde.

import { CONFIG, DEMO } from './config.js';
import {
  currentUser, signIn, signOut, listMemories, memoryCount,
  setHidden, setFavorite, deleteMemory, errorKey,
} from './api.js';
import { t, lang, setLang, applyI18n } from './i18n.js';
import {
  $, $$, el, icon, goldStar, seeded, between, fmtTime, signature, signerName,
  letterText, voicePlayer, reduceMotion, wait,
} from './album-ui.js';
import { createShow } from './album-show.js';

const FILTERS = ['all', 'photos', 'audio', 'favorites', 'hidden'];
const LANGS = ['all', 'tr', 'en'];
const PREFS_KEY = `${CONFIG.STORAGE_PREFIX}albumFilter`;

const state = {
  user: null,
  memories: [],          // eskiden yeniye (api sırası)
  filter: 'all',
  lang: 'all',
  access: 'owner',       // 'owner' | 'notOwner' | 'unknown'
  loadedAt: 0,           // imzalı URL'lerin alındığı an
  lastMediaRefresh: 0,
  refreshing: null,
};
const nodes = new Map(); // id → .letter-slot (yeniden kullanılır; çalan ses kesilmez)

// ================================================================== yardımcılar
const byId = (id) => state.memories.find((m) => m.id === id);

function normalize(m) {
  return {
    ...m,
    guest_name: m.guest_name ?? null,
    wish: m.wish || '',
    memory: m.memory || '',
    photo_paths: Array.isArray(m.photo_paths) ? m.photo_paths : [],
    photoUrls: Array.isArray(m.photoUrls) ? m.photoUrls : [],
    audioUrl: m.audioUrl || null,
    hidden: !!m.hidden,
    favorite: !!m.favorite,
  };
}
const hasPhotos = (m) => m.photo_paths.length > 0 || m.photoUrls.length > 0;
const hasAudio = (m) => !!(m.audio_path || m.audioUrl);

function matches(m, f = state.filter, lg = state.lang) {
  if (lg !== 'all' && m.lang !== lg) return false;
  if (f === 'hidden') return m.hidden;
  if (m.hidden) return false;
  if (f === 'photos') return hasPhotos(m);
  if (f === 'audio') return hasAudio(m);
  if (f === 'favorites') return m.favorite;
  return true;
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (FILTERS.includes(p.filter)) state.filter = p.filter;
    if (LANGS.includes(p.lang)) state.lang = p.lang;
  } catch { /* yok say */ }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ filter: state.filter, lang: state.lang })); } catch { /* yok say */ }
}

let toastT = 0;
function toast(msg) {
  const box = $('#toast');
  box.textContent = msg;
  box.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => box.classList.remove('is-on'), 3200);
}

function setTitle() { document.title = t('album.title'); }

// ================================================================== görünümler
const VIEWS = ['viewLogin', 'viewLoading', 'viewError', 'viewAlbum'];
function showView(id) {
  for (const v of VIEWS) $(`#${v}`).hidden = v !== id;
  $('#logoutBtn').hidden = !state.user || id === 'viewLogin';
}

function showLogin() {
  showView('viewLogin');
  $('#loginError').hidden = true;
  // dokunmatikte klavyeyi kendiliğinden açma
  try { if (matchMedia('(pointer: fine)').matches) (DEMO ? $('#password') : $('#email')).focus(); } catch { /* yok say */ }
}

// ================================================================== giriş
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const pw = $('#password').value;
  const errBox = $('#loginError');
  if (!email || !pw) { (email ? $('#password') : $('#email')).focus(); return; }
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.textContent = t('album.signingIn');
  errBox.hidden = true;
  try {
    state.user = await signIn(email, pw);
    $('#password').value = '';
    await loadAlbum();
  } catch (err) {
    console.warn('[asya4] sign-in', err);
    errBox.textContent = t(errorKey(err));
    errBox.hidden = false;
    $('#password').focus();
  } finally {
    btn.disabled = false;
    btn.textContent = t('album.login');
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  show.close();
  try { await signOut(); } catch (e) { console.warn('[asya4] sign-out', e); }
  state.user = null;
  state.memories = [];
  nodes.clear();
  $('#letters').replaceChildren();
  showLogin();
});

// ================================================================== yükleme ve URL tazeleme
async function loadAlbum() {
  showView('viewLoading');
  try {
    const list = await listMemories();
    state.memories = list.map(normalize);
    state.loadedAt = Date.now();
    state.access = 'owner';
    if (!state.memories.length && !DEMO) {
      // RLS sahibi olmayana boş dizi döner. Herkese açık sayaç > 0 ise kesin "yetkisiz"; okunamazsa belirsiz.
      const c = await memoryCount();
      state.access = c == null ? 'unknown' : c > 0 ? 'notOwner' : 'owner';
    }
    nodes.clear();
    showView('viewAlbum');
    renderAll();
  } catch (err) {
    console.warn('[asya4] list', err);
    $('#loadErrorText').textContent = t(errorKey(err));
    showView('viewError');
  }
}
$('#retryBtn').addEventListener('click', () => (state.user ? loadAlbum() : showLogin()));

/** Sunucudan yeniden okur (imzalı URL'ler yenilenir). Yeni gelenleri döndürür. */
function refreshFromServer() {
  if (!state.user) return Promise.resolve([]);
  if (state.refreshing) return state.refreshing;
  state.refreshing = (async () => {
    try {
      const fresh = (await listMemories()).map(normalize);
      const cur = new Map(state.memories.map((m) => [m.id, m]));
      const added = [];
      state.memories = fresh.map((f) => {
        const old = cur.get(f.id);
        if (old) { Object.assign(old, f); return old; }
        added.push(f);
        return f;
      });
      const ids = new Set(fresh.map((f) => f.id));
      for (const id of [...nodes.keys()]) if (!ids.has(id)) nodes.delete(id);
      state.loadedAt = Date.now();
      applyMediaUrls();
      renderAll();
      return added;
    } catch (err) {
      console.warn('[asya4] refresh', err);
      return [];
    } finally {
      state.refreshing = null;
    }
  })();
  return state.refreshing;
}

/** Yeni imzalı URL'leri ekrandaki <img> ve seslere uygular. */
function applyMediaUrls() {
  for (const img of $$('img[data-mid]')) {
    const m = byId(img.dataset.mid);
    const url = m?.photoUrls[Number(img.dataset.idx)];
    if (url && img.getAttribute('src') !== url) { img.classList.remove('is-broken'); img.src = url; }
  }
  for (const v of $$('.voice[data-mid]')) {
    const m = byId(v.dataset.mid);
    const a = v._audio;
    if (m?.audioUrl && a && a.paused && a.getAttribute('src') !== m.audioUrl) { v.classList.remove('is-error'); a.src = m.audioUrl; }
  }
}

/** Bir medya yüklenemedi: imzalı URL'nin süresi dolmuş olabilir → bir kez tazele. */
function onMediaError(target) {
  if (target?.tagName === 'IMG') target.classList.add('is-broken');
  if (DEMO || !state.user) return;
  const now = Date.now();
  if (now - state.loadedAt < 60_000) return;                 // yeni alınmış URL'ler: gerçek hata, tekrar deneme
  if (now - state.lastMediaRefresh < 5 * 60_000) return;     // aynı bayat parti için yalnızca bir kez
  state.lastMediaRefresh = now;
  refreshFromServer();
}

// süre dolmadan önce kendiliğinden tazele (telefonda zamanlayıcılar uyuyabilir → görünürlükte de kontrol)
const TTL_MS = CONFIG.SIGNED_URL_TTL * 1000;
setInterval(() => { if (!DEMO && state.user && Date.now() - state.loadedAt > TTL_MS * 0.75) refreshFromServer(); }, 5 * 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !DEMO && state.user && state.loadedAt && Date.now() - state.loadedAt > TTL_MS * 0.75) refreshFromServer();
});

// ================================================================== çizim
function renderAll() {
  updateCounts();
  syncFilterUI();
  renderList();
}

function updateCounts() {
  const live = state.memories.filter((m) => !m.hidden);
  const n = live.length;
  const p = live.reduce((s, m) => s + Math.max(m.photo_paths.length, m.photoUrls.length), 0);
  const a = live.filter(hasAudio).length;
  $('#countLine').textContent = t('album.count', { n, p, a });
  for (const chip of $$('.chip')) {
    chip.querySelector('.chip-n').textContent = String(state.memories.filter((m) => matches(m, chip.dataset.filter)).length);
  }
  $('#slideshowBtn').disabled = n === 0;
}

function syncFilterUI() {
  for (const chip of $$('.chip')) chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter));
  $('#langFilter').value = state.lang;
}

function renderList() {
  const total = state.memories.length;
  const items = state.memories.filter((m) => matches(m)).reverse();   // en yeni üstte
  const els = items.map((m) => {
    let n = nodes.get(m.id);
    if (!n) { n = buildLetter(m); nodes.set(m.id, n); } else syncLetter(n, m);
    return n;
  });
  $('#letters').replaceChildren(...els);

  $('#filters').hidden = total === 0;
  $('#exportBtn').hidden = total === 0;
  $('#noMatch').hidden = !(total > 0 && items.length === 0);

  const empty = $('#emptyState');
  empty.hidden = total !== 0;
  if (total === 0) {
    empty.querySelector('.empty-text').hidden = state.access === 'notOwner';
    empty.querySelector('a').hidden = state.access === 'notOwner';
    $('#notOwnerNote').hidden = state.access === 'owner';
  }
}

function buildLetter(m) {
  const rnd = seeded(m.id);
  const urls = m.photoUrls.slice(0, CONFIG.MAX_PHOTOS);
  const nPh = urls.length;

  const art = el('article', {
    class: `letter${nPh ? ' has-photos' : ''}`,
    'aria-label': t('album.letterFrom', { name: signerName(m) }),
    vars: {
      '--rot': `${between(rnd, -1.15, 1.15).toFixed(2)}deg`,
      '--ml': `${Math.round(between(rnd, 0, 18))}px`,
      '--mr': `${Math.round(between(rnd, 0, 18))}px`,
    },
  });

  if (nPh) {
    const align = ['start', 'center', 'end'][Math.floor(rnd() * 3)];
    const row = el('div', { class: `letter-photos n${nPh} align-${align}` });
    urls.forEach((url, i) => {
      const sign = i % 2 ? 1 : -1;
      const img = el('img', {
        class: 'pola-img', src: url, alt: '', loading: 'lazy', decoding: 'async',
        width: 400, height: 400, 'data-mid': m.id, 'data-idx': i,
      });
      img.addEventListener('error', () => onMediaError(img));
      row.append(el('button', {
        type: 'button', class: 'pola', 'data-photo': i,
        'aria-label': `${t('album.openPhoto')}: ${t('album.photoN', { i: i + 1, n: nPh })}`,
        vars: {
          '--prot': `${(sign * between(rnd, 1.6, 5.2)).toFixed(1)}deg`,
          '--dy': `${Math.round(between(rnd, -4, 12))}px`,
        },
      },
      el('span', { class: `tape tape-${Math.floor(rnd() * 3)}`, 'aria-hidden': 'true', vars: { '--trot': `${between(rnd, -7, 7).toFixed(1)}deg` } }),
      img));
    });
    art.append(row);
  }

  const body = el('div', { class: 'letter-body', lang: m.lang }, ...letterText(m));
  if (m.audioUrl) body.append(voicePlayer(m, { onError: (w) => onMediaError(w) }));
  body.append(el('footer', { class: 'letter-foot' },
    el('time', { datetime: m.created_at, lang: lang(), text: fmtTime(m.created_at) }),
    el('p', { class: 'sig', text: signature(m) })));
  art.append(body);

  art.append(el('div', { class: 'letter-actions' },
    el('button', { type: 'button', class: 'act act-fav', 'data-act': 'fav' }),
    el('button', { type: 'button', class: 'act act-hide', 'data-act': 'hide' }),
    el('button', { type: 'button', class: 'act act-del', 'data-act': 'del' }, icon('trash'), el('span', { text: t('album.delete') }))));

  const slot = el('div', { class: `letter-slot${nPh ? ' has-photos' : ''}`, 'data-id': m.id }, art);
  syncLetter(slot, m);
  return slot;
}

/** Durum (favori/gizli) değişince mektubu yeniden kurmadan günceller. */
function syncLetter(slot, m) {
  const art = slot.firstElementChild;
  art.classList.toggle('is-fav', m.favorite);
  art.classList.toggle('is-hidden', m.hidden);

  const body = art.querySelector('.letter-body');
  const star = body.querySelector(':scope > .fav-mark');
  if (m.favorite && !star) body.prepend(goldStar());
  else if (!m.favorite && star) star.remove();

  const acts = art.querySelector('.letter-actions');
  const tag = acts.querySelector('.hidden-tag');
  if (m.hidden && !tag) acts.prepend(el('span', { class: 'hidden-tag', text: t('album.hiddenBadge') }));
  else if (!m.hidden && tag) tag.remove();

  const fav = art.querySelector('.act-fav');
  fav.classList.toggle('is-on', m.favorite);
  fav.replaceChildren(icon(m.favorite ? 'star' : 'starLine'), el('span', { text: t(m.favorite ? 'album.unfavorite' : 'album.favorite') }));
  const hide = art.querySelector('.act-hide');
  hide.replaceChildren(icon(m.hidden ? 'eye' : 'eyeOff'), el('span', { text: t(m.hidden ? 'album.unhide' : 'album.hide') }));
}

/** Mektup artık süzgece uymuyorsa kısa bir çıkışla kaldırır; odak bir sonraki mektuba geçer. */
async function removeFromView(id, focusSel = '.act-hide') {
  const slot = nodes.get(id);
  const list = $$('.letter-slot', $('#letters'));
  const idx = slot ? list.indexOf(slot) : -1;
  const hadFocus = slot?.contains(document.activeElement);
  if (slot && idx >= 0 && !reduceMotion()) { slot.classList.add('is-leaving'); await wait(230); }
  slot?.classList.remove('is-leaving');
  renderAll();
  if (hadFocus) {
    const now = $$('.letter-slot', $('#letters'));
    const next = now[Math.min(idx, now.length - 1)];
    const target = next?.querySelector(focusSel) || next?.querySelector('button');
    if (target) target.focus(); else $('#letters').focus?.();
  }
}

function afterChange(m, focusSel) {
  const slot = nodes.get(m.id);
  if (slot) syncLetter(slot, m);
  updateCounts();
  show.notify();
  if (slot && slot.isConnected && !matches(m)) return removeFromView(m.id, focusSel);
  if (!slot?.isConnected && matches(m)) renderAll();
  return null;
}

// ================================================================== eylemler
$('#letters').addEventListener('click', (e) => {
  const photo = e.target.closest('.pola');
  const act = e.target.closest('[data-act]');
  const id = e.target.closest('.letter-slot')?.dataset.id;
  const m = id && byId(id);
  if (!m) return;
  if (photo) { openLightbox(m.id, Number(photo.dataset.photo) || 0, photo); return; }
  if (!act) return;
  if (act.dataset.act === 'fav') toggleFavorite(m);
  else if (act.dataset.act === 'hide') toggleHidden(m);
  else if (act.dataset.act === 'del') askDelete(m, act);
});

async function toggleFavorite(m) {
  const prev = m.favorite;
  m.favorite = !prev;
  afterChange(m, '.act-fav');
  try { await setFavorite(m.id, m.favorite); } catch (err) {
    console.warn('[asya4] favorite', err);
    m.favorite = prev; afterChange(m, '.act-fav'); renderAll();
    toast(t(errorKey(err)));
  }
}

async function toggleHidden(m) {
  const prev = m.hidden;
  m.hidden = !prev;
  afterChange(m, '.act-hide');
  try { await setHidden(m.id, m.hidden); } catch (err) {
    console.warn('[asya4] hide', err);
    m.hidden = prev; afterChange(m, '.act-hide'); renderAll();
    toast(t(errorKey(err)));
  }
}

function confirmDelete() {
  const dlg = $('#confirmDlg');
  return new Promise((resolve) => {
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

async function askDelete(m, opener) {
  const ok = await confirmDelete();
  if (!ok) { opener?.focus(); return; }
  const idx = state.memories.indexOf(m);
  if (idx < 0) return;
  const req = deleteMemory(m.id);          // ağ isteği hemen başlar, arayüz iyimser
  state.memories.splice(idx, 1);
  show.notify();
  await removeFromView(m.id, '.act-del');
  nodes.delete(m.id);
  try {
    await req;
    toast(t('album.deleted'));
  } catch (err) {
    console.warn('[asya4] delete', err);
    state.memories.splice(Math.min(idx, state.memories.length), 0, m);
    renderAll();
    toast(t(errorKey(err)));
  }
}

// süzgeçler
$('#filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.filter = chip.dataset.filter;
  savePrefs();
  renderAll();
});
$('#langFilter').addEventListener('change', (e) => {
  state.lang = LANGS.includes(e.target.value) ? e.target.value : 'all';
  savePrefs();
  renderAll();
});
$('#showAllBtn').addEventListener('click', () => {
  state.filter = 'all'; state.lang = 'all';
  savePrefs(); renderAll();
  $('.chip[data-filter="all"]').focus();
});

// JSON yedeği (geçici imzalı URL'ler çıkarılır)
$('#exportBtn').addEventListener('click', () => {
  const memories = state.memories.map(({ photoUrls, audioUrl, ...rest }) => rest);
  const payload = {
    app: 'asya4',
    child: CONFIG.CHILD_FULL_NAME,
    party_date: CONFIG.PARTY_DATE,
    exported_at: new Date().toISOString(),
    count: memories.length,
    memories,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `asya-duru-mektuplar-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t('album.exported'));
});

// ================================================================== ışık kutusu
const lb = { id: null, idx: 0, opener: null, x: null, y: null, swiped: false };
const lbDlg = $('#lightbox');
const lbImg = $('#lbImg');

function openLightbox(id, idx, opener) {
  lb.id = id; lb.idx = idx; lb.opener = opener || document.activeElement;
  renderLightbox(0);
  lbDlg.showModal();
  $('#lbClose').focus();
}

function renderLightbox(dir) {
  const m = byId(lb.id);
  const urls = m?.photoUrls || [];
  if (!urls.length) { lbDlg.close(); return; }
  const n = urls.length;
  lb.idx = (lb.idx + n) % n;
  lbImg.src = urls[lb.idx];
  lbImg.dataset.mid = m.id;
  lbImg.dataset.idx = String(lb.idx);
  lbImg.alt = t('album.photoN', { i: lb.idx + 1, n });
  $('#lbCount').textContent = n > 1 ? t('album.photoN', { i: lb.idx + 1, n }) : '';
  const cap = $('#lbCaption');
  cap.textContent = signature(m);
  cap.lang = m.lang;
  $('#lbPrev').hidden = n < 2;
  $('#lbNext').hidden = n < 2;
  if (dir && !reduceMotion()) {
    lbImg.animate([{ opacity: 0.2, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' });
  }
}
const lbStep = (d) => { lb.idx += d; renderLightbox(d); };

lbImg.addEventListener('error', () => onMediaError(lbImg));
$('#lbClose').addEventListener('click', () => lbDlg.close());
$('#lbPrev').addEventListener('click', () => lbStep(-1));
$('#lbNext').addEventListener('click', () => lbStep(1));
lbDlg.addEventListener('close', () => {
  lbImg.removeAttribute('src');
  if (lb.opener?.isConnected) lb.opener.focus();
});
lbDlg.addEventListener('keydown', (e) => {
  const n = byId(lb.id)?.photoUrls.length || 0;
  if (e.key === 'ArrowRight' && n > 1) { e.preventDefault(); lbStep(1); }
  else if (e.key === 'ArrowLeft' && n > 1) { e.preventDefault(); lbStep(-1); }
  else if (e.key === 'Tab') {
    // odak tuzağı: yalnızca görünür düğmeler arasında dolaş
    const f = [$('#lbPrev'), $('#lbNext'), $('#lbClose')].filter((b) => !b.hidden);
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
});
// kaydırma (swipe) ve boşluğa dokununca kapanma
const fig = $('#lbFigure');
fig.addEventListener('pointerdown', (e) => { lb.x = e.clientX; lb.y = e.clientY; lb.swiped = false; });
fig.addEventListener('pointerup', (e) => {
  if (lb.x == null) return;
  const dx = e.clientX - lb.x, dy = e.clientY - lb.y;
  lb.x = null;
  const n = byId(lb.id)?.photoUrls.length || 0;
  if (n > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) { lb.swiped = true; lbStep(dx < 0 ? 1 : -1); }
});
fig.addEventListener('pointercancel', () => { lb.x = null; });
fig.addEventListener('click', (e) => { if (!lb.swiped && e.target === fig) lbDlg.close(); lb.swiped = false; });

// ================================================================== gösterimler
const show = createShow({
  memories: () => state.memories,
  slideMatches: (m) => matches(m, state.filter === 'hidden' ? 'all' : state.filter, state.lang),
  addMemory(m) {
    if (byId(m.id)) return false;
    state.memories.push(normalize(m));
    state.memories.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    renderAll();
    return true;
  },
  sync: () => refreshFromServer(),
  onMediaError,
  onClose: () => { lastShowOpener?.focus?.(); },
});
let lastShowOpener = null;
$('#slideshowBtn').addEventListener('click', (e) => { lastShowOpener = e.currentTarget; show.open('slides'); });
$('#liveWallBtn').addEventListener('click', (e) => { lastShowOpener = e.currentTarget; show.open('wall'); });

// telefonda gösterim düğmeleri mektupların altına iner (üstte süzgeçlere yer kalsın)
const narrow = matchMedia('(max-width: 699px)');
function placeTools() {
  const tools = $('#tools');
  if (narrow.matches) $('#albumFoot').prepend(tools); else $('#toolbar').append(tools);
}
narrow.addEventListener?.('change', placeTools);

// ================================================================== dil
function relabelLangButton() {
  const other = lang() === 'tr' ? 'en' : 'tr';
  $('#langBtn').setAttribute('lang', other);
}
$('#langBtn').addEventListener('click', () => setLang(lang() === 'tr' ? 'en' : 'tr'));
document.addEventListener('langchange', () => {
  setTitle();
  relabelLangButton();
  if (!$('#viewAlbum').hidden) {
    nodes.clear();               // arayüz metinleri (eylemler, tarih) yeni dilde kurulsun
    renderAll();
  }
  if (lbDlg.open) renderLightbox(0);
});

// ================================================================== başlangıç
async function boot() {
  document.documentElement.lang = lang();
  applyI18n();
  setTitle();
  relabelLangButton();
  loadPrefs();
  placeTools();
  if (DEMO) {
    $('#demoBadge').hidden = false;
    $('#demoHint').hidden = false;
    $('#email').value = 'demo@asya4.local';
  }
  showView('viewLoading');
  try { state.user = await currentUser(); } catch (err) { console.warn('[asya4] session', err); state.user = null; }
  if (state.user) await loadAlbum(); else showLogin();
}

boot();
