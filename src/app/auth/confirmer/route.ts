import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clientSupabase } from "@/lib/supabase/serveur";

// Lien reçu par e-mail : confirmation d'adresse (ou autre lien à usage unique).
export async function GET(requete: NextRequest) {
  const params = requete.nextUrl.searchParams;
  const supabase = await clientSupabase();
  let ok = false;

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const cible = requete.nextUrl.clone();
  cible.search = "";
  cible.pathname = ok ? "/entreprises" : "/connexion";
  if (!ok) cible.searchParams.set("erreur", "lien");
  return NextResponse.redirect(cible);
}
