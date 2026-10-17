// Asya Duru · 4 — TR/EN metinleri. Yeni metin gerekiyorsa BURAYA iki dilde de ekleyin.
// Kullanım: import { t, getLang, setLang, applyI18n } from './i18n.js';
//   t('guest.submit')                     → metin
//   t('thanks.count', { n: 23 })          → "{n}" yer tutucuları doldurulur
//   <span data-i18n="guest.submit"></span> + applyI18n()  → DOM'u doldurur
//   data-i18n-placeholder / data-i18n-aria / data-i18n-title da desteklenir.

import { CONFIG } from './config.js';

export const STRINGS = {
  tr: {
    'app.title': 'Prenses Asya\'ya bir mektup yaz',
    'app.childName': 'Asya Duru',
    'app.turnsFour': '4 yaşında!',
    'app.partyDate': '31 Ekim 2026',

    'lang.choose': 'Dil seçin',
    'lang.tr': 'Türkçe',
    'lang.en': 'English',
    'lang.switch': 'English',

    'welcome.title': 'Prenses Asya\'ya bir mektup yaz',
    'welcome.subtitle': 'Bugün bizimle olduğun için teşekkürler! Asya büyüyünce okuyacağı bir dilek, bir anı ya da bir fotoğraf bırak.',
    'welcome.start': 'Mektup yaz',
    'welcome.time': 'Yalnızca 1 dakika sürer',

    'guest.nameLabel': 'İmzan',
    'guest.namePlaceholder': 'Örn. Ayşe Teyze, Mert ve ailesi',
    'guest.nameHint': 'İsteğe bağlı. Albümde mektubunun altında görünür.',
    'guest.wishLabel': 'Sevgili Asya,',
    'guest.wishPlaceholder': '4. yaşında sana dilerim ki…',
    'guest.memoryLabel': 'Not: Seninle bir anım',
    'guest.memoryPlaceholder': 'Seninle ilk tanıştığımız gün…',
    'guest.optional': 'isteğe bağlı',
    'guest.photosLabel': 'Mektuba fotoğraf iliştir',
    'guest.photosHint': 'En fazla {max} fotoğraf',
    'guest.takePhoto': 'Fotoğraf çek',
    'guest.choosePhoto': 'Galeriden seç',
    'guest.removePhoto': 'Fotoğrafı kaldır',
    'guest.photoProcessing': 'Fotoğraf hazırlanıyor…',
    'guest.audioLabel': 'Sesli not',
    'guest.audioHint': 'Asya sesini yıllar sonra da duyabilsin. En fazla {sec} saniye.',
    'guest.audioStart': 'Kaydı başlat',
    'guest.audioStop': 'Kaydı bitir',
    'guest.audioPlay': 'Dinle',
    'guest.audioDelete': 'Sil',
    'guest.audioDenied': 'Mikrofon izni verilmedi. Yazılı mesaj bırakabilirsin.',
    'guest.audioUnsupported': 'Bu tarayıcı ses kaydını desteklemiyor.',
    'guest.charsLeft': '{n} karakter kaldı',
    'guest.needSomething': 'Mektubun boş. Bir dilek, anı, fotoğraf ya da sesli not ekle.',
    'guest.submit': 'Mühürle ve gönder',
    'guest.sending': 'Mektup saraya gidiyor…',
    'guest.progress': '{done}/{total} yükleniyor',
    'guest.privacy': 'Mektupları yalnızca Asya\'nın ailesi okur.',
    // misafir sayfası ekleri
    'guest.letterAria': 'Asya\'ya mektubun',
    'guest.photosFull': 'Mektuba en fazla {max} fotoğraf sığar.',
    'guest.photoAlt': 'İliştirilen fotoğraf {n}',
    'guest.audioPause': 'Duraklat',

    'thanks.title': 'Mektubun saraya ulaştı!',
    'thanks.body': 'Asya büyüyünce okuyacağı albüme eklendi. Teşekkür ederiz!',
    'thanks.count': 'Asya\'nın mektup kutusundaki {n}. mektup bu.',
    'thanks.again': 'Bir mektup daha yaz',
    'thanks.signoff': 'Sevgiyle, Asya Duru ve ailesi',

    'err.generic': 'Bir şeyler ters gitti. Lütfen tekrar dene.',
    'err.network': 'Bağlantı sorunu var. İnternetini kontrol edip tekrar dene; yazdıkların silinmedi.',
    'err.rateLimited': 'Çok hızlı gönderildi. Lütfen bir dakika sonra tekrar dene.',
    'err.full': 'Albüm doldu! Lütfen Asya\'nın ailesine haber ver.',
    'err.tooLarge': 'Dosya çok büyük. Daha küçük bir fotoğraf dene.',
    'err.badFile': 'Bu dosya türü desteklenmiyor. Lütfen fotoğraf seç.',
    'err.badLogin': 'E-posta veya şifre hatalı.',
    'err.retry': 'Tekrar dene',

    'album.title': 'Asya Duru\'nun mektup kutusu',
    'album.loginTitle': 'Albüme giriş',
    'album.email': 'E-posta',
    'album.password': 'Şifre',
    'album.login': 'Giriş yap',
    'album.logout': 'Çıkış',
    'album.notOwner': 'Bu hesabın albümü görme yetkisi yok.',
    'album.loading': 'Anılar yükleniyor…',
    'album.empty': 'Henüz mektup yok. QR kodu masalara koy, ilk mektuplar birazdan gelir.',
    'album.count': '{n} mektup, {p} fotoğraf, {a} sesli not',
    'album.filterAll': 'Tümü',
    'album.filterPhotos': 'Fotoğraflı',
    'album.filterAudio': 'Sesli',
    'album.filterFavorites': 'Favoriler',
    'album.filterHidden': 'Gizlenenler',
    'album.langAll': 'Tüm diller',
    'album.anonymous': 'Bir sevgili misafir',
    'album.wish': 'Dilek',
    'album.memory': 'Anı',
    'album.favorite': 'Favori',
    'album.unfavorite': 'Favoriden çıkar',
    'album.hide': 'Gizle',
    'album.unhide': 'Göster',
    'album.delete': 'Sil',
    'album.deleteConfirm': 'Bu mektup kalıcı olarak silinsin mi? Geri alınamaz.',
    'album.cancel': 'Vazgeç',
    'album.slideshow': 'Slayt gösterisi',
    'album.liveWall': 'Canlı duvar',
    'album.exitShow': 'Çık',
    'album.live': 'Canlı',
    'album.offline': 'Bağlantı yok',
    'album.newMemory': 'Yeni bir mektup geldi!',
    'album.export': 'Yedek indir (JSON)',
    'album.scanToAdd': 'Sen de Asya\'ya mektup yaz',
    'album.demoHint': 'Demo modu: herhangi bir e-posta ve şifreyle girebilirsin.',
    'album.demoBadge': 'Demo verisi',
    'album.signingIn': 'Giriş yapılıyor…',
    'album.ps': 'Not:',
    'album.voiceNote': 'Sesli not',
    'album.play': 'Sesli notu dinle',
    'album.pause': 'Durdur',
    'album.openPhoto': 'Fotoğrafı büyüt',
    'album.photoN': 'Fotoğraf {i} / {n}',
    'album.close': 'Kapat',
    'album.prev': 'Önceki',
    'album.next': 'Sonraki',
    'album.pauseShow': 'Duraklat',
    'album.resumeShow': 'Devam et',
    'album.noMatch': 'Bu seçimde mektup yok.',
    'album.showAll': 'Tümünü göster',
    'album.filters': 'Mektupları süz',
    'album.langFilter': 'Mektup dili',
    'album.hiddenBadge': 'Gizli',
    'album.letterFrom': '{name} imzalı mektup',
    'album.exported': 'Yedek indirildi.',
    'album.deleted': 'Mektup silindi.',
    'album.qrAlt': 'Mektup sayfasının QR kodu',
    'album.connecting': 'Bağlanıyor…',
    'album.wallWaiting': 'Asya\'nın mektup kutusu ilk mektubu bekliyor.',
    'album.tools': 'Gösterim ve yedek',

    'book.cover': 'Asya Duru 4 yaşında',
    'book.subtitle': 'Sevenlerinden anılar ve dilekler',
    'book.from': '— {name}',
  },

  en: {
    'app.title': 'Write a letter to Princess Asya',
    'app.childName': 'Asya Duru',
    'app.turnsFour': 'turns 4!',
    'app.partyDate': 'October 31, 2026',

    'lang.choose': 'Choose language',
    'lang.tr': 'Türkçe',
    'lang.en': 'English',
    'lang.switch': 'Türkçe',

    'welcome.title': 'Write a letter to Princess Asya',
    'welcome.subtitle': 'Thank you for celebrating with us! Leave a wish, a memory or a photo for Asya to treasure when she grows up.',
    'welcome.start': 'Write a letter',
    'welcome.time': 'Takes just a minute',

    'guest.nameLabel': 'Your signature',
    'guest.namePlaceholder': 'e.g. Aunt Sarah, the Smith family',
    'guest.nameHint': 'Optional. Shown under your letter in the album.',
    'guest.wishLabel': 'Dear Asya,',
    'guest.wishPlaceholder': 'On your 4th birthday I wish you…',
    'guest.memoryLabel': 'P.S. A memory with you',
    'guest.memoryPlaceholder': 'The day we first met…',
    'guest.optional': 'optional',
    'guest.photosLabel': 'Tuck in a photo',
    'guest.photosHint': 'Up to {max} photos',
    'guest.takePhoto': 'Take a photo',
    'guest.choosePhoto': 'Choose from gallery',
    'guest.removePhoto': 'Remove photo',
    'guest.photoProcessing': 'Preparing photo…',
    'guest.audioLabel': 'Voice note',
    'guest.audioHint': 'So Asya can hear your voice years from now. Up to {sec} seconds.',
    'guest.audioStart': 'Start recording',
    'guest.audioStop': 'Stop recording',
    'guest.audioPlay': 'Play',
    'guest.audioDelete': 'Delete',
    'guest.audioDenied': 'Microphone access was denied. You can still leave a written message.',
    'guest.audioUnsupported': 'This browser does not support voice recording.',
    'guest.charsLeft': '{n} characters left',
    'guest.needSomething': 'Your letter is empty. Add a wish, a memory, a photo or a voice note.',
    'guest.submit': 'Seal and send',
    'guest.sending': 'Your letter is on its way to the castle…',
    'guest.progress': 'Uploading {done}/{total}',
    'guest.privacy': 'Only Asya\'s family reads these letters.',
    // guest page additions
    'guest.letterAria': 'Your letter to Asya',
    'guest.photosFull': 'Only {max} photos fit in the letter.',
    'guest.photoAlt': 'Attached photo {n}',
    'guest.audioPause': 'Pause',

    'thanks.title': 'Your letter reached the castle!',
    'thanks.body': 'It is now in the album Asya will read when she grows up. Thank you!',
    'thanks.count': 'This is letter number {n} in Asya\'s mailbox.',
    'thanks.again': 'Write another letter',
    'thanks.signoff': 'With love, Asya Duru and family',

    'err.generic': 'Something went wrong. Please try again.',
    'err.network': 'Connection problem. Check your internet and try again; your letter is still here.',
    'err.rateLimited': 'Sent too quickly. Please try again in a minute.',
    'err.full': 'The album is full! Please let Asya\'s family know.',
    'err.tooLarge': 'That file is too large. Try a smaller photo.',
    'err.badFile': 'This file type is not supported. Please choose a photo.',
    'err.badLogin': 'Wrong email or password.',
    'err.retry': 'Try again',

    'album.title': 'Asya Duru\'s mailbox',
    'album.loginTitle': 'Album sign-in',
    'album.email': 'Email',
    'album.password': 'Password',
    'album.login': 'Sign in',
    'album.logout': 'Sign out',
    'album.notOwner': 'This account is not allowed to view the album.',
    'album.loading': 'Loading memories…',
    'album.empty': 'No letters yet. Put the QR cards on the tables and the first letters will arrive soon.',
    'album.count': '{n} letters, {p} photos, {a} voice notes',
    'album.filterAll': 'All',
    'album.filterPhotos': 'With photos',
    'album.filterAudio': 'Voice',
    'album.filterFavorites': 'Favorites',
    'album.filterHidden': 'Hidden',
    'album.langAll': 'All languages',
    'album.anonymous': 'A dear guest',
    'album.wish': 'Wish',
    'album.memory': 'Memory',
    'album.favorite': 'Favorite',
    'album.unfavorite': 'Unfavorite',
    'album.hide': 'Hide',
    'album.unhide': 'Show',
    'album.delete': 'Delete',
    'album.deleteConfirm': 'Delete this letter permanently? This cannot be undone.',
    'album.cancel': 'Cancel',
    'album.slideshow': 'Slideshow',
    'album.liveWall': 'Live wall',
    'album.exitShow': 'Exit',
    'album.live': 'Live',
    'album.offline': 'Offline',
    'album.newMemory': 'A new letter arrived!',
    'album.export': 'Download backup (JSON)',
    'album.scanToAdd': 'Write Asya a letter too',
    'album.demoHint': 'Demo mode: any email and password will work.',
    'album.demoBadge': 'Demo data',
    'album.signingIn': 'Signing in…',
    'album.ps': 'P.S.',
    'album.voiceNote': 'Voice note',
    'album.play': 'Play voice note',
    'album.pause': 'Pause',
    'album.openPhoto': 'Enlarge photo',
    'album.photoN': 'Photo {i} of {n}',
    'album.close': 'Close',
    'album.prev': 'Previous',
    'album.next': 'Next',
    'album.pauseShow': 'Pause',
    'album.resumeShow': 'Resume',
    'album.noMatch': 'No letters match this selection.',
    'album.showAll': 'Show all',
    'album.filters': 'Filter letters',
    'album.langFilter': 'Letter language',
    'album.hiddenBadge': 'Hidden',
    'album.letterFrom': 'Letter signed {name}',
    'album.exported': 'Backup downloaded.',
    'album.deleted': 'Letter deleted.',
    'album.qrAlt': 'QR code for the letter page',
    'album.connecting': 'Connecting…',
    'album.wallWaiting': 'Asya\'s mailbox is waiting for its first letter.',
    'album.tools': 'Shows and backup',

    'book.cover': 'Asya Duru turns 4',
    'book.subtitle': 'Memories and wishes from those who love her',
    'book.from': '— {name}',
  },
};

const KEY = CONFIG.STORAGE_PREFIX + 'lang';

/** Kayıtlı dil, yoksa null (dil seçim ekranı gösterilir). */
export function savedLang() {
  try { const v = localStorage.getItem(KEY); return v === 'tr' || v === 'en' ? v : null; } catch { return null; }
}

/** Kayıtlı dil → tarayıcı dili → 'tr'. */
export function getLang() {
  const s = savedLang(); if (s) return s;
  const nav = (navigator.language || 'tr').toLowerCase();
  return nav.startsWith('tr') ? 'tr' : 'en';
}

let current = getLang();

export function setLang(lang) {
  current = lang === 'en' ? 'en' : 'tr';
  try { localStorage.setItem(KEY, current); } catch { /* yok say */ }
  document.documentElement.lang = current;
  applyI18n();
  document.dispatchEvent(new CustomEvent('langchange', { detail: current }));
  return current;
}

export function lang() { return current; }

export function t(key, vars = {}, forLang = current) {
  let s = STRINGS[forLang]?.[key] ?? STRINGS.tr[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** data-i18n* niteliklerini doldurur. Metinler textContent ile yazılır (XSS yok). */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, readVars(el)); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder, readVars(el)); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria, readVars(el))); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle, readVars(el)); });
  if (root === document) document.title = t('app.title');
}

function readVars(el) {
  try { return el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {}; } catch { return {}; }
}
