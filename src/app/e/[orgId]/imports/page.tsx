import Link from "next/link";
import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Carte } from "@/components/ui";
import { LIBELLE_STATUT, texteDateHeure } from "@/lib/import/libelles";
import { message } from "@/lib/messages";
import { contexteOrganisation } from "@/lib/organisation";

type LigneImport = {
  id: string;
  nom_fichier: string;
  statut: keyof typeof LIBELLE_STATUT;
  lignes_lues: number | null;
  importe_le: string;
  sources: { nom: string } | null;
};

async function Contenu({ params, searchParams }: PageProps<"/e/[orgId]/imports">) {
  const { orgId } = await params;
  const { info } = await searchParams;
  const { supabase, org, role } = await contexteOrganisation(orgId);
  const { data } = await supabase
    .from("imports")
    .select("id, nom_fichier, statut, lignes_lues, importe_le, sources(nom)")
    .eq("organisation_id", org.id)
    .order("importe_le", { ascending: false });
  const imports = (data ?? []) as unknown as LigneImport[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Imports</h1>
        {role === "admin" && (
          <Link href={`/e/${org.id}/imports/nouveau`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            Importer un fichier
          </Link>
        )}
      </div>
      <Alerte texte={message(info)} ton="info" />
      <Carte>
        {imports.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Aucun fichier importé pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {imports.map((i) => (
              <li key={i.id}>
                <Link href={`/e/${org.id}/imports/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{i.nom_fichier}</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {i.sources?.nom ?? "Source"} · {texteDateHeure(i.importe_le)}
                      {i.lignes_lues !== null && ` · ${i.lignes_lues.toLocaleString("fr-FR")} lignes`}
                    </span>
                  </span>
                  <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                    {LIBELLE_STATUT[i.statut]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  );
}

export default function Imports(props: PageProps<"/e/[orgId]/imports">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
