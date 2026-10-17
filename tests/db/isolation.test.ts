// Test d'isolation entre entreprises — critère de validation de l'étape 1
// du PRD (section 15) et test exécuté à chaque livraison (section 9) :
// un utilisateur de l'entreprise A ne peut lire, modifier ni deviner
// l'existence d'aucun objet de l'entreprise B.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerCompte, enAdmin, ecrire, erreur, fermer, lire } from "./aide";
import { creerJeuFictif, type JeuFictif } from "./jeu-fictif";

let j: JeuFictif;

beforeAll(async () => {
  j = await creerJeuFictif();
});
afterAll(fermer);

describe("Structure : aucune table oubliée", () => {
  it("chaque table du schéma public a la RLS activée", async () => {
    const sansRls = await enAdmin<{ table: string }>(`
      select c.relname as table from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(sansRls).toEqual([]);
  });

  it("chaque table métier porte organisation_id", async () => {
    // Exceptions justifiées : l'entreprise elle-même et le profil d'un compte.
    const exceptions = ["organisations", "profils"];
    const sansOrg = await enAdmin<{ table: string }>(`
      select c.relname as table from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not exists (
          select 1 from pg_attribute a
          where a.attrelid = c.oid and a.attname = 'organisation_id' and not a.attisdropped)`);
    expect(sansOrg.map((t) => t.table).filter((t) => !exceptions.includes(t))).toEqual([]);
  });

  it("le schéma prive n'est pas exposé par l'API", async () => {
    // Supabase n'expose que public (et graphql_public) : on vérifie que nos
    // fonctions d'aide n'y sont pas.
    const dansPublic = await enAdmin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('est_membre', 'est_admin', 'partage_une_organisation')`);
    expect(dansPublic).toEqual([]);
  });
});

describe("Lecture : B ne voit rien de A", () => {
  const tables = ["organisations", "adhesions", "invitations", "sources", "journal_audit"] as const;

  for (const table of tables) {
    it(`${table} : aucune ligne de A visible par B`, async () => {
      const colonne = table === "organisations" ? "id" : "organisation_id";
      const lignes = await lire(j.bea, `select * from public.${table} where ${colonne} = $1`, [j.orgA]);
      expect(lignes).toEqual([]);
    });
  }

  it("B ne voit que sa propre entreprise", async () => {
    const orgs = await lire<{ id: string }>(j.bea, "select id from public.organisations");
    expect(orgs.map((o) => o.id)).toEqual([j.orgB]);
  });

  it("B ne voit le profil d'aucun membre de A", async () => {
    const profils = await lire<{ id: string }>(j.bea, "select id from public.profils");
    expect(profils.map((p) => p.id)).toEqual([j.bea]);
  });

  it("A voit ses propres données (le test n'est pas vide par construction)", async () => {
    expect(await lire(j.alice, "select * from public.sources where organisation_id = $1", [j.orgA])).toHaveLength(1);
    expect(await lire(j.arthur, "select * from public.organisations")).toHaveLength(1);
    const profils = await lire<{ id: string }>(j.arthur, "select id from public.profils order by email");
    expect(profils.map((p) => p.id).sort()).toEqual([j.alice, j.arthur].sort());
  });
});

describe("Écriture : B ne peut rien modifier chez A", () => {
  it("modifier la source de A ne touche aucune ligne", async () => {
    expect(await ecrire(j.bea, "update public.sources set nom = 'piratée' where id = $1", [j.sourceA])).toBe(0);
  });

  it("supprimer la source de A ne touche aucune ligne", async () => {
    expect(await ecrire(j.bea, "delete from public.sources where id = $1", [j.sourceA])).toBe(0);
  });

  it("renommer l'entreprise A ne touche aucune ligne", async () => {
    expect(await ecrire(j.bea, "update public.organisations set nom = 'x' where id = $1", [j.orgA])).toBe(0);
  });

  it("retirer Alice de A ne touche aucune ligne", async () => {
    expect(await ecrire(j.bea, "delete from public.adhesions where utilisateur_id = $1", [j.alice])).toBe(0);
  });

  it("s'ajouter soi-même comme membre de A est refusé", async () => {
    const msg = await erreur(j.bea,
      "insert into public.adhesions (organisation_id, utilisateur_id, role) values ($1, $2, 'admin')", [j.orgA, j.bea]);
    expect(msg).toMatch(/permission denied|row-level security/);
  });

  it("s'inviter soi-même dans A est refusé", async () => {
    const msg = await erreur(j.bea,
      "insert into public.invitations (organisation_id, email, role) values ($1, 'bea.admin@entreprise-b.fictif.test', 'admin')", [j.orgA]);
    expect(msg).toMatch(/row-level security/);
  });

  it("déplacer sa source vers l'entreprise A est refusé", async () => {
    const msg = await erreur(j.bea, "update public.sources set organisation_id = $1 where id = $2", [j.orgA, j.sourceB]);
    expect(msg).not.toBeNull();
    const [source] = await enAdmin<{ organisation_id: string }>("select organisation_id from public.sources where id = $1", [j.sourceB]);
    expect(source.organisation_id).toBe(j.orgB);
  });

  it("rien n'a bougé chez A après toutes ces tentatives", async () => {
    const [source] = await enAdmin<{ nom: string }>("select nom from public.sources where id = $1", [j.sourceA]);
    expect(source.nom).toBe("Caisse");
    const [org] = await enAdmin<{ nom: string }>("select nom from public.organisations where id = $1", [j.orgA]);
    expect(org.nom).toBe("Base de loisirs Fictive A");
  });
});

describe("Existence : B ne peut pas deviner qu'un objet de A existe", () => {
  it("insérer dans A donne la même erreur que dans une entreprise inexistante", async () => {
    const sql = "insert into public.sources (organisation_id, nom, base_montant) values ($1, 'Test', 'HT')";
    const versA = await erreur(j.bea, sql, [j.orgA]);
    const versRien = await erreur(j.bea, sql, ["00000000-0000-4000-8000-000000000000"]);
    expect(versA).not.toBeNull();
    expect(versA).toBe(versRien);
  });

  it("les identifiants ne sont pas prédictibles (UUID aléatoires)", () => {
    for (const id of [j.orgA, j.orgB, j.sourceA, j.sourceB]) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

describe("Visiteur non connecté", () => {
  for (const table of ["organisations", "profils", "adhesions", "invitations", "sources", "journal_audit"]) {
    it(`${table} : accès refusé`, async () => {
      expect(await erreur(null, `select * from public.${table}`)).toMatch(/permission denied/);
    });
  }

  it("ne peut pas créer d'entreprise", async () => {
    expect(await erreur(null, "select public.creer_organisation('x')")).toMatch(/permission denied/);
  });
});

describe("Rôles à l'intérieur d'une entreprise", () => {
  it("le lecteur lit les sources mais ne peut pas en créer", async () => {
    expect(await lire(j.arthur, "select * from public.sources")).toHaveLength(1);
    const msg = await erreur(j.arthur,
      "insert into public.sources (organisation_id, nom, base_montant) values ($1, 'Test', 'HT')", [j.orgA]);
    expect(msg).toMatch(/row-level security/);
  });

  it("le lecteur ne peut ni modifier ni supprimer une source", async () => {
    expect(await ecrire(j.arthur, "update public.sources set nom = 'x' where id = $1", [j.sourceA])).toBe(0);
    expect(await ecrire(j.arthur, "delete from public.sources where id = $1", [j.sourceA])).toBe(0);
  });

  it("le lecteur ne peut pas se promouvoir administrateur", async () => {
    expect(await ecrire(j.arthur,
      "update public.adhesions set role = 'admin' where utilisateur_id = $1", [j.arthur])).toBe(0);
  });

  it("le lecteur ne voit ni les invitations ni le journal", async () => {
    expect(await lire(j.arthur, "select * from public.invitations")).toEqual([]);
    expect(await lire(j.arthur, "select * from public.journal_audit")).toEqual([]);
  });

  it("le dernier administrateur ne peut pas être rétrogradé ni retiré", async () => {
    expect(await erreur(j.alice, "update public.adhesions set role = 'lecteur' where utilisateur_id = $1", [j.alice]))
      .toMatch(/au moins un administrateur/);
    expect(await erreur(j.alice, "delete from public.adhesions where utilisateur_id = $1", [j.alice]))
      .toMatch(/au moins un administrateur/);
  });

  it("l'administrateur voit le journal des actions de son entreprise", async () => {
    const actions = await lire<{ objet: string; action: string }>(j.alice,
      "select objet, action from public.journal_audit order by date");
    expect(actions).toEqual(expect.arrayContaining([
      { objet: "adhesions", action: "insert" },
      { objet: "invitations", action: "insert" },
      { objet: "sources", action: "insert" },
    ]));
  });
});

describe("Invitations", () => {
  it("une adresse non confirmée ne permet pas d'accepter une invitation", async () => {
    await enAdmin("insert into public.invitations (organisation_id, email) values ($1, 'usurpateur@fictif.test')", [j.orgA]);
    const usurpateur = await creerCompte("usurpateur@fictif.test", false);
    const [{ accepter_invitations: n }] = await lire<{ accepter_invitations: number }>(
      usurpateur, "select public.accepter_invitations()");
    expect(n).toBe(0);
    expect(await lire(usurpateur, "select * from public.organisations")).toEqual([]);
  });

  it("une invitation ne profite qu'à l'adresse invitée", async () => {
    const [{ accepter_invitations: n }] = await lire<{ accepter_invitations: number }>(
      j.bea, "select public.accepter_invitations()");
    expect(n).toBe(0);
    expect(await lire(j.bea, "select * from public.organisations where id = $1", [j.orgA])).toEqual([]);
  });
});
