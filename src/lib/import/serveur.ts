import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ESPACE_FICHIERS = "imports";

export function empreinteSha256(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

/** Nom affichable : sans chemin, sans caractères de contrôle, 255 caractères au plus. */
export function nettoyerNomFichier(nom: string): string {
  const base = nom.split(/[\\/]/).pop() ?? "";
  const propre = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (propre || "fichier").slice(0, 255);
}

/** Télécharge le fichier d'origine avec la session de l'utilisateur (RLS du stockage). */
export async function telechargerFichier(supabase: SupabaseClient, chemin: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(ESPACE_FICHIERS).download(chemin);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
