-- Étape 2 du PRD : dépôt de fichier, empreinte, lecture, prévisualisation.
-- Le fichier d'origine est conservé tel quel dans un espace de stockage privé,
-- cloisonné par entreprise ; la table imports en garde la trace.

create type public.format_import as enum ('csv', 'xlsx');
create type public.statut_import as enum ('televerse', 'parametres_valides');

-- Permet de vérifier qu'une source appartient bien à la même entreprise.
alter table public.sources add constraint sources_id_organisation_unique unique (id, organisation_id);

create table public.imports (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations (id) on delete cascade,
  source_id         uuid not null,
  nom_fichier       text not null check (char_length(nom_fichier) between 1 and 255),
  taille_octets     integer not null check (taille_octets between 1 and 20971520),
  empreinte_sha256  text not null check (empreinte_sha256 ~ '^[0-9a-f]{64}$'),
  format            public.format_import not null,
  chemin_stockage   text not null,
  -- Paramètres de lecture détectés, puis confirmés par l'utilisateur.
  encodage          text check (encodage in ('utf-8', 'windows-1252', 'utf-16le', 'utf-16be')),
  separateur        text check (separateur in (';', ',', E'\t', '|')),
  feuille           text check (char_length(feuille) <= 100),
  lignes_lues       integer check (lignes_lues >= 0),
  statut            public.statut_import not null default 'televerse',
  importe_par       uuid references auth.users (id) on delete set null default auth.uid(),
  importe_le        timestamptz not null default now(),
  -- Une source d'une autre entreprise est refusée par la base elle-même.
  foreign key (source_id, organisation_id) references public.sources (id, organisation_id) on delete restrict,
  -- Le chemin du fichier commence toujours par l'entreprise et l'import.
  check (chemin_stockage = organisation_id::text || '/' || id::text || '/' || empreinte_sha256 || '.' || format::text),
  -- Même fichier déjà importé dans l'entreprise : refusé (PRD H18).
  unique (organisation_id, empreinte_sha256)
);
create index imports_organisation_date_idx on public.imports (organisation_id, importe_le desc);
create index imports_source_idx on public.imports (source_id);

create trigger imports_organisation_immuable before update on public.imports
  for each row execute function prive.organisation_immuable();
create trigger imports_journal after insert or update or delete on public.imports
  for each row execute function prive.journaliser();

alter table public.imports enable row level security;

create policy imports_lecture on public.imports
  for select to authenticated using ((select prive.est_membre(organisation_id)));
create policy imports_ajout on public.imports
  for insert to authenticated
  with check ((select prive.est_admin(organisation_id)) and importe_par = (select auth.uid()));
create policy imports_modification on public.imports
  for update to authenticated
  using ((select prive.est_admin(organisation_id)))
  with check ((select prive.est_admin(organisation_id)));
create policy imports_suppression on public.imports
  for delete to authenticated using ((select prive.est_admin(organisation_id)));

revoke all on public.imports from anon, authenticated;
grant select, insert, delete on public.imports to authenticated;
-- Seuls les paramètres de lecture et le statut évoluent après le dépôt.
grant update (encodage, separateur, feuille, lignes_lues, statut) on public.imports to authenticated;

-- ---------------------------------------------------------------------------
-- Stockage des fichiers : espace « imports », privé.
-- Chemin : <organisation_id>/<import_id>/<empreinte>.<format>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('imports', 'imports', false, 20971520)
on conflict (id) do nothing;

-- Entreprise désignée par le premier dossier du chemin (null si invalide).
create function prive.organisation_du_chemin(chemin text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(chemin, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(chemin, '/', 1)::uuid
  end;
$$;
revoke all on function prive.organisation_du_chemin(text) from public, anon;
grant execute on function prive.organisation_du_chemin(text) to authenticated;

create policy imports_fichiers_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'imports' and (select prive.est_membre(prive.organisation_du_chemin(name))));
create policy imports_fichiers_depot on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (select prive.est_admin(prive.organisation_du_chemin(name))));
create policy imports_fichiers_suppression on storage.objects
  for delete to authenticated
  using (bucket_id = 'imports' and (select prive.est_admin(prive.organisation_du_chemin(name))));
-- Pas de politique de modification : un fichier déposé ne change jamais.
