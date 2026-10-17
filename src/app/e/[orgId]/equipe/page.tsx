import { Suspense } from "react";
import { Chargement } from "@/components/chargement";
import { Alerte, Bouton, Carte, Champ, Liste } from "@/components/ui";
import { message } from "@/lib/messages";
import { contexteOrganisation, type Role } from "@/lib/organisation";
import { annulerInvitation, changerRole, inviter, retirerMembre } from "./actions";

const LIBELLE_ROLE: Record<Role, string> = { admin: "Administrateur", lecteur: "Lecteur" };

async function Contenu({ params, searchParams }: PageProps<"/e/[orgId]/equipe">) {
  const { orgId } = await params;
  const { erreur, info } = await searchParams;
  const { supabase, org, role, moi } = await contexteOrganisation(orgId);
  const admin = role === "admin";

  const { data: adhesions } = await supabase
    .from("adhesions").select("utilisateur_id, role").eq("organisation_id", org.id).order("cree_le");
  const ids = (adhesions ?? []).map((a) => a.utilisateur_id as string);
  const { data: profils } = ids.length
    ? await supabase.from("profils").select("id, email, nom").in("id", ids)
    : { data: [] };
  const emailDe = new Map((profils ?? []).map((p) => [p.id as string, (p.nom as string | null) || (p.email as string)]));

  const { data: invitations } = admin
    ? await supabase.from("invitations").select("id, email, role")
        .eq("organisation_id", org.id).is("acceptee_le", null).order("cree_le")
    : { data: [] };

  return (
    <>
      <h1 className="text-2xl font-bold">Équipe</h1>
      <Alerte texte={message(erreur)} />
      <Alerte texte={message(info)} ton="info" />

      <Carte titre="Membres">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(adhesions ?? []).map((a) => {
            const uid = a.utilisateur_id as string;
            const roleMembre = a.role as Role;
            return (
              <li key={uid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{emailDe.get(uid) ?? "Compte"}{uid === moi.id && " (vous)"}</p>
                  {!admin && <p className="text-sm text-zinc-600 dark:text-zinc-400">{LIBELLE_ROLE[roleMembre]}</p>}
                </div>
                {admin && (
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={changerRole} className="flex items-end gap-2">
                      <input type="hidden" name="organisation_id" value={org.id} />
                      <input type="hidden" name="utilisateur_id" value={uid} />
                      <Liste libelle="Rôle" name="role" defaultValue={roleMembre}>
                        <option value="lecteur">Lecteur</option>
                        <option value="admin">Administrateur</option>
                      </Liste>
                      <Bouton variante="secondaire" type="submit">Enregistrer</Bouton>
                    </form>
                    <form action={retirerMembre}>
                      <input type="hidden" name="organisation_id" value={org.id} />
                      <input type="hidden" name="utilisateur_id" value={uid} />
                      <Bouton variante="danger" type="submit">Retirer</Bouton>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      {admin && (
        <>
          <Carte titre="Inviter une personne">
            <form action={inviter} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <input type="hidden" name="organisation_id" value={org.id} />
              <Champ libelle="Adresse e-mail" name="email" type="email" required />
              <Liste libelle="Rôle" name="role" defaultValue="lecteur">
                <option value="lecteur">Lecteur (consulte, exporte)</option>
                <option value="admin">Administrateur (importe, configure, invite)</option>
              </Liste>
              <Bouton type="submit">Inviter</Bouton>
            </form>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              La personne crée son compte avec cette adresse, la confirme, puis rejoint l&apos;entreprise automatiquement.
              Aucun e-mail n&apos;est envoyé par l&apos;application à ce stade : prévenez-la vous-même.
            </p>
          </Carte>

          {(invitations ?? []).length > 0 && (
            <Carte titre="Invitations en attente">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(invitations ?? []).map((i) => (
                  <li key={i.id as string} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate">{i.email as string} · {LIBELLE_ROLE[i.role as Role]}</span>
                    <form action={annulerInvitation}>
                      <input type="hidden" name="organisation_id" value={org.id} />
                      <input type="hidden" name="id" value={i.id as string} />
                      <Bouton variante="secondaire" type="submit">Annuler</Bouton>
                    </form>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </>
      )}
    </>
  );
}

// La page dépend de la session : son contenu arrive derrière un état de
// chargement (exigence de Next.js avec cacheComponents). Rien n'est mis en
// cache côté serveur, pour qu'aucune donnée ne passe d'une entreprise à l'autre.
export default function Equipe(props: PageProps<"/e/[orgId]/equipe">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu {...props} />
    </Suspense>
  );
}
