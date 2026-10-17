-- Imitation minimale de Supabase pour lancer les tests sur un PostgreSQL nu
-- (CI, poste sans Docker). Reproduit uniquement ce dont les migrations
-- dépendent : les rôles, auth.users, auth.uid() et les droits par défaut que
-- Supabase accorde sur le schéma public.
-- Ne jamais appliquer ce fichier sur un vrai projet Supabase.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  email_confirmed_at  timestamptz
);

-- Comme Supabase : l'identité vient des « claims » du jeton de la requête.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), ''
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Droits par défaut de Supabase : tout objet créé dans public est ouvert à
-- anon et authenticated, et seule la RLS protège les données. Les migrations
-- doivent donc tenir sans compter sur des droits restreints par défaut.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
