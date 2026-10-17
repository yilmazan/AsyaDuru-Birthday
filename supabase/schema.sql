-- =====================================================================
--  Asya Duru · 4  —  Doğum günü anı uygulaması · Supabase şeması
--  Güvenlik modeli:
--    * Misafir (anon)   : SADECE ekleyebilir (memories INSERT + dosya INSERT). Okuyamaz.
--    * Albüm sahibi     : album_owners tablosundaki e-posta ile giriş yapan kullanıcı
--                         her şeyi okuyabilir, gizleyebilir, silebilir.
--    * Kayıt açık kalsa bile yabancı biri hesap açıp okuyamaz (sahip listesi kontrolü).
-- =====================================================================

-- ---------- 0. Özel şema (API'ye açık değil) ----------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------- 1. Albüm sahipleri ----------
create table if not exists public.album_owners (
  email text primary key check (email = lower(email))
);
alter table public.album_owners enable row level security;
revoke all on public.album_owners from anon, authenticated;
-- (politika yok: API üzerinden kimse okuyamaz/yazamaz)

-- insert into public.album_owners (email) values ('ornek@mail.com');  -- sahip e-postaları SQL Editor'de eklenir


create or replace function private.is_album_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.album_owners o
    where o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_album_owner() from public;
grant execute on function private.is_album_owner() to anon, authenticated;

-- ---------- 2. Anılar ----------
create table if not exists public.memories (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  lang          text not null check (lang in ('tr', 'en')),
  guest_name    text check (guest_name is null or char_length(guest_name) between 1 and 60),
  wish          text not null default '' check (char_length(wish)   <= 1000),
  memory        text not null default '' check (char_length(memory) <= 1000),
  photo_paths   text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  audio_path    text,
  audio_seconds smallint check (audio_seconds is null or audio_seconds between 1 and 90),
  device_id     uuid,
  hidden        boolean not null default false,
  favorite      boolean not null default false,
  constraint memories_has_content check (
    char_length(btrim(wish)) > 0
    or char_length(btrim(memory)) > 0
    or cardinality(photo_paths) > 0
    or audio_path is not null
  )
);

create index if not exists memories_created_at_idx on public.memories (created_at desc);
create index if not exists memories_device_idx on public.memories (device_id, created_at desc);

alter table public.memories enable row level security;

-- Yetkiler: anon sadece belirli kolonlara INSERT yapabilir
revoke all on public.memories from anon, authenticated;
grant insert (id, lang, guest_name, wish, memory, photo_paths, audio_path, audio_seconds, device_id)
  on public.memories to anon, authenticated;
grant select, update, delete on public.memories to authenticated;

drop policy if exists "guests can add memories" on public.memories;
create policy "guests can add memories"
  on public.memories for insert
  to anon, authenticated
  with check (hidden = false and favorite = false);

drop policy if exists "owners can read memories" on public.memories;
create policy "owners can read memories"
  on public.memories for select
  to authenticated
  using ((select private.is_album_owner()));

drop policy if exists "owners can update memories" on public.memories;
create policy "owners can update memories"
  on public.memories for update
  to authenticated
  using ((select private.is_album_owner()))
  with check ((select private.is_album_owner()));

drop policy if exists "owners can delete memories" on public.memories;
create policy "owners can delete memories"
  on public.memories for delete
  to authenticated
  using ((select private.is_album_owner()));

-- ---------- 3. Koruma tetikleyicisi (spam/limit + dosya yolu doğrulama) ----------
create or replace function private.memories_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_total  int;
  n_minute int;
  n_device int;
  p        text;
  id_txt   text := new.id::text;
begin
  -- sunucu kontrollü alanlar
  new.created_at := now();
  new.hidden     := false;
  new.favorite   := false;
  new.guest_name := nullif(btrim(new.guest_name), '');
  new.wish       := btrim(coalesce(new.wish, ''));
  new.memory     := btrim(coalesce(new.memory, ''));

  -- dosya yolları bu anıya ait olmalı: <id>/photo-N.jpg , <id>/audio.<ext>
  foreach p in array new.photo_paths loop
    if p !~ ('^' || id_txt || '/photo-[1-3]\.(jpg|webp)$') then
      raise exception 'invalid photo path' using errcode = '22023';
    end if;
  end loop;
  if new.audio_path is not null
     and new.audio_path !~ ('^' || id_txt || '/audio\.(webm|mp4|m4a|ogg)$') then
    raise exception 'invalid audio path' using errcode = '22023';
  end if;

  -- limitler
  select count(*) into n_total from public.memories;
  if n_total >= 2000 then
    raise exception 'memory limit reached' using errcode = 'P0001';
  end if;

  select count(*) into n_minute from public.memories
   where created_at > now() - interval '1 minute';
  if n_minute >= 40 then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  if new.device_id is not null then
    select count(*) into n_device from public.memories
     where device_id = new.device_id and created_at > now() - interval '10 minutes';
    if n_device >= 6 then
      raise exception 'rate limited' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.memories_guard() from public;

drop trigger if exists memories_guard on public.memories;
create trigger memories_guard
  before insert on public.memories
  for each row execute function private.memories_guard();

-- ---------- 4. Teşekkür ekranı için sayaç ("Asya'ya bırakılan 23. anı!") ----------
create or replace function public.memory_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.memories where hidden = false;
$$;
revoke all on function public.memory_count() from public;
grant execute on function public.memory_count() to anon, authenticated;

-- ---------- 5. Storage bucket (özel / private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories', 'memories', false, 10485760,  -- 10 MB
  array['image/jpeg', 'image/webp',
        'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/aac', 'audio/mpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guests can upload memory files" on storage.objects;
create policy "guests can upload memory files"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'memories'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo-[1-3]\.(jpg|webp)|audio\.(webm|mp4|m4a|ogg))$'
  );

drop policy if exists "owners can read memory files" on storage.objects;
create policy "owners can read memory files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'memories' and (select private.is_album_owner()));

drop policy if exists "owners can delete memory files" on storage.objects;
create policy "owners can delete memory files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'memories' and (select private.is_album_owner()));

-- ---------- 6. Realtime (canlı anı duvarı) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'memories'
  ) then
    alter publication supabase_realtime add table public.memories;
  end if;
end $$;
