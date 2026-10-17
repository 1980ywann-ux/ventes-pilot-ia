// FICHIERS FICTIFS générés pour les tests — aucune donnée réelle (PRD section 9).
import ExcelJS from "exceljs";
import JSZip from "jszip";

/** Exemple de référence du PRD (section 9), en lignes de caisse. */
export const LIGNES_REFERENCE = [
  ["Date", "N° transaction", "Activité", "Quantité", "Prix unitaire", "Montant TTC"],
  ["05/01/2026", "T001", "Activité A – Paddle", "2", "15,00", "30,00"],
  ["06/01/2026", "T002", "Activité B – Accrobranche été", "1", "12,00", "12,00"],
  ["20/01/2026", "R001", "Activité A – Paddle", "1", "15,00", "-15,00"],
];

// Table Windows-1252 des caractères 0x80–0x9F (le reste coïncide avec Latin-1).
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
  "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

export function encoder(texte: string, encodage: "utf-8" | "utf-8-bom" | "windows-1252" | "utf-16le"): Uint8Array {
  if (encodage === "utf-8") return new TextEncoder().encode(texte);
  if (encodage === "utf-8-bom") return new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texte)]);
  if (encodage === "utf-16le") {
    const octets = new Uint8Array(2 + texte.length * 2);
    octets.set([0xff, 0xfe]);
    for (let i = 0; i < texte.length; i++) {
      const c = texte.charCodeAt(i);
      octets[2 + i * 2] = c & 0xff;
      octets[3 + i * 2] = c >> 8;
    }
    return octets;
  }
  return Uint8Array.from([...texte].map((ch) => {
    if (ch in CP1252) return CP1252[ch];
    const c = ch.charCodeAt(0);
    if (c > 0xff) throw new Error(`caractère hors Windows-1252 : ${ch}`);
    return c;
  }));
}

export function versCsv(lignes: string[][], sep: string, fin = "\r\n"): string {
  const echapper = (v: string) => (v.includes(sep) || v.includes('"') || /[\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  return lignes.map((l) => l.map(echapper).join(sep)).join(fin) + fin;
}

export async function classeurFictif(construire: (c: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const classeur = new ExcelJS.Workbook();
  construire(classeur);
  return new Uint8Array(await classeur.xlsx.writeBuffer());
}

/** Classeur piégé : feuille vide en premier, dates en numéro de série, fusions, formules. */
export function classeurComplet() {
  return classeurFictif((c) => {
    c.addWorksheet("Notes");
    const f = c.addWorksheet("Ventes janvier");
    f.addRow(["Date", "N° transaction", "Activité", "Quantité", "Prix unitaire", "Montant TTC"]);
    f.addRow([new Date(Date.UTC(2026, 0, 5)), "T001", "Activité A – Paddle", 2, 15, { formula: "D2*E2", result: 30 }]);
    f.addRow([new Date(Date.UTC(2026, 0, 6, 14, 30)), "T002", "Activité B", 1, 12, { formula: "D3*E3", result: 12 }]);
    f.addRow([new Date(Date.UTC(2026, 0, 20)), "R001", "Activité A – Paddle", 1, 15, { formula: "-D4*E4" }]);
    f.addRow(["", "Total", "", "", "", ""]);
    f.mergeCells("C5:E5");
    c.addWorksheet("Février").addRow(["Date", "Montant"]);
  });
}

/** Archive qui se fait passer pour un classeur mais contient des macros. */
export async function classeurAvecMacros(): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await classeurComplet());
  zip.file("xl/vbaProject.bin", "macro fictive");
  return zip.generateAsync({ type: "uint8array" });
}

/** Archive très compressible : quelques Ko qui en deviennent des dizaines de Mo. */
export async function classeurBombe(): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await classeurComplet());
  zip.file("xl/media/remplissage.bin", "0".repeat(30 * 1024 * 1024));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
}
