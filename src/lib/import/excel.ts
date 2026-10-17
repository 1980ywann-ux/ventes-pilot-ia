// Lecture d'un classeur Excel (.xlsx). Les formules ne sont jamais
// exécutées : on lit la dernière valeur calculée enregistrée par Excel.
import ExcelJS from "exceljs";
import { ErreurImport } from "./erreurs";

export type Feuille = {
  nom: string;
  lignes: string[][];
  zonesFusionnees: number;
  formulesSansValeur: number;
};

const deux = (n: number) => String(n).padStart(2, "0");

/** Date Excel → texte jj/mm/aaaa (et hh:mm si une heure est présente). */
function texteDate(d: Date): string {
  // ExcelJS restitue l'heure locale du classeur dans les champs UTC.
  const jour = `${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return h || m ? `${jour} ${deux(h)}:${deux(m)}` : jour;
}

function texteCellule(valeur: ExcelJS.CellValue, compteur: { formulesSansValeur: number }): string {
  if (valeur === null || valeur === undefined) return "";
  if (valeur instanceof Date) return texteDate(valeur);
  if (typeof valeur === "number") return String(valeur);
  if (typeof valeur === "string") return valeur;
  if (typeof valeur === "boolean") return valeur ? "VRAI" : "FAUX";
  if (typeof valeur === "object") {
    if ("formula" in valeur || "sharedFormula" in valeur) {
      const resultat = (valeur as { result?: ExcelJS.CellValue }).result;
      if (resultat === undefined || resultat === null) {
        compteur.formulesSansValeur++;
        return "";
      }
      if (typeof resultat === "object" && !(resultat instanceof Date) && "error" in resultat) {
        return String((resultat as { error: string }).error);
      }
      return texteCellule(resultat, compteur);
    }
    if ("richText" in valeur) return valeur.richText.map((r) => r.text).join("");
    if ("text" in valeur) return String((valeur as { text: unknown }).text ?? "");
    if ("error" in valeur) return String(valeur.error);
  }
  return String(valeur);
}

export async function lireClasseur(octets: Uint8Array): Promise<Feuille[]> {
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(octets as unknown as ArrayBuffer);
  } catch {
    throw new ErreurImport("excel_illisible");
  }

  return classeur.worksheets
    .filter((f) => f.state !== "veryHidden")
    .map((feuille) => {
      const compteur = { formulesSansValeur: 0 };
      const lignes: string[][] = [];
      const largeur = feuille.columnCount;
      feuille.eachRow({ includeEmpty: false }, (ligne) => {
        const cellules: string[] = [];
        for (let c = 1; c <= largeur; c++) {
          const cellule = ligne.getCell(c);
          // Cellule fusionnée : on reprend la valeur de la cellule principale.
          const source = cellule.isMerged && cellule.master ? cellule.master : cellule;
          cellules.push(texteCellule(source.value, compteur).trim());
        }
        while (cellules.length && cellules[cellules.length - 1] === "") cellules.pop();
        if (cellules.length) lignes.push(cellules);
      });
      const fusions = (feuille as unknown as { _merges?: Record<string, unknown> })._merges ?? {};
      return {
        nom: feuille.name,
        lignes,
        zonesFusionnees: Object.keys(fusions).length,
        formulesSansValeur: compteur.formulesSansValeur,
      };
    });
}
