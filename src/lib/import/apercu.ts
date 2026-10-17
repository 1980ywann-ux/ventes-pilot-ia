// Prévisualisation d'un fichier importé (PRD parcours P1, écran E4) :
// paramètres de lecture détectés, en-têtes, premières lignes, avertissements.
import { ErreurImport, LIMITES } from "./erreurs";
import { lireClasseur } from "./excel";
import { identifierFormat, verifierArchiveExcel, type Format } from "./format";
import { decoder, decouperCsv, detecterEncodage, detecterSeparateur, type Encodage, type Separateur } from "./texte";

export type OptionsLecture = { encodage?: Encodage; separateur?: Separateur; feuille?: string };

export type Avertissement =
  | { code: "entetes_dupliques"; colonnes: string[] }
  | { code: "entetes_vides"; nombre: number }
  | { code: "colonnes_irregulieres"; lignes: number }
  | { code: "zones_fusionnees"; nombre: number }
  | { code: "formules_sans_valeur"; nombre: number }
  | { code: "caracteres_suspects" };

export type Apercu = {
  format: Format;
  encodage?: Encodage;
  separateur?: Separateur;
  feuilles?: string[];
  feuille?: string;
  entetes: string[];
  lignes: string[][];
  nombreLignes: number;
  avertissements: Avertissement[];
};

function analyserTableau(brut: string[][]): Pick<Apercu, "entetes" | "lignes" | "nombreLignes" | "avertissements"> {
  if (brut.length < 2) throw new ErreurImport("aucune_donnee");
  const donnees = brut.slice(1);
  if (donnees.length > LIMITES.lignes) throw new ErreurImport("trop_de_lignes");

  const avertissements: Avertissement[] = [];
  const largeur = Math.max(...brut.slice(0, 1000).map((l) => l.length));

  // En-têtes : on complète les vides par « Colonne N » et on signale les doublons.
  let vides = 0;
  const entetes = Array.from({ length: largeur }, (_, i) => {
    const e = (brut[0][i] ?? "").trim();
    if (!e) {
      vides++;
      return `Colonne ${i + 1}`;
    }
    return e;
  });
  if (vides) avertissements.push({ code: "entetes_vides", nombre: vides });
  const vus = new Map<string, number>();
  for (const e of entetes) vus.set(e.toLowerCase(), (vus.get(e.toLowerCase()) ?? 0) + 1);
  const dupliques = entetes.filter((e, i) => vus.get(e.toLowerCase())! > 1 && entetes.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);
  if (dupliques.length) avertissements.push({ code: "entetes_dupliques", colonnes: dupliques });

  const irregulieres = donnees.filter((l) => l.length !== brut[0].length).length;
  if (irregulieres) avertissements.push({ code: "colonnes_irregulieres", lignes: irregulieres });

  const lignes = donnees.slice(0, LIMITES.apercu).map((l) => Array.from({ length: largeur }, (_, i) => l[i] ?? ""));
  return { entetes, lignes, nombreLignes: donnees.length, avertissements };
}

export async function construireApercu(nom: string, octets: Uint8Array, options: OptionsLecture = {}): Promise<Apercu> {
  const format = identifierFormat(nom, octets);

  if (format === "csv") {
    const encodage = options.encodage ?? detecterEncodage(octets);
    const texte = decoder(octets, encodage);
    const separateur = options.separateur ?? detecterSeparateur(texte);
    const resultat = analyserTableau(decouperCsv(texte, separateur, LIMITES.lignes + 2));
    // « Ã© » à la place de « é » : signe d'un encodage mal choisi.
    if (/Ã[\u0080-¿]|â‚¬/.test(texte.slice(0, 200_000))) {
      resultat.avertissements.push({ code: "caracteres_suspects" });
    }
    return { format, encodage, separateur, ...resultat };
  }

  await verifierArchiveExcel(octets);
  const feuilles = await lireClasseur(octets);
  if (feuilles.length === 0) throw new ErreurImport("aucune_donnee");
  let feuille = feuilles[0];
  if (options.feuille !== undefined) {
    const choisie = feuilles.find((f) => f.nom === options.feuille);
    if (!choisie) throw new ErreurImport("feuille_inconnue");
    feuille = choisie;
  } else {
    // Par défaut, la première feuille qui contient des données.
    feuille = feuilles.find((f) => f.lignes.length >= 2) ?? feuilles[0];
  }
  const resultat = analyserTableau(feuille.lignes);
  if (feuille.zonesFusionnees) resultat.avertissements.push({ code: "zones_fusionnees", nombre: feuille.zonesFusionnees });
  if (feuille.formulesSansValeur) resultat.avertissements.push({ code: "formules_sans_valeur", nombre: feuille.formulesSansValeur });
  return { format, feuilles: feuilles.map((f) => f.nom), feuille: feuille.nom, ...resultat };
}
