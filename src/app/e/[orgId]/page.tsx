import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import Link from "next/link";
import { Carte } from "@/components/ui";
import { contexteOrganisation } from "@/lib/organisation";

async function Contenu({ params }: PageProps<"/e/[orgId]">) {
  const { orgId } = await params;
  const { supabase, org, role } = await contexteOrganisation(orgId);
  const [{ count }, { count: nbImports }] = await Promise.all([
    supabase.from("sources").select("id", { count: "exact", head: true }).eq("organisation_id", org.id),
    supabase.from("imports").select("id", { count: "exact", head: true }).eq("organisation_id", org.id),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <Carte>
        <p className="text-sm">
          {nbImports ? `${nbImports} fichier${nbImports > 1 ? "s" : ""} importé${nbImports > 1 ? "s" : ""}. ` : "Aucun fichier importé. "}
          Les indicateurs s&apos;afficheront ici une fois les colonnes associées et les lignes contrôlées (étapes 3 à 7 du plan).{" "}
          <Link href={`/e/${org.id}/imports`} className="underline">Voir les imports</Link>
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {count ?? 0} source{(count ?? 0) > 1 ? "s" : ""} configurée{(count ?? 0) > 1 ? "s" : ""}.{" "}
          {role === "admin" && (
            <Link href={`/e/${org.id}/sources`} className="underline">Gérer les sources</Link>
          )}
        </p>
      </Carte>
    </>
  );
}

// La page dépend de la session : son contenu arrive derrière un état de
// chargement (exigence de Next.js avec cacheComponents). Rien n'est mis en
// cache côté serveur, pour qu'aucune donnée ne passe d'une entreprise à l'autre.
export default function TableauDeBord(props: PageProps<"/e/[orgId]">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
