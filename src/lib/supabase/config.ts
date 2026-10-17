// Variables publiques : l'URL du projet et la clé « publishable » sont
// conçues pour être visibles du navigateur. La sécurité repose sur la RLS.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY doivent être définies (voir .env.example).",
    );
  }
  return { url, cle };
}
