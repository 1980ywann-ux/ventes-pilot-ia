import { Suspense } from "react";
import Link from "next/link";
import { Bouton } from "@/components/ui";
import { contexteOrganisation } from "@/lib/organisation";
import { seDeconnecter } from "@/app/connexion/actions";

async function EnTete({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org, role, moi } = await contexteOrganisation(orgId);
  const liens = [
    { href: `/e/${org.id}`, libelle: "Tableau de bord" },
    { href: `/e/${org.id}/sources`, libelle: "Sources" },
    { href: `/e/${org.id}/equipe`, libelle: "Équipe" },
  ];

  return (
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/entreprises" className="text-xs text-zinc-600 hover:underline dark:text-zinc-400">
              ← Changer d&apos;entreprise
            </Link>
            <p className="truncate font-semibold">{org.nom}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">
              {moi.email} · {role === "admin" ? "Administrateur" : "Lecteur"}
            </span>
            <form action={seDeconnecter}>
              <Bouton variante="secondaire" type="submit">Déconnexion</Bouton>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4" aria-label="Sections">
          {liens.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm hover:border-zinc-400">
              {l.libelle}
            </Link>
          ))}
        </nav>
      </header>
  );
}

export default function LayoutEntreprise({ children, params }: LayoutProps<"/e/[orgId]">) {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={<div className="h-24 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />}>
        <EnTete params={params} />
      </Suspense>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
