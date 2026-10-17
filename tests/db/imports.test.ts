// Isolation des imports et de leurs fichiers (étape 2) : mêmes exigences que
// l'étape 1, appliquées à la table imports et à l'espace de stockage.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enAdmin, enTantQue, ecrire, erreur, fermer, lire } from "./aide";
import { creerJeuFictif, type JeuFictif } from "./jeu-fictif";

let j: JeuFictif;
let importA: string;
const EMPREINTE = "a".repeat(64);

function ligneImport(org: string, source: string, id = randomUUID(), empreinte = EMPREINTE) {
  return {
    sql: `insert into public.imports (id, organisation_id, source_id, nom_fichier, taille_octets, empreinte_sha256, format, chemin_stockage)
          values ($1::uuid, $2::uuid, $3, 'caisse-janvier.csv', 1200, $4::text, 'csv', $2::text || '/' || $1::text || '/' || $4::text || '.csv')`,
    params: [id, org, source, empreinte],
    id,
  };
}

async function deposerFichier(uid: string, chemin: string) {
  return enTantQue(uid, (c) => c.query("insert into storage.objects (bucket_id, name) values ('imports', $1)", [chemin]));
}

beforeAll(async () => {
  j = await creerJeuFictif("imports.");
  const { sql, params, id } = ligneImport(j.orgA, j.sourceA);
  await enTantQue(j.alice, (c) => c.query(sql, params));
  importA = id;
  await deposerFichier(j.alice, `${j.orgA}/${importA}/${EMPREINTE}.csv`);
});
afterAll(fermer);

describe("Table imports", () => {
  it("l'admin de A crée un import ; le lecteur de A le voit", async () => {
    expect(await lire(j.arthur, "select id from public.imports")).toEqual([{ id: importA }]);
  });

  it("B ne voit aucun import de A", async () => {
    expect(await lire(j.bea, "select * from public.imports where organisation_id = $1", [j.orgA])).toEqual([]);
  });

  it("B ne peut ni modifier ni supprimer l'import de A", async () => {
    expect(await ecrire(j.bea, "update public.imports set statut = 'parametres_valides' where id = $1", [importA])).toBe(0);
    expect(await ecrire(j.bea, "delete from public.imports where id = $1", [importA])).toBe(0);
  });

  it("B ne peut pas rattacher un import à A, ni à une source de A", async () => {
    const versA = ligneImport(j.orgA, j.sourceA, randomUUID(), "b".repeat(64));
    expect(await erreur(j.bea, versA.sql, versA.params)).toMatch(/row-level security/);
    const sourceDeA = ligneImport(j.orgB, j.sourceA, randomUUID(), "c".repeat(64));
    expect(await erreur(j.bea, sourceDeA.sql, sourceDeA.params)).toMatch(/foreign key|violates/);
  });

  it("le lecteur ne peut pas créer d'import", async () => {
    const l = ligneImport(j.orgA, j.sourceA, randomUUID(), "d".repeat(64));
    expect(await erreur(j.arthur, l.sql, l.params)).toMatch(/row-level security/);
  });

  it("le même fichier ne peut pas être importé deux fois dans une entreprise (H18)", async () => {
    const doublon = ligneImport(j.orgA, j.sourceA);
    expect(await erreur(j.alice, doublon.sql, doublon.params)).toMatch(/duplicate key/);
  });

  it("le même fichier peut être importé par une autre entreprise, sans rien révéler", async () => {
    const l = ligneImport(j.orgB, j.sourceB);
    expect(await erreur(j.bea, l.sql, l.params)).toBeNull();
  });

  it("le chemin du fichier doit correspondre à l'entreprise et à l'import", async () => {
    const id = randomUUID();
    const msg = await erreur(j.alice,
      `insert into public.imports (id, organisation_id, source_id, nom_fichier, taille_octets, empreinte_sha256, format, chemin_stockage)
       values ($1, $2, $3, 'x.csv', 10, $4, 'csv', $5)`,
      [id, j.orgA, j.sourceA, "e".repeat(64), `${j.orgB}/${id}/${"e".repeat(64)}.csv`]);
    expect(msg).toMatch(/check constraint/);
  });

  it("seuls les paramètres de lecture sont modifiables, pas le fichier ni l'empreinte", async () => {
    expect(await erreur(j.alice, "update public.imports set empreinte_sha256 = $1 where id = $2", ["f".repeat(64), importA]))
      .toMatch(/permission denied/);
    expect(await ecrire(j.alice, "update public.imports set encodage = 'windows-1252', separateur = ';' where id = $1", [importA]))
      .toBe(1);
  });

  it("une source utilisée par un import ne peut pas être supprimée", async () => {
    expect(await erreur(j.alice, "delete from public.sources where id = $1", [j.sourceA])).toMatch(/foreign key/);
  });

  it("l'import est inscrit au journal", async () => {
    const lignes = await lire<{ action: string }>(j.alice,
      "select action from public.journal_audit where objet = 'imports' order by date");
    expect(lignes.map((l) => l.action)).toContain("insert");
  });
});

describe("Fichiers stockés", () => {
  const cheminA = () => `${j.orgA}/${importA}/${EMPREINTE}.csv`;

  it("le lecteur de A voit le fichier ; B ne le voit pas", async () => {
    expect(await lire(j.arthur, "select name from storage.objects where bucket_id = 'imports'")).toEqual([{ name: cheminA() }]);
    expect(await lire(j.bea, "select name from storage.objects where name = $1", [cheminA()])).toEqual([]);
  });

  it("B ne peut pas déposer un fichier dans le dossier de A", async () => {
    expect(await erreur(j.bea, "insert into storage.objects (bucket_id, name) values ('imports', $1)", [`${j.orgA}/x/y.csv`]))
      .toMatch(/row-level security/);
  });

  it("chemin sans entreprise valide : refusé", async () => {
    for (const chemin of ["fichier.csv", "../x.csv", `pas-un-uuid/${randomUUID()}/a.csv`]) {
      expect(await erreur(j.alice, "insert into storage.objects (bucket_id, name) values ('imports', $1)", [chemin]))
        .toMatch(/row-level security/);
    }
  });

  it("le lecteur ne peut pas déposer de fichier", async () => {
    expect(await erreur(j.arthur, "insert into storage.objects (bucket_id, name) values ('imports', $1)", [`${j.orgA}/x/y.csv`]))
      .toMatch(/row-level security/);
  });

  it("personne ne peut remplacer un fichier déposé, et B ne peut pas le supprimer", async () => {
    expect(await ecrire(j.alice, "update storage.objects set name = name || '.bak' where name = $1", [cheminA()])).toBe(0);
    expect(await ecrire(j.bea, "delete from storage.objects where name = $1", [cheminA()])).toBe(0);
    const [{ n }] = await enAdmin<{ n: string }>("select count(*) as n from storage.objects where name = $1", [cheminA()]);
    expect(Number(n)).toBe(1);
  });
});
