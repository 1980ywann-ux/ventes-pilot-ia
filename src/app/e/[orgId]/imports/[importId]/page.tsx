import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Bouton, Carte, Liste } from "@/components/ui";
import { construireApercu, type Apercu } from "@/lib/import/apercu";
import { ErreurImport } from "@/lib/import/erreurs";
import {
  LIBELLE_ENCODAGE, LIBELLE_SEPARATEUR, LIBELLE_STATUT, texteAvertissement, texteDateHeure, texteTaille,
} from "@/lib/import/libelles";
import { telechargerFichier } from "@/lib/import/serveur";
import { ENCODAGES, SEPARATEURS, type Encodage, type Separateur } from "@/lib/import/texte";
import { message } from "@/lib/messages";
import { contexteOrganisation } from "@/lib/organisation";
import { supprimerImport, validerParametres } from "./actions";

type Import = {
  id: string;
  nom_fichier: string;
  taille_octets: number;
  empreinte_sha256: string;
  format: "csv" | "xlsx";
  chemin_stockage: string;
  encodage: Encodage | null;
  separateur: Separateur | null;
  feuille: string | null;
  statut: keyof typeof LIBELLE_STATUT;
  importe_le: string;
  sources: { nom: string; base_montant: string } | null;
};

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unique = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Contenu({ params, searchParams }: PageProps<"/e/[orgId]/imports/[importId]">) {
  const { orgId, importId } = await params;
  const recherche = await searchParams;
  const { supabase, org, role } = await contexteOrganisation(orgId);
  if (!FORMAT_UUID.test(importId)) notFound();

  const { data } = await supabase
    .from("imports")
    .select("id, nom_fichier, taille_octets, empreinte_sha256, format, chemin_stockage, encodage, separateur, feuille, statut, importe_le, sources(nom, base_montant)")
    .eq("id", importId).eq("organisation_id", org.id).maybeSingle();
  if (!data) notFound();
  const imp = data as unknown as Import;
  const admin = role === "admin";

  // Paramètres demandés dans l'URL (essai), sinon ceux enregistrés.
  const enc = unique(recherche.encodage);
  const sep = unique(recherche.separateur);
  const options = {
    encodage: ENCODAGES.includes(enc as Encodage) ? (enc as Encodage) : imp.encodage ?? undefined,
    separateur: SEPARATEURS.includes(sep as Separateur) ? (sep as Separateur) : imp.separateur ?? undefined,
    feuille: unique(recherche.feuille) ?? imp.feuille ?? undefined,
  };

  const octets = await telechargerFichier(supabase, imp.chemin_stockage);
  let apercu: Apercu | null = null;
  let erreurLecture: string | null = octets ? null : "erreur";
  if (octets) {
    try {
      apercu = await construireApercu(imp.nom_fichier, octets, options);
    } catch (e) {
      if (!(e instanceof ErreurImport)) throw e;
      erreurLecture = e.code;
    }
  }

  return (
    <>
      <div>
        <Link href={`/e/${org.id}/imports`} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">← Imports</Link>
        <h1 className="break-all text-2xl font-bold">{imp.nom_fichier}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {imp.sources?.nom} (montants {imp.sources?.base_montant}) · {texteTaille(imp.taille_octets)} · déposé le{" "}
          {texteDateHeure(imp.importe_le)} · {LIBELLE_STATUT[imp.statut]}
        </p>
        <p className="font-mono text-xs text-zinc-500" title="Empreinte SHA-256 du fichier d'origine">
          Empreinte {imp.empreinte_sha256.slice(0, 16)}…
        </p>
      </div>
      <Alerte texte={message(unique(recherche.erreur))} />
      <Alerte texte={message(unique(recherche.info))} ton="info" />
      <Alerte texte={erreurLecture ? message(erreurLecture) : null} />

      {apercu && (
        <>
          <Carte titre="Paramètres de lecture">
            <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {apercu.format === "csv" ? (
                <>
                  <Liste libelle="Encodage" name="encodage" defaultValue={apercu.encodage}>
                    {ENCODAGES.map((e) => <option key={e} value={e}>{LIBELLE_ENCODAGE[e]}</option>)}
                  </Liste>
                  <Liste libelle="Séparateur" name="separateur" defaultValue={apercu.separateur}>
                    {SEPARATEURS.map((s) => <option key={s} value={s}>{LIBELLE_SEPARATEUR[s]}</option>)}
                  </Liste>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <Liste libelle="Feuille" name="feuille" defaultValue={apercu.feuille}>
                    {apercu.feuilles?.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Liste>
                </div>
              )}
              <Bouton type="submit" variante="secondaire">Actualiser l&apos;aperçu</Bouton>
            </form>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {apercu.nombreLignes.toLocaleString("fr-FR")} ligne{apercu.nombreLignes > 1 ? "s" : ""} de données,{" "}
              {apercu.entetes.length} colonne{apercu.entetes.length > 1 ? "s" : ""}.
            </p>
          </Carte>

          {apercu.avertissements.length > 0 && (
            <Carte titre="À vérifier">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {apercu.avertissements.map((a, i) => <li key={i}>{texteAvertissement(a)}</li>)}
              </ul>
            </Carte>
          )}

          <Carte titre={`Aperçu des ${Math.min(apercu.lignes.length, 20)} premières lignes`}>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {apercu.entetes.map((e, i) => (
                      <th key={i} scope="col" className="whitespace-nowrap border-b border-zinc-300 px-3 py-2 text-left font-semibold dark:border-zinc-700">{e}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apercu.lignes.map((ligne, i) => (
                    <tr key={i} className="odd:bg-zinc-50 dark:odd:bg-zinc-950">
                      {ligne.map((c, k) => (
                        <td key={k} className="max-w-64 truncate whitespace-nowrap border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800" title={c}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          {admin && (
            <Carte>
              <form action={validerParametres} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="organisation_id" value={org.id} />
                <input type="hidden" name="import_id" value={imp.id} />
                <input type="hidden" name="encodage" value={apercu.encodage ?? ""} />
                <input type="hidden" name="separateur" value={apercu.separateur ?? ""} />
                <input type="hidden" name="feuille" value={apercu.feuille ?? ""} />
                <Bouton type="submit">L&apos;aperçu est correct : valider ces paramètres</Bouton>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Étape suivante : associer les colonnes.</span>
              </form>
            </Carte>
          )}
        </>
      )}

      {admin && (
        <details className="text-sm">
          <summary className="cursor-pointer text-red-700 dark:text-red-300">Supprimer cet import…</summary>
          <form action={supprimerImport} className="mt-3 flex flex-col items-start gap-3">
            <input type="hidden" name="organisation_id" value={org.id} />
            <input type="hidden" name="import_id" value={imp.id} />
            <p>Le fichier d&apos;origine et ses paramètres seront définitivement supprimés. L&apos;opération est inscrite au journal.</p>
            <Bouton type="submit" variante="danger">Confirmer la suppression</Bouton>
          </form>
        </details>
      )}
    </>
  );
}

export default function PageImport(props: PageProps<"/e/[orgId]/imports/[importId]">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
