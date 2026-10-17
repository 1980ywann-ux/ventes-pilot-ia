import type { Avertissement } from "./apercu";
import type { Encodage, Separateur } from "./texte";

export const LIBELLE_ENCODAGE: Record<Encodage, string> = {
  "utf-8": "UTF-8",
  "windows-1252": "Windows-1252 (exports Excel, caisses sous Windows)",
  "utf-16le": "UTF-16",
  "utf-16be": "UTF-16 (gros-boutiste)",
};

export const LIBELLE_SEPARATEUR: Record<Separateur, string> = {
  ";": "Point-virgule ( ; )",
  ",": "Virgule ( , )",
  "\t": "Tabulation",
  "|": "Barre verticale ( | )",
};

export const LIBELLE_STATUT = {
  televerse: "À vérifier",
  parametres_valides: "Lecture validée",
} as const;

export function texteAvertissement(a: Avertissement): string {
  switch (a.code) {
    case "entetes_dupliques":
      return `Colonnes portant le même nom : ${a.colonnes.join(", ")}. Il faudra choisir laquelle utiliser.`;
    case "entetes_vides":
      return `${a.nombre} colonne${a.nombre > 1 ? "s" : ""} sans en-tête, nommée${a.nombre > 1 ? "s" : ""} « Colonne N ».`;
    case "colonnes_irregulieres":
      return `${a.lignes} ligne${a.lignes > 1 ? "s n'ont" : " n'a"} pas le même nombre de colonnes que l'en-tête. Vérifiez le séparateur.`;
    case "zones_fusionnees":
      return `${a.nombre} zone${a.nombre > 1 ? "s" : ""} de cellules fusionnées : la valeur est répétée dans chaque cellule.`;
    case "formules_sans_valeur":
      return `${a.nombre} formule${a.nombre > 1 ? "s" : ""} sans valeur enregistrée : ouvrez le fichier dans Excel, enregistrez-le, puis importez-le à nouveau.`;
    case "caracteres_suspects":
      return "Des caractères semblent mal décodés (par exemple « Ã© » au lieu de « é ») : essayez un autre encodage.";
  }
}

export function texteTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris",
});
export const texteDateHeure = (iso: string) => FORMAT_DATE.format(new Date(iso));
