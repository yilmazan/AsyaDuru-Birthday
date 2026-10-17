# Supabase backend

Proje: `pnijbgaeqcslskdugfop` (ap-south-1, Free plan). Şema: `schema.sql` (tekrar çalıştırılabilir, idempotent).

## Güvenlik modeli
| Rol | memories tablosu | storage `memories` bucket |
|---|---|---|
| Misafir (anon, publishable key) | sadece INSERT (belirli kolonlar) | sadece INSERT, yol `<uuid>/photo-[1-3].jpg` veya `<uuid>/audio.(webm/mp4/m4a/ogg)` |
| Giriş yapmış ama `album_owners`'ta olmayan | hiçbir şey | hiçbir şey |
| Albüm sahibi (`album_owners` e-postası) | SELECT / UPDATE / DELETE | SELECT (imzalı URL) / DELETE |

Ek korumalar (`private.memories_guard` tetikleyicisi): `created_at/hidden/favorite` sunucuda zorlanır, dosya yolları anının kendi id'sine bağlı olmalı,
toplam 2000 anı sınırı, dakikada 40, cihaz başına 10 dakikada 6 gönderim. Bucket: özel, 10 MB, sadece JPEG/WebP ve ses MIME türleri.

## Doğrulama (2026-10-17)
Anon rolüyle 20 test geçti: geçerli yükleme+ekleme çalışıyor; upsert, keyfi yol, `photo-9`, `../`, HTML yükleme, okuma, listeleme, indirme,
imzalı URL, `hidden` enjeksiyonu, başka anının dosyasını iliştirme, boş anı, güncelleme ve silme reddediliyor; `memory_count()` çalışıyor.

## Sık işlemler (SQL Editor)
```sql
-- albüme yeni sahip ekle (ör. eş)
insert into public.album_owners (email) values ('ornek@mail.com');

-- parti sonrası yeni mektupları kapat (misafir eklemesini durdur)
revoke insert on public.memories from anon;
-- tekrar aç
grant insert (id, lang, guest_name, wish, memory, photo_paths, audio_path, audio_seconds, device_id) on public.memories to anon;

-- kaç mektup / foto / ses
select count(*), sum(cardinality(photo_paths)), count(audio_path) from public.memories where not hidden;
```

## Hatırlatma
Free plan projesi 7 gün hareketsiz kalırsa uyur. Parti haftası (24–31 Ekim) en az bir kez albümü aç veya Dashboard'a gir.
