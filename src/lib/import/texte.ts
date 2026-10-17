// Lecture des fichiers texte (CSV) : encodage, séparateur, découpage.
import { ErreurImport } from "./erreurs";

export type Encodage = "utf-8" | "windows-1252" | "utf-16le" | "utf-16be";
export const ENCODAGES: Encodage[] = ["utf-8", "windows-1252", "utf-16le", "utf-16be"];

export type Separateur = ";" | "," | "\t" | "|";
export const SEPARATEURS: Separateur[] = [";", ",", "\t", "|"];

/**
 * Devine l'encodage : marque d'ordre des octets (BOM) si présente, sinon
 * UTF-8 si le contenu est de l'UTF-8 valide, sinon Windows-1252 (exports
 * Excel et caisses sous Windows).
 */
export function detecterEncodage(octets: Uint8Array): Encodage {
  if (octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) return "utf-8";
  if (octets[0] === 0xff && octets[1] === 0xfe) return "utf-16le";
  if (octets[0] === 0xfe && octets[1] === 0xff) return "utf-16be";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(octets);
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

// Caractères 0x80–0x9F de Windows-1252 (le reste coïncide avec Latin-1).
// Décodés à la main : le TextDecoder de Node les confond avec Latin-1 et
// perdrait par exemple le symbole « € ». 0xFFFD = octet non défini.
const CP1252_80_9F = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

function decoderWindows1252(octets: Uint8Array): string {
  const morceaux: string[] = [];
  const TAILLE = 32 * 1024;
  for (let debut = 0; debut < octets.length; debut += TAILLE) {
    const bloc = octets.subarray(debut, debut + TAILLE);
    const codes = new Array<number>(bloc.length);
    for (let i = 0; i < bloc.length; i++) {
      const b = bloc[i];
      codes[i] = b >= 0x80 && b <= 0x9f ? CP1252_80_9F[b - 0x80] : b;
    }
    morceaux.push(String.fromCharCode(...codes));
  }
  return morceaux.join("");
}

export function decoder(octets: Uint8Array, encodage: Encodage): string {
  // TextDecoder retire lui-même la marque d'ordre des octets.
  const texte = encodage === "windows-1252" ? decoderWindows1252(octets) : new TextDecoder(encodage).decode(octets);
  // Un octet nul dans du texte décodé signale un fichier binaire ou un mauvais encodage.
  if (texte.includes("\u0000")) throw new ErreurImport("texte_illisible");
  return texte;
}

/**
 * Découpe un CSV (RFC 4180) : champs entre guillemets, guillemets doublés,
 * retours à la ligne dans les cellules, fins de ligne \n, \r\n ou \r.
 * Les lignes entièrement vides sont ignorées.
 */
export function decouperCsv(texte: string, sep: Separateur, maxEnregistrements = Infinity): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  let i = 0;
  const n = texte.length;

  const finirLigne = () => {
    ligne.push(champ);
    champ = "";
    if (!(ligne.length === 1 && ligne[0] === "")) lignes.push(ligne);
    ligne = [];
  };

  while (i < n && lignes.length < maxEnregistrements) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i += 2;
          continue;
        }
        entreGuillemets = false;
      } else {
        champ += c;
      }
      i++;
      continue;
    }
    if (c === '"' && champ === "") {
      entreGuillemets = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      finirLigne();
      if (c === "\r" && texte[i + 1] === "\n") i++;
    } else {
      champ += c;
    }
    i++;
  }
  if (lignes.length < maxEnregistrements && (champ !== "" || ligne.length > 0)) finirLigne();
  return lignes;
}

/**
 * Devine le séparateur sur les premières lignes : celui qui donne le plus
 * souvent le même nombre de colonnes (au moins 2), puis le plus de colonnes.
 */
export function detecterSeparateur(texte: string): Separateur {
  const debut = texte.slice(0, 64 * 1024);
  let meilleur: { sep: Separateur; score: number; colonnes: number } = { sep: ";", score: -1, colonnes: 0 };

  for (const sep of SEPARATEURS) {
    const lignes = decouperCsv(debut, sep, 50);
    if (lignes.length === 0) continue;
    // On ignore la dernière ligne, peut-être coupée par l'extrait.
    const echantillon = lignes.length > 1 ? lignes.slice(0, -1) : lignes;
    const effectifs = new Map<number, number>();
    for (const l of echantillon) effectifs.set(l.length, (effectifs.get(l.length) ?? 0) + 1);
    const [colonnes, frequence] = [...effectifs.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (colonnes < 2) continue;
    const score = frequence / echantillon.length;
    if (score > meilleur.score || (score === meilleur.score && colonnes > meilleur.colonnes)) {
      meilleur = { sep, score, colonnes };
    }
  }
  return meilleur.sep;
}
