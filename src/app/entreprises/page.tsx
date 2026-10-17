import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alerte, Bouton, Carte, Champ } from "@/components/ui";
import { message } from "@/lib/messages";
import { clientSupabase, utilisateurConnecte } from "@/lib/supabase/serveur";
import { seDeconnecter } from "../connexion/actions";
import { creerEntreprise } from "./actions";

const LIBELLE_ROLE = { admin: "Administrateur", lecteur: "Lecteur" } as const;

async function Contenu({ searchParams }: PageProps<"/entreprises">) {
  const { erreur } = await searchParams;
  const moi = await utilisateurConnecte();
  if (!moi) redirect("/connexion");

  const supabase = await clientSupabase();
  // Rejoint automatiquement les entreprises qui ont invité cette adresse confirmée.
  await supabase.rpc("accepter_invitations");
  const { data: adhesions } = await supabase
    .from("adhesions")
    .select("role, organisations(id, nom)")
    .eq("utilisateur_id", moi.id)
    .order("cree_le");

  const entreprises = (adhesions ?? []).flatMap((a) => {
    const org = a.organisations as unknown as { id: string; nom: string } | null;
    return org ? [{ ...org, role: a.role as keyof typeof LIBELLE_ROLE }] : [];
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vos entreprises</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{moi.email}</p>
        </div>
        <form action={seDeconnecter}>
          <Bouton variante="secondaire" type="submit">Se déconnecter</Bouton>
        </form>
      </header>
      <Alerte texte={message(erreur)} />

      <Carte titre="Choisir une entreprise">
        {entreprises.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Vous n&apos;êtes membre d&apos;aucune entreprise. Créez-en une ci-dessous, ou demandez une invitation à son administrateur.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entreprises.map((e) => (
              <li key={e.id}>
                <Link href={`/e/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:underline">
                  <span className="font-medium">{e.nom}</span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{LIBELLE_ROLE[e.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre="Créer une entreprise">
        <form action={creerEntreprise} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Champ libelle="Nom de l'entreprise" name="nom" maxLength={120} required />
          </div>
          <Bouton type="submit">Créer</Bouton>
        </form>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Vous en serez l&apos;administrateur.</p>
      </Carte>
    </main>
  );
}

// La page dépend de la session : son contenu arrive derrière un état de
// chargement (exigence de Next.js avec cacheComponents). Rien n'est mis en
// cache côté serveur, pour qu'aucune donnée ne passe d'une entreprise à l'autre.
export default function Entreprises(props: PageProps<"/entreprises">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
