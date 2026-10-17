import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Bouton, Carte, Liste } from "@/components/ui";
import { message } from "@/lib/messages";
import { contexteOrganisation } from "@/lib/organisation";
import { deposerFichier } from "./actions";

async function Contenu({ params, searchParams }: PageProps<"/e/[orgId]/imports/nouveau">) {
  const { orgId } = await params;
  const { erreur } = await searchParams;
  const { supabase, org, role } = await contexteOrganisation(orgId);
  if (role !== "admin") notFound();

  const { data: sources } = await supabase
    .from("sources").select("id, nom, base_montant").eq("organisation_id", org.id).order("priorite").order("nom");

  return (
    <>
      <div>
        <Link href={`/e/${org.id}/imports`} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">← Imports</Link>
        <h1 className="text-2xl font-bold">Importer un fichier</h1>
      </div>
      <Alerte texte={message(erreur)} />

      {(sources ?? []).length === 0 ? (
        <Carte>
          <p className="text-sm">
            Créez d&apos;abord une source (caisse, réservations en ligne, factures…) :{" "}
            <Link href={`/e/${org.id}/sources`} className="underline">gérer les sources</Link>.
          </p>
        </Carte>
      ) : (
        <Carte>
          <form action={deposerFichier} className="flex flex-col gap-4">
            <input type="hidden" name="organisation_id" value={org.id} />
            <Liste libelle="Source du fichier" name="source_id" required defaultValue="">
              <option value="" disabled>Choisir…</option>
              {(sources ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.nom} (montants {s.base_montant})</option>
              ))}
            </Liste>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Fichier (.csv ou .xlsx, 20 Mo au plus)</span>
              <input
                type="file"
                name="fichier"
                accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="rounded-md border border-dashed border-zinc-400 bg-white p-6 text-base file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white dark:border-zinc-600 dark:bg-zinc-950 dark:file:bg-zinc-100 dark:file:text-zinc-900"
              />
            </label>
            <div>
              <Bouton type="submit">Déposer et prévisualiser</Bouton>
            </div>
          </form>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Le fichier est conservé tel quel, sans modification. L&apos;encodage et le séparateur sont détectés
            automatiquement ; vous pourrez les corriger à l&apos;étape suivante.
          </p>
        </Carte>
      )}
    </>
  );
}

export default function NouvelImport(props: PageProps<"/e/[orgId]/imports/nouveau">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
