import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "./config";

const CHEMINS_PUBLICS = ["/connexion", "/auth"];

/** Rafraîchit la session à chaque requête et protège les pages privées. */
export async function rafraichirSession(requete: NextRequest) {
  const { url, cle } = configSupabase();
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(aEcrire, entetes) {
        aEcrire.forEach(({ name, value }) => requete.cookies.set(name, value));
        reponse = NextResponse.next({ request: requete });
        aEcrire.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        Object.entries(entetes ?? {}).forEach(([k, v]) => reponse.headers.set(k, v));
      },
    },
  });

  // Ne rien intercaler entre la création du client et getClaims().
  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims?.sub);
  const chemin = requete.nextUrl.pathname;
  const estPublic = CHEMINS_PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
  // Un lien d'e-mail peut revenir sur la racine avec un code de confirmation.
  if (chemin === "/" && requete.nextUrl.searchParams.has("code")) {
    const cible = requete.nextUrl.clone();
    cible.pathname = "/auth/confirmer";
    return NextResponse.redirect(cible);
  }

  if (!connecte && !estPublic) {
    const cible = requete.nextUrl.clone();
    cible.pathname = "/connexion";
    cible.search = "";
    return NextResponse.redirect(cible);
  }
  return reponse;
}
