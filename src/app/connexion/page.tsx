import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Bouton, Carte, Champ } from "@/components/ui";
import { message } from "@/lib/messages";
import { seConnecter, sInscrire } from "./actions";

async function Contenu({ searchParams }: PageProps<"/connexion">) {
  const { erreur, info } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">Ventes Pilot IA</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Des indicateurs de ventes fiables, à partir de vos fichiers.</p>
      </header>
      <Alerte texte={message(erreur)} />
      <Alerte texte={message(info)} ton="info" />

      <Carte titre="Se connecter">
        <form action={seConnecter} className="flex flex-col gap-4">
          <Champ libelle="Adresse e-mail" name="email" type="email" autoComplete="email" required />
          <Champ libelle="Mot de passe" name="mot_de_passe" type="password" autoComplete="current-password" required />
          <Bouton type="submit">Se connecter</Bouton>
        </form>
      </Carte>

      <Carte titre="Créer un compte">
        <form action={sInscrire} className="flex flex-col gap-4">
          <Champ libelle="Adresse e-mail" name="email" type="email" autoComplete="email" required />
          <Champ
            libelle="Mot de passe (10 caractères minimum, majuscules, minuscules et chiffres)"
            name="mot_de_passe"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
          <Bouton type="submit" variante="secondaire">Créer mon compte</Bouton>
        </form>
      </Carte>
    </main>
  );
}

// La page dépend de la session : son contenu arrive derrière un état de
// chargement (exigence de Next.js avec cacheComponents). Rien n'est mis en
// cache côté serveur, pour qu'aucune donnée ne passe d'une entreprise à l'autre.
export default function Connexion(props: PageProps<"/connexion">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
