-- Étape 1 du PRD : entreprises, utilisateurs, rôles et isolation en base.
--
-- Principe (PRD section 7) : chaque table métier porte organisation_id et
-- PostgreSQL applique l'isolation via Row Level Security (RLS). Le code
-- applicatif n'est jamais la seule barrière.
--
-- Les fonctions d'aide vivent dans le schéma « prive », qui n'est pas exposé
-- par l'API Supabase : elles ne peuvent pas être appelées directement.

create schema if not exists prive;
grant usage on schema prive to authenticated;

-- Personne ne doit lire les tables sans être connecté.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.role_membre as enum ('admin', 'lecteur');
create type public.type_source as enum ('caisse', 'en_ligne', 'facture', 'autre');
create type public.base_montant as enum ('HT', 'TTC');

create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (char_length(btrim(nom)) between 1 and 120),
  cree_le     timestamptz not null default now(),
  ia_activee  boolean not null default false
);

-- Profil public minimal d'un compte (le compte lui-même est dans auth.users).
create table public.profils (
  id       uuid primary key references auth.users (id) on delete cascade,
  email    text not null,
  nom      text check (nom is null or char_length(nom) <= 120),
  cree_le  timestamptz not null default now()
);

create table public.adhesions (
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  utilisateur_id   uuid not null references auth.users (id) on delete cascade,
  role             public.role_membre not null,
  cree_le          timestamptz not null default now(),
  primary key (organisation_id, utilisateur_id)
);
create index adhesions_utilisateur_idx on public.adhesions (utilisateur_id);

create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  email            text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role             public.role_membre not null default 'lecteur',
  invite_par       uuid references auth.users (id) on delete set null default auth.uid(),
  cree_le          timestamptz not null default now(),
  acceptee_le      timestamptz,
  unique (organisation_id, email)
);
create index invitations_email_idx on public.invitations (email) where acceptee_le is null;

-- Première table métier : les sources de ventes (PRD H1, H5).
create table public.sources (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  nom              text not null check (char_length(btrim(nom)) between 1 and 80),
  type             public.type_source not null default 'autre',
  base_montant     public.base_montant not null,
  priorite         smallint not null default 100 check (priorite between 1 and 1000),
  cree_le          timestamptz not null default now(),
  unique (organisation_id, nom)
);
create index sources_organisation_idx on public.sources (organisation_id);

create table public.journal_audit (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  utilisateur_id   uuid references auth.users (id) on delete set null,
  action           text not null,
  objet            text not null,
  avant            jsonb,
  apres            jsonb,
  date             timestamptz not null default now()
);
create index journal_audit_organisation_date_idx on public.journal_audit (organisation_id, date desc);

-- ---------------------------------------------------------------------------
-- Fonctions d'aide (security definer : elles lisent adhesions sans RLS,
-- ce qui évite une récursion de politiques)
-- ---------------------------------------------------------------------------

create function prive.est_membre(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.adhesions a
    where a.organisation_id = org and a.utilisateur_id = (select auth.uid())
  );
$$;

create function prive.est_admin(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.adhesions a
    where a.organisation_id = org and a.utilisateur_id = (select auth.uid())
      and a.role = 'admin'
  );
$$;

-- Deux comptes se voient seulement s'ils partagent une entreprise.
create function prive.partage_une_organisation(autre uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.adhesions moi
    join public.adhesions lui on lui.organisation_id = moi.organisation_id
    where moi.utilisateur_id = (select auth.uid()) and lui.utilisateur_id = autre
  );
$$;

revoke all on function prive.est_membre(uuid), prive.est_admin(uuid),
  prive.partage_une_organisation(uuid) from public, anon;
grant execute on function prive.est_membre(uuid), prive.est_admin(uuid),
  prive.partage_une_organisation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------

-- Une ligne ne change jamais d'entreprise.
create function prive.organisation_immuable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.organisation_id is distinct from old.organisation_id then
    raise exception 'organisation_id ne peut pas être modifié' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger adhesions_organisation_immuable before update on public.adhesions
  for each row execute function prive.organisation_immuable();
create trigger invitations_organisation_immuable before update on public.invitations
  for each row execute function prive.organisation_immuable();
create trigger sources_organisation_immuable before update on public.sources
  for each row execute function prive.organisation_immuable();

-- Une entreprise garde toujours au moins un administrateur.
create function prive.garder_un_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     -- Suppression de l'entreprise entière : rien à protéger.
     and exists (select 1 from public.organisations o where o.id = old.organisation_id)
     and not exists (
       select 1 from public.adhesions a
       where a.organisation_id = old.organisation_id and a.role = 'admin'
         and a.utilisateur_id <> old.utilisateur_id
     ) then
    raise exception 'Une entreprise doit garder au moins un administrateur' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger adhesions_garder_un_admin before update or delete on public.adhesions
  for each row execute function prive.garder_un_admin();

-- Création automatique du profil à l'inscription.
create function prive.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id, email) values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_users_creer_profil after insert on auth.users
  for each row execute function prive.creer_profil();

-- Journal d'audit : sans contenu de ventes (PRD section 13).
create function prive.journaliser() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := coalesce(new.organisation_id, old.organisation_id);
begin
  if exists (select 1 from public.organisations o where o.id = org) then
    insert into public.journal_audit (organisation_id, utilisateur_id, action, objet, avant, apres)
    values (
      org, (select auth.uid()), lower(tg_op), tg_table_name,
      case when tg_op <> 'INSERT' then to_jsonb(old) end,
      case when tg_op <> 'DELETE' then to_jsonb(new) end
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger adhesions_journal after insert or update or delete on public.adhesions
  for each row execute function prive.journaliser();
create trigger invitations_journal after insert or update or delete on public.invitations
  for each row execute function prive.journaliser();
create trigger sources_journal after insert or update or delete on public.sources
  for each row execute function prive.journaliser();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.profils       enable row level security;
alter table public.adhesions     enable row level security;
alter table public.invitations   enable row level security;
alter table public.sources       enable row level security;
alter table public.journal_audit enable row level security;

-- organisations : création par la fonction creer_organisation uniquement.
create policy organisations_lecture on public.organisations
  for select to authenticated using ((select prive.est_membre(id)));
create policy organisations_modification on public.organisations
  for update to authenticated
  using ((select prive.est_admin(id))) with check ((select prive.est_admin(id)));

-- profils
create policy profils_lecture on public.profils
  for select to authenticated
  using (id = (select auth.uid()) or (select prive.partage_une_organisation(id)));
create policy profils_modification on public.profils
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- adhesions : les membres voient l'équipe, les admins la gèrent.
create policy adhesions_lecture on public.adhesions
  for select to authenticated using ((select prive.est_membre(organisation_id)));
-- Pas d'ajout direct : on entre dans une entreprise en la créant
-- (creer_organisation) ou en acceptant une invitation (accepter_invitations).
create policy adhesions_modification on public.adhesions
  for update to authenticated
  using ((select prive.est_admin(organisation_id)))
  with check ((select prive.est_admin(organisation_id)));
create policy adhesions_suppression on public.adhesions
  for delete to authenticated
  using ((select prive.est_admin(organisation_id)) or utilisateur_id = (select auth.uid()));

-- invitations : réservées aux admins.
create policy invitations_admin on public.invitations
  for all to authenticated
  using ((select prive.est_admin(organisation_id)))
  with check ((select prive.est_admin(organisation_id)));

-- sources : lecture pour les membres, écriture pour les admins.
create policy sources_lecture on public.sources
  for select to authenticated using ((select prive.est_membre(organisation_id)));
create policy sources_ajout on public.sources
  for insert to authenticated with check ((select prive.est_admin(organisation_id)));
create policy sources_modification on public.sources
  for update to authenticated
  using ((select prive.est_admin(organisation_id)))
  with check ((select prive.est_admin(organisation_id)));
create policy sources_suppression on public.sources
  for delete to authenticated using ((select prive.est_admin(organisation_id)));

-- journal : lecture admin, écriture par déclencheurs uniquement.
create policy journal_lecture on public.journal_audit
  for select to authenticated using ((select prive.est_admin(organisation_id)));

-- Droits de table explicites pour le rôle connecté.
revoke all on public.organisations, public.profils, public.adhesions,
  public.invitations, public.sources, public.journal_audit from authenticated;
-- Le nom et l'option IA se règlent par entreprise ; l'id jamais.
grant select, update (nom, ia_activee) on public.organisations to authenticated;
grant select, update (nom) on public.profils to authenticated;
grant select, delete on public.adhesions to authenticated;
grant update (role) on public.adhesions to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.sources to authenticated;
grant select on public.journal_audit to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions appelables par l'application (RPC)
-- ---------------------------------------------------------------------------

-- Crée une entreprise ; son créateur en devient administrateur.
create function public.creer_organisation(nom text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := (select auth.uid());
  nouvelle uuid;
begin
  if moi is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  insert into public.organisations (nom) values (btrim(creer_organisation.nom))
  returning id into nouvelle;
  insert into public.adhesions (organisation_id, utilisateur_id, role)
  values (nouvelle, moi, 'admin');
  return nouvelle;
end;
$$;

-- Rattache le compte connecté aux entreprises qui l'ont invité.
-- Exige une adresse e-mail confirmée : sinon n'importe qui pourrait
-- s'inscrire avec l'adresse d'un invité et rejoindre l'entreprise.
create function public.accepter_invitations() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := (select auth.uid());
  mon_email text;
  n integer;
begin
  if moi is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  select lower(u.email) into mon_email from auth.users u
  where u.id = moi and u.email_confirmed_at is not null;
  if mon_email is null then
    return 0;
  end if;

  with acceptees as (
    update public.invitations i set acceptee_le = now()
    where i.email = mon_email and i.acceptee_le is null
    returning i.organisation_id, i.role
  )
  insert into public.adhesions (organisation_id, utilisateur_id, role)
  select organisation_id, moi, role from acceptees
  on conflict (organisation_id, utilisateur_id) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.creer_organisation(text), public.accepter_invitations() from public, anon;
grant execute on function public.creer_organisation(text), public.accepter_invitations() to authenticated;
