"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { construireApercu, type Apercu } from "@/lib/import/apercu";
import { ErreurImport } from "@/lib/import/erreurs";
import { ESPACE_FICHIERS, telechargerFichier } from "@/lib/import/serveur";
import { ENCODAGES, SEPARATEURS, type Encodage, type Separateur } from "@/lib/import/texte";
import { clientSupabase } from "@/lib/supabase/serveur";

function champs(formulaire: FormData) {
  const orgId = String(formulaire.get("organisation_id") ?? "");
  const importId = String(formulaire.get("import_id") ?? "");
  return { orgId, importId, page: `/e/${orgId}/imports/${importId}` };
}

/** Enregistre les paramètres de lecture confirmés par l'utilisateur. */
export async function validerParametres(formulaire: FormData) {
  const { orgId, importId, page } = champs(formulaire);
  const supabase = await clientSupabase();
  const { data: imp } = await supabase
    .from("imports").select("nom_fichier, chemin_stockage").eq("id", importId).eq("organisation_id", orgId).maybeSingle();
  if (!imp) redirect(`/e/${orgId}/imports`);

  const encodage = String(formulaire.get("encodage") ?? "");
  const separateur = String(formulaire.get("separateur") ?? "");
  const feuille = formulaire.get("feuille");
  const options = {
    encodage: ENCODAGES.includes(encodage as Encodage) ? (encodage as Encodage) : undefined,
    separateur: SEPARATEURS.includes(separateur as Separateur) ? (separateur as Separateur) : undefined,
    feuille: typeof feuille === "string" && feuille ? feuille : undefined,
  };

  // On relit le fichier avec ces paramètres : on n'enregistre que ce qui se lit.
  const octets = await telechargerFichier(supabase, imp.chemin_stockage);
  if (!octets) redirect(`${page}?erreur=erreur`);
  let apercu: Apercu | undefined;
  let code: string | undefined;
  try {
    apercu = await construireApercu(imp.nom_fichier, octets, options);
  } catch (e) {
    if (!(e instanceof ErreurImport)) throw e;
    code = e.code;
  }
  if (!apercu) redirect(`${page}?erreur=${code}`);

  const { error } = await supabase.from("imports").update({
    encodage: apercu.encodage ?? null,
    separateur: apercu.separateur ?? null,
    feuille: apercu.feuille ?? null,
    lignes_lues: apercu.nombreLignes,
    statut: "parametres_valides",
  }).eq("id", importId).eq("organisation_id", orgId);
  if (error) redirect(`${page}?erreur=refuse`);
  revalidatePath(page);
  redirect(`${page}?info=parametres_valides`);
}

export async function supprimerImport(formulaire: FormData) {
  const { orgId, importId, page } = champs(formulaire);
  const supabase = await clientSupabase();
  const { data: supprime, error } = await supabase
    .from("imports").delete().eq("id", importId).eq("organisation_id", orgId).select("chemin_stockage").maybeSingle();
  if (error || !supprime) redirect(`${page}?erreur=refuse`);
  await supabase.storage.from(ESPACE_FICHIERS).remove([supprime.chemin_stockage]);
  revalidatePath(`/e/${orgId}/imports`);
  redirect(`/e/${orgId}/imports?info=import_supprime`);
}
