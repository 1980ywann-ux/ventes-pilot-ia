// Identification du format d'après le contenu réel du fichier, pas seulement
// son extension : un fichier renommé ne passe pas.
import JSZip from "jszip";
import { ErreurImport, LIMITES } from "./erreurs";

export type Format = "csv" | "xlsx";

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0]; // ancien format Excel .xls

function commencePar(octets: Uint8Array, signature: number[]) {
  return signature.every((b, i) => octets[i] === b);
}

function extension(nom: string) {
  const i = nom.lastIndexOf(".");
  return i < 0 ? "" : nom.slice(i + 1).toLowerCase();
}

export function identifierFormat(nom: string, octets: Uint8Array): Format {
  if (octets.length === 0) throw new ErreurImport("fichier_vide");
  if (octets.length > LIMITES.octets) throw new ErreurImport("fichier_trop_gros");
  const ext = extension(nom);

  if (["xlsm", "xltm", "xlam"].includes(ext)) throw new ErreurImport("macros_refusees");
  if (ext === "xls" || commencePar(octets, OLE)) throw new ErreurImport("format_xls");
  if (ext === "xlsx") {
    if (!commencePar(octets, ZIP)) throw new ErreurImport("excel_illisible");
    return "xlsx";
  }
  if (ext === "csv" || ext === "txt") {
    if (commencePar(octets, ZIP)) throw new ErreurImport("format_refuse");
    return "csv";
  }
  throw new ErreurImport("format_refuse");
}

/**
 * Inspecte l'archive d'un classeur avant de le lire : refuse les macros et
 * les archives qui gonflent démesurément une fois décompressées.
 */
export async function verifierArchiveExcel(
  octets: Uint8Array,
  limites = { octetsDecompresses: LIMITES.octetsDecompresses, rapportCompression: LIMITES.rapportCompression },
) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(octets, { checkCRC32: false });
  } catch {
    throw new ErreurImport("excel_illisible");
  }
  const entrees = Object.values(zip.files);
  if (!entrees.some((e) => e.name === "xl/workbook.xml")) throw new ErreurImport("excel_illisible");
  if (entrees.some((e) => /vbaProject\.bin$/i.test(e.name))) throw new ErreurImport("macros_refusees");

  let total = 0;
  for (const e of entrees) {
    // Tailles déclarées dans l'annuaire de l'archive, lues sans décompresser.
    const donnees = (e as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })._data;
    const brut = donnees?.uncompressedSize ?? 0;
    const compresse = donnees?.compressedSize ?? 0;
    total += brut;
    if (compresse > 0 && brut / compresse > limites.rapportCompression && brut > 1024 * 1024) {
      throw new ErreurImport("archive_suspecte");
    }
  }
  if (total > limites.octetsDecompresses) throw new ErreurImport("archive_suspecte");
}
