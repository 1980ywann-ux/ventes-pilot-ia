"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientSupabase } from "@/lib/supabase/serveur";

function lireIdentifiants(formulaire: FormData) {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");
  return { email, motDePasse };
}

export async function seConnecter(formulaire: FormData) {
  const { email, motDePasse } = lireIdentifiants(formulaire);
  const supabase = await clientSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) {
    redirect(`/connexion?erreur=${error.code === "email_not_confirmed" ? "email_non_confirme" : "identifiants"}`);
  }
  redirect("/entreprises");
}

export async function sInscrire(formulaire: FormData) {
  const { email, motDePasse } = lireIdentifiants(formulaire);
  const origine = (await headers()).get("origin");
  const supabase = await clientSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: origine ? { emailRedirectTo: `${origine}/auth/confirmer` } : undefined,
  });
  // Même réponse que l'adresse existe ou non : on ne révèle pas qui a un compte.
  if (error && error.code !== "user_already_exists") redirect("/connexion?erreur=inscription");
  redirect("/connexion?info=verifier_email");
}

export async function seDeconnecter() {
  const supabase = await clientSupabase();
  await supabase.auth.signOut();
  redirect("/connexion");
}
