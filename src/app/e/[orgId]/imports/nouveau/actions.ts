"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { construireApercu, type Apercu } from "@/lib/import/apercu";
import { ErreurImport, LIMITES } from "@/lib/import/erreurs";
import { ESPACE_FICHIERS, empreinteSha256, nettoyerNomFichier } from "@/lib/import/serveur";
import { codeErreur } from "@/lib/organisation";
import { clientSupabase } from "@/lib/supabase/serveur";

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dépôt d'un fichier (PRD parcours P1, écrans E3 → E4). Les droits sont
// vérifiés par la base : RLS sur la table imports et sur le stockage.
export async function deposerFichier(formulaire: FormData) {
  const orgId = String(formulaire.get("organisation_id") ?? "");
  const sourceId = String(formulaire.get("source_id") ?? "");
  const fichier = formulaire.get("fichier");
  const page = `/e/${orgId}/imports/nouveau`;

  if (!FORMAT_UUID.test(orgId)) redirect("/entreprises");
  if (!FORMAT_UUID.test(sourceId)) redirect(`${page}?erreur=source_requise`);
  if (!(fichier instanceof File) || fichier.size === 0) redirect(`${page}?erreur=fichier_vide`);
  if (fichier.size > LIMITES.octets) redirect(`${page}?erreur=fichier_trop_gros`);

  const nom = nettoyerNomFichier(fichier.name);
  const octets = new Uint8Array(await fichier.arrayBuffer());

  // Lecture complète avant tout enregistrement : un fichier illisible n'est pas conservé.
  let apercu: Apercu | undefined;
  let codeLecture: string | undefined;
  try {
    apercu = await construireApercu(nom, octets);
  } catch (e) {
    if (!(e instanceof ErreurImport)) throw e;
    codeLecture = e.code;
  }
  if (!apercu) redirect(`${page}?erreur=${codeLecture}`);

  const empreinte = empreinteSha256(octets);
  const supabase = await clientSupabase();

  // Même fichier déjà importé dans cette entreprise (PRD H18).
  const { data: existant } = await supabase
    .from("imports").select("id").eq("organisation_id", orgId).eq("empreinte_sha256", empreinte).maybeSingle();
  if (existant) redirect(`/e/${orgId}/imports/${existant.id}?erreur=deja_importe`);

  const id = randomUUID();
  const chemin = `${orgId}/${id}/${empreinte}.${apercu.format}`;
  const { data: moi } = await supabase.auth.getClaims();
  const { error: erreurLigne } = await supabase.from("imports").insert({
    id,
    organisation_id: orgId,
    source_id: sourceId,
    nom_fichier: nom,
    taille_octets: octets.length,
    empreinte_sha256: empreinte,
    format: apercu.format,
    chemin_stockage: chemin,
    encodage: apercu.encodage ?? null,
    separateur: apercu.separateur ?? null,
    feuille: apercu.feuille ?? null,
    lignes_lues: apercu.nombreLignes,
    importe_par: moi?.claims?.sub,
  });
  if (erreurLigne) {
    const code = codeErreur(erreurLigne);
    redirect(`${page}?erreur=${code === "doublon" ? "deja_importe" : code === "erreur" ? "refuse" : code}`);
  }

  const { error: erreurFichier } = await supabase.storage
    .from(ESPACE_FICHIERS)
    .upload(chemin, octets, { contentType: "application/octet-stream", upsert: false });
  if (erreurFichier) {
    // Pas d'import sans son fichier : on annule l'enregistrement.
    await supabase.from("imports").delete().eq("id", id);
    redirect(`${page}?erreur=depot_echoue`);
  }

  redirect(`/e/${orgId}/imports/${id}`);
}
