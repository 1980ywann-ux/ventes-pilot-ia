import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { configSupabase } from "./config";

/**
 * Client Supabase pour les composants serveur, actions et routes.
 * Toutes les requêtes partent avec la session de l'utilisateur : la base
 * applique la RLS. Aucune clé de service n'est utilisée dans l'application.
 */
export async function clientSupabase() {
  // Lecture de la requête (la vérification du jeton utilise l'heure) :
  // ce code ne s'exécute jamais au prérendu.
  await connection();
  const { url, cle } = configSupabase();
  const magasin = await cookies();
  return createServerClient(url, cle, {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(aEcrire) {
        try {
          aEcrire.forEach(({ name, value, options }) => magasin.set(name, value, options));
        } catch {
          // Appel depuis un composant serveur : écrire est impossible, et
          // inutile car le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}

/** Identifiant de l'utilisateur connecté (jeton vérifié), ou null. */
export async function utilisateurConnecte() {
  const supabase = await clientSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string | undefined) ?? "" };
}
