-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  author text not null default '',
  genre text not null default '',
  language text not null default 'en',
  stage text not null default 'upload',
  manuscript_path text,
  manuscript_name text,
  extraction jsonb not null default '{}'::jsonb,
  brief jsonb, marketing jsonb, concepts jsonb, blurbs jsonb,
  approved_blurb text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seq int not null,
  locator text not null,
  body text not null,
  summary text,
  unique (project_id, seq)
);

create table if not exists public.covers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot int not null check (slot between 0 and 2),
  concept text,
  prompt text,
  note text,
  image_path text not null,
  seed bigint,
  source text not null default 'ai',
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- App-wide daily counters (one shared free-tier AI account => one shared counter)
create table if not exists public.usage_daily (
  day date not null,
  kind text not null,
  count int not null default 0,
  primary key (day, kind)
);

create table if not exists public.user_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pw_changed boolean not null default false
);

-- Named, reusable design snapshots (type, colors, print settings, chosen cover) so the author can come back and change them
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  design jsonb not null,
  print jsonb not null default '{}'::jsonb,
  cover_id uuid references public.covers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.spec_checks (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_url text not null,
  checked_at timestamptz not null default now(),
  status text not null,          -- unchanged | changed_needs_review | first_snapshot | failed | inaccessible
  content_hash text,
  detail text
);

alter table public.projects enable row level security;
alter table public.chunks enable row level security;
alter table public.covers enable row level security;
alter table public.usage_daily enable row level security;
alter table public.user_flags enable row level security;
alter table public.spec_checks enable row level security;
alter table public.designs enable row level security;

do $$ begin
  create policy "own projects" on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own chunks" on public.chunks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own covers" on public.covers for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read usage" on public.usage_daily for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own flags" on public.user_flags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own designs" on public.designs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read spec checks" on public.spec_checks for select using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

create or replace function public.consume_quota(p_kind text, p_limit int) returns int
language plpgsql security definer set search_path = public as $$
declare v int; d date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into usage_daily(day, kind, count) values (d, p_kind, 0) on conflict do nothing;
  update usage_daily set count = count + 1 where day = d and kind = p_kind and count < p_limit returning count into v;
  if v is null then return -1; end if;
  return p_limit - v;
end $$;

create or replace function public.refund_quota(p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update usage_daily set count = greatest(count - 1, 0)
   where day = (now() at time zone 'utc')::date and kind = p_kind;
end $$;

revoke all on function public.consume_quota(text, int) from public;
revoke all on function public.refund_quota(text) from public;
grant execute on function public.consume_quota(text, int) to authenticated;
grant execute on function public.refund_quota(text) to authenticated;

-- Private storage buckets (never public)
insert into storage.buckets (id, name, public, file_size_limit)
values ('manuscripts', 'manuscripts', false, 52428800), ('covers', 'covers', false, 20971520)
on conflict (id) do nothing;

do $$ declare b text; begin
  foreach b in array array['manuscripts','covers'] loop
    begin
      execute format($f$create policy "%1$s select own" on storage.objects for select to authenticated using (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b, b);
      execute format($f$create policy "%1$s insert own" on storage.objects for insert to authenticated with check (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b, b);
      execute format($f$create policy "%1$s update own" on storage.objects for update to authenticated using (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b, b);
      execute format($f$create policy "%1$s delete own" on storage.objects for delete to authenticated using (bucket_id = %2$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b, b);
    exception when duplicate_object then null; end;
  end loop;
end $$;
