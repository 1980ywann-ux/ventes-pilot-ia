import type { ComponentProps, ReactNode } from "react";

export function Carte({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {titre && <h2 className="mb-4 text-lg font-semibold">{titre}</h2>}
      {children}
    </section>
  );
}

export function Alerte({ texte, ton = "erreur" }: { texte: string | null; ton?: "erreur" | "info" }) {
  if (!texte) return null;
  const couleurs =
    ton === "erreur"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100";
  return (
    <p role={ton === "erreur" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${couleurs}`}>
      {texte}
    </p>
  );
}

export function Champ({ libelle, ...props }: { libelle: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      <input
        {...props}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950"
      />
    </label>
  );
}

export function Liste({ libelle, children, ...props }: { libelle: string } & ComponentProps<"select">) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      <select
        {...props}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950"
      >
        {children}
      </select>
    </label>
  );
}

export function Bouton({ variante = "principal", ...props }: { variante?: "principal" | "secondaire" | "danger" } & ComponentProps<"button">) {
  const styles = {
    principal: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
    secondaire: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  }[variante];
  return <button {...props} className={`rounded-md px-4 py-2 text-sm font-medium ${styles} ${props.className ?? ""}`} />;
}
