"use server";

import { redirect } from "next/navigation";
import { clientSupabase } from "@/lib/supabase/serveur";

export async function creerEntreprise(formulaire: FormData) {
  const nom = String(formulaire.get("nom") ?? "").trim();
  if (nom.length < 1 || nom.length > 120) redirect("/entreprises?erreur=nom_invalide");

  const supabase = await clientSupabase();
  const { data, error } = await supabase.rpc("creer_organisation", { nom });
  if (error || !data) redirect("/entreprises?erreur=creation");
  redirect(`/e/${data}`);
}
