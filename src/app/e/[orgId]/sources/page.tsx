import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Bouton, Carte, Champ, Liste } from "@/components/ui";
import { message } from "@/lib/messages";
import { contexteOrganisation } from "@/lib/organisation";
import { ajouterSource, supprimerSource } from "./actions";

const LIBELLE_TYPE: Record<string, string> = {
  caisse: "Caisse", en_ligne: "Réservations en ligne", facture: "Factures", autre: "Autre",
};

type Source = { id: string; nom: string; type: string; base_montant: string; priorite: number };

async function Contenu({ params, searchParams }: PageProps<"/e/[orgId]/sources">) {
  const { orgId } = await params;
  const { erreur } = await searchParams;
  const { supabase, org, role } = await contexteOrganisation(orgId);
  const { data } = await supabase
    .from("sources")
    .select("id, nom, type, base_montant, priorite")
    .eq("organisation_id", org.id)
    .order("priorite")
    .order("nom");
  const sources = (data ?? []) as Source[];
  const admin = role === "admin";

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Sources de ventes</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Chaque fichier importé est rattaché à une source. La priorité (1 = la plus fiable) départage une même transaction
          présente dans plusieurs sources.
        </p>
      </div>
      <Alerte texte={message(erreur)} />

      <Carte>
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Aucune source configurée.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{s.nom}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {LIBELLE_TYPE[s.type] ?? s.type} · montants {s.base_montant} · priorité {s.priorite}
                  </p>
                </div>
                {admin && (
                  <form action={supprimerSource}>
                    <input type="hidden" name="organisation_id" value={org.id} />
                    <input type="hidden" name="id" value={s.id} />
                    <Bouton variante="danger" type="submit">Supprimer</Bouton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {admin && (
        <Carte titre="Ajouter une source">
          <form action={ajouterSource} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="organisation_id" value={org.id} />
            <Champ libelle="Nom" name="nom" placeholder="ex. Caisse" maxLength={80} required />
            <Liste libelle="Type" name="type" defaultValue="caisse">
              {Object.entries(LIBELLE_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Liste>
            <Liste libelle="Les montants de cette source sont" name="base_montant" defaultValue="TTC">
              <option value="TTC">TTC</option>
              <option value="HT">HT</option>
            </Liste>
            <Champ libelle="Priorité (1 = la plus fiable)" name="priorite" type="number" min={1} max={1000} defaultValue={100} required />
            <div className="sm:col-span-2">
              <Bouton type="submit">Ajouter</Bouton>
            </div>
          </form>
        </Carte>
      )}
    </>
  );
}

// La page dépend de la session : son contenu arrive derrière un état de
// chargement (exigence de Next.js avec cacheComponents). Rien n'est mis en
// cache côté serveur, pour qu'aucune donnée ne passe d'une entreprise à l'autre.
export default function Sources(props: PageProps<"/e/[orgId]/sources">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
