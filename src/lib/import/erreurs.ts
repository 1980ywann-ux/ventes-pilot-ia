// Erreurs de lecture d'un fichier importé. Le code sert de clé de message
// (src/lib/messages.ts) : aucun texte venant du fichier n'est affiché tel quel.
export type CodeErreurImport =
  | "fichier_vide"
  | "fichier_trop_gros"
  | "format_refuse"
  | "format_xls"
  | "macros_refusees"
  | "archive_suspecte"
  | "excel_illisible"
  | "texte_illisible"
  | "aucune_donnee"
  | "trop_de_lignes"
  | "feuille_inconnue";

export class ErreurImport extends Error {
  constructor(public readonly code: CodeErreurImport) {
    super(code);
    this.name = "ErreurImport";
  }
}

export const LIMITES = {
  /** Taille maximale d'un fichier déposé (PRD H9). */
  octets: 20 * 1024 * 1024,
  /** Lignes de données maximales par fichier (PRD H9). */
  lignes: 200_000,
  /** Taille décompressée maximale d'un classeur Excel (protection « bombe zip »). */
  octetsDecompresses: 200 * 1024 * 1024,
  /** Rapport de compression maximal toléré pour un fichier du classeur. */
  rapportCompression: 200,
  /** Lignes montrées dans la prévisualisation (PRD écran E4). */
  apercu: 20,
} as const;
