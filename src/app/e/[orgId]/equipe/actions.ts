"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { codeErreur } from "@/lib/organisation";
import { clientSupabase } from "@/lib/supabase/serveur";

// Les droits sont vérifiés par la base (RLS + déclencheurs).

const ROLES = ["admin", "lecteur"];

function champs(formulaire: FormData) {
  const orgId = String(formulaire.get("organisation_id") ?? "");
  return { orgId, page: `/e/${orgId}/equipe` };
}

function terminer(page: string, erreur: { code?: string; message?: string } | null, succes?: string) {
  const code = codeErreur(erreur);
  if (code) redirect(`${page}?erreur=${code}`);
  revalidatePath(page);
  redirect(succes ? `${page}?info=${succes}` : page);
}

export async function inviter(formulaire: FormData) {
  const { orgId, page } = champs(formulaire);
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const role = String(formulaire.get("role") ?? "lecteur");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) redirect(`${page}?erreur=email_invalide`);
  if (!ROLES.includes(role)) redirect(`${page}?erreur=refuse`);

  const supabase = await clientSupabase();
  const { error } = await supabase.from("invitations").insert({ organisation_id: orgId, email, role });
  if (error?.code === "23505") redirect(`${page}?erreur=invitation_doublon`);
  terminer(page, error, "invitation_envoyee");
}

export async function annulerInvitation(formulaire: FormData) {
  const { orgId, page } = champs(formulaire);
  const supabase = await clientSupabase();
  const { error } = await supabase.from("invitations").delete()
    .eq("id", String(formulaire.get("id") ?? "")).eq("organisation_id", orgId);
  terminer(page, error);
}

export async function changerRole(formulaire: FormData) {
  const { orgId, page } = champs(formulaire);
  const role = String(formulaire.get("role") ?? "");
  if (!ROLES.includes(role)) redirect(`${page}?erreur=refuse`);
  const supabase = await clientSupabase();
  const { error } = await supabase.from("adhesions").update({ role })
    .eq("organisation_id", orgId).eq("utilisateur_id", String(formulaire.get("utilisateur_id") ?? ""));
  terminer(page, error);
}

export async function retirerMembre(formulaire: FormData) {
  const { orgId, page } = champs(formulaire);
  const supabase = await clientSupabase();
  const { error } = await supabase.from("adhesions").delete()
    .eq("organisation_id", orgId).eq("utilisateur_id", String(formulaire.get("utilisateur_id") ?? ""));
  terminer(page, error);
}
