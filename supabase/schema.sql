-- ============================================================
-- PORTFOLIO SUPABASE SCHEMA
-- Run this entirely in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. TABLES ─────────────────────────────────────────────────

create table if not exists projects (
  id          text        primary key default gen_random_uuid()::text,
  title       text        not null,
  category    text        not null check (category in ('design','photo','video')),
  emoji       text        default '🎨',
  media_url   text,
  media_type  text        check (media_type in ('image','video')),
  description text        default '',
  order_index integer     not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists socials (
  id          text        primary key default gen_random_uuid()::text,
  name        text        not null,
  handle      text        default '',
  url         text        not null,
  icon        text        default '🔗',
  color       text        default '#f0f4ff',
  order_index integer     default 0
);

-- Singleton row: only one row ever exists (id = 1, enforced by check)
create table if not exists content (
  id          integer     primary key default 1 check (id = 1),
  badge       text        default 'Open for collaborations',
  greet       text        default 'Hi! 👋',
  tag         text        default 'And this is my Portfolio',
  description text        default 'A space where creativity meets precision.',
  about       text        default 'I am a passionate graphic designer.',
  school_name text        default 'SMAN 8 Kota Cirebon',
  school_desc text        default 'Currently studying here.',
  updated_at  timestamptz default now()
);

create table if not exists photos (
  id          integer     primary key default 1 check (id = 1),
  profile_url text,
  school_url  text,
  updated_at  timestamptz default now()
);

-- ── 2. SEED DEFAULT DATA ──────────────────────────────────────

insert into content (id) values (1) on conflict (id) do nothing;
insert into photos  (id) values (1) on conflict (id) do nothing;

insert into socials (id, name, handle, url, icon, color, order_index) values
  ('s1', 'Instagram', '@mhmdadityyy',           'https://instagram.com/mhmdadityyy',                  '📸', '#fce4ec', 0),
  ('s2', 'LinkedIn',  'Mohamad Aditya Subagja', 'https://www.linkedin.com/in/mohamad-aditya-subagja', '💼', '#e3f2fd', 1),
  ('s3', 'WhatsApp',  '+62 895-4132-21603',     'https://wa.me/62895413221603',                       '💬', '#e8f5e9', 2),
  ('s4', 'Email',     'mhmdadity27@gmail.com',  'mailto:mhmdadity27@gmail.com',                       '✉️', '#fff3e0', 3)
on conflict (id) do nothing;

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────
-- This is the actual security boundary.
-- The frontend cannot bypass this — all writes are validated server-side.

alter table projects enable row level security;
alter table socials  enable row level security;
alter table content  enable row level security;
alter table photos   enable row level security;

-- Public: anyone can read
create policy "public_read_projects" on projects for select using (true);
create policy "public_read_socials"  on socials  for select using (true);
create policy "public_read_content"  on content  for select using (true);
create policy "public_read_photos"   on photos   for select using (true);

-- Authenticated (admin) only: write
create policy "admin_write_projects" on projects
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_socials" on socials
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_content" on content
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_photos" on photos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── 4. REALTIME ───────────────────────────────────────────────
-- Enable realtime for tables that need live sync

alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table socials;
alter publication supabase_realtime add table content;

-- ── 5. STORAGE BUCKET ─────────────────────────────────────────
-- After running this SQL, also do:
-- Supabase Dashboard → Storage → New Bucket
-- Name: "portfolio", Public: ON

-- Or via SQL (may need service role):
-- insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true);

-- Storage policies (run after creating bucket):
create policy "public_read_files" on storage.objects
  for select using (bucket_id = 'portfolio');

create policy "admin_upload_files" on storage.objects
  for insert with check (
    bucket_id = 'portfolio' and auth.role() = 'authenticated'
  );

create policy "admin_delete_files" on storage.objects
  for delete using (
    bucket_id = 'portfolio' and auth.role() = 'authenticated'
  );

-- ── 6. UPDATED_AT TRIGGER ─────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();

create trigger content_updated_at before update on content
  for each row execute function update_updated_at();

create trigger photos_updated_at before update on photos
  for each row execute function update_updated_at();
