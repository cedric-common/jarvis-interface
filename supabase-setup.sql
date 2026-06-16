-- JARVIS HQ — Supabase Schema Setup
-- Exécute ce SQL dans l'éditeur SQL de ton dashboard Supabase

-- ============================================================
-- 1. Table profiles
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'cm' check (role in ('admin', 'cm')),
  notion_name text,
  google_refresh_token text,
  google_access_token text,
  google_token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. Row Level Security (RLS)
-- ============================================================
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- 3. Trigger — auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, notion_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'cm',
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 4. Donner les bons rôles aux admins (à exécuter après inscription)
-- ============================================================
-- Remplace les emails par les vrais emails des admins
-- update public.profiles set role = 'admin' where email = 'cedric@common.team';
-- update public.profiles set role = 'admin' where email = 'audrey@common.team';

-- ============================================================
-- 5. Corriger les notion_name pour matcher Notion (optionnel)
-- ============================================================
-- Par défaut notion_name = full_name du signup
-- Si le nom dans Notion est différent, corrige ici :
-- update public.profiles set notion_name = 'Cédric' where email = 'cedric@common.team';
-- update public.profiles set notion_name = 'Audrey' where email = 'audrey@common.team';
-- update public.profiles set notion_name = 'Lisa' where email = 'lisa@common.team';
-- update public.profiles set notion_name = 'Ysalie' where email = 'ysalie@common.team';
-- update public.profiles set notion_name = 'Livia' where email = 'livia@common.team';
-- update public.profiles set notion_name = 'Jean-Marie' where email = 'jean-marie@common.team';
-- update public.profiles set notion_name = 'Esteban' where email = 'esteban@common.team';
