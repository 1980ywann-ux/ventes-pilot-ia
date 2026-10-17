"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { codeErreur } from "@/lib/organisation";
import { clientSupabase } from "@/lib/supabase/serveur";

const TYPES = ["caisse", "en_ligne", "facture", "autre"];
const BASES = ["HT", "TTC"];

// Les droits sont vérifiés par la base (RLS) : un lecteur ou un membre
// d'une autre entreprise est refusé quoi que contienne le formulaire.

export async function ajouterSource(formulaire: FormData) {
  const orgId = String(formulaire.get("organisation_id") ?? "");
  const nom = String(formulaire.get("nom") ?? "").trim();
  const type = String(formulaire.get("type") ?? "");
  const base = String(formulaire.get("base_montant") ?? "");
  const priorite = Number(formulaire.get("priorite"));
  const page = `/e/${orgId}/sources`;

  if (!nom || nom.length > 80 || !TYPES.includes(type) || !BASES.includes(base)
      || !Number.isInteger(priorite) || priorite < 1 || priorite > 1000) {
    redirect(`${page}?erreur=source_invalide`);
  }

  const supabase = await clientSupabase();
  const { error } = await supabase.from("sources").insert({
    organisation_id: orgId, nom, type, base_montant: base, priorite,
  });
  const code = codeErreur(error);
  if (code) redirect(`${page}?erreur=${code === "doublon" ? "source_doublon" : code}`);
  revalidatePath(page);
  redirect(page);
}

export async function supprimerSource(formulaire: FormData) {
  const orgId = String(formulaire.get("organisation_id") ?? "");
  const id = String(formulaire.get("id") ?? "");
  const supabase = await clientSupabase();
  const { error } = await supabase.from("sources").delete().eq("id", id).eq("organisation_id", orgId);
  const page = `/e/${orgId}/sources`;
  if (error) redirect(`${page}?erreur=${codeErreur(error)}`);
  revalidatePath(page);
  redirect(page);
}
