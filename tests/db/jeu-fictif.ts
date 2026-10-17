// JEU DE DONNÉES FICTIF — aucune donnée réelle (PRD section 9).
// Deux entreprises imaginaires, créées par les mêmes chemins que dans
// l'application : fonction creer_organisation, invitation, acceptation.
import { creerCompte, enTantQue, lire } from "./aide";

export type JeuFictif = Awaited<ReturnType<typeof creerJeuFictif>>;

/** `prefixe` distingue les comptes quand plusieurs fichiers de test partagent la base. */
export async function creerJeuFictif(prefixe = "") {
  const alice = await creerCompte(`${prefixe}alice.admin@entreprise-a.fictif.test`);
  const arthur = await creerCompte(`${prefixe}arthur.lecteur@entreprise-a.fictif.test`);
  const bea = await creerCompte(`${prefixe}bea.admin@entreprise-b.fictif.test`);

  const [{ creer_organisation: orgA }] = await lire<{ creer_organisation: string }>(
    alice, "select public.creer_organisation('Base de loisirs Fictive A')",
  );
  const [{ creer_organisation: orgB }] = await lire<{ creer_organisation: string }>(
    bea, "select public.creer_organisation('Parc Fictif B')",
  );

  // Alice invite Arthur comme lecteur ; Arthur accepte.
  await enTantQue(alice, (c) =>
    c.query("insert into public.invitations (organisation_id, email, role) values ($1, $2, 'lecteur')", [
      orgA, `${prefixe}arthur.lecteur@entreprise-a.fictif.test`,
    ]),
  );
  await lire(arthur, "select public.accepter_invitations()");

  const sourceA = await enTantQue(alice, async (c) =>
    (await c.query(
      "insert into public.sources (organisation_id, nom, type, base_montant, priorite) values ($1, 'Caisse', 'caisse', 'TTC', 1) returning id",
      [orgA],
    )).rows[0].id as string,
  );
  const sourceB = await enTantQue(bea, async (c) =>
    (await c.query(
      "insert into public.sources (organisation_id, nom, type, base_montant, priorite) values ($1, 'Réservations en ligne', 'en_ligne', 'TTC', 1) returning id",
      [orgB],
    )).rows[0].id as string,
  );

  return { alice, arthur, bea, orgA, orgB, sourceA, sourceB };
}
