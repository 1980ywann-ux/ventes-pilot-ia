import type { NextRequest } from "next/server";
import { rafraichirSession } from "@/lib/supabase/session";

export async function proxy(requete: NextRequest) {
  return rafraichirSession(requete);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
