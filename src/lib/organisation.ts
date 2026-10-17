import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { clientSupabase, utilisateurConnecte } from "@/lib/supabase/serveur";

export type Role = "admin" | "lecteur";

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Charge l'entreprise demandée et le rôle de l'utilisateur. Une entreprise
 * dont on n'est pas membre est invisible (RLS) : on répond « introuvable »,
 * exactement comme pour un identifiant qui n'existe pas.
 */
export const contexteOrganisation = cache(async (orgId: string) => {
  const moi = await utilisateurConnecte();
  if (!moi) redirect("/connexion");
  if (!FORMAT_UUID.test(orgId)) notFound();

  const supabase = await clientSupabase();
  const [{ data: org }, { data: adhesion }] = await Promise.all([
    supabase.from("organisations").select("id, nom").eq("id", orgId).maybeSingle(),
    supabase.from("adhesions").select("role").eq("organisation_id", orgId).eq("utilisateur_id", moi.id).maybeSingle(),
  ]);
  if (!org || !adhesion) notFound();

  return { supabase, moi, org: org as { id: string; nom: string }, role: adhesion.role as Role };
});

/** Code de message pour une erreur PostgreSQL renvoyée par Supabase. */
export function codeErreur(erreur: { code?: string; message?: string } | null) {
  if (!erreur) return null;
  if (erreur.code === "23505") return "doublon";
  if (erreur.code === "42501") return "refuse";
  if (erreur.message?.includes("au moins un administrateur")) return "dernier_admin";
  return "erreur";
}
