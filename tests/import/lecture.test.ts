// Étape 2 du PRD — critère de validation : « jeux de test d'encodage et de
// séparateurs réussis ». Liste des cas : PRD section 9, « Tests d'import ».
import { describe, expect, it } from "vitest";
import { construireApercu } from "@/lib/import/apercu";
import { ErreurImport } from "@/lib/import/erreurs";
import { verifierArchiveExcel } from "@/lib/import/format";
import { decouperCsv, detecterEncodage, detecterSeparateur } from "@/lib/import/texte";
import {
  LIGNES_REFERENCE, classeurAvecMacros, classeurBombe, classeurComplet, classeurFictif, encoder, versCsv,
} from "./fichiers-fictifs";

async function codeErreur(promesse: Promise<unknown>) {
  try {
    await promesse;
    return null;
  } catch (e) {
    if (e instanceof ErreurImport) return e.code;
    throw e;
  }
}

describe("CSV : séparateurs × encodages", () => {
  const separateurs = [";", ",", "\t"] as const;
  const encodages = ["utf-8", "utf-8-bom", "windows-1252", "utf-16le"] as const;

  for (const sep of separateurs) {
    for (const enc of encodages) {
      it(`séparateur ${JSON.stringify(sep)}, encodage ${enc} : détectés et lus à l'identique`, async () => {
        const octets = encoder(versCsv(LIGNES_REFERENCE, sep), enc);
        const apercu = await construireApercu("ventes.csv", octets);
        expect(apercu.separateur).toBe(sep);
        expect(apercu.encodage).toBe(enc === "utf-8-bom" ? "utf-8" : enc);
        expect(apercu.entetes).toEqual(LIGNES_REFERENCE[0]);
        expect(apercu.lignes).toEqual(LIGNES_REFERENCE.slice(1));
        expect(apercu.nombreLignes).toBe(3);
        expect(apercu.avertissements).toEqual([]);
      });
    }
  }

  it("Windows-1252 : « é », « € » et le tiret long sont bien restitués", async () => {
    const octets = encoder("Activité;Prix\nAccrobranche été;12 €\nTyrolienne – nuit;8 €\n", "windows-1252");
    const apercu = await construireApercu("caisse.csv", octets);
    expect(apercu.encodage).toBe("windows-1252");
    expect(apercu.lignes).toEqual([["Accrobranche été", "12 €"], ["Tyrolienne – nuit", "8 €"]]);
  });

  it("encodage forcé à tort : l'aperçu signale des caractères suspects", async () => {
    const octets = encoder("Activité;Prix\nAccrobranche été;12\n", "utf-8");
    const apercu = await construireApercu("caisse.csv", octets, { encodage: "windows-1252" });
    expect(apercu.lignes[0][0]).toBe("Accrobranche Ã©tÃ©");
    expect(apercu.avertissements).toContainEqual({ code: "caracteres_suspects" });
  });

  it("séparateur forcé par l'utilisateur : prioritaire sur la détection", async () => {
    const octets = encoder("a;b\n1;2\n", "utf-8");
    const apercu = await construireApercu("x.csv", octets, { separateur: "," });
    expect(apercu.separateur).toBe(",");
    expect(apercu.entetes).toEqual(["a;b"]);
  });
});

describe("CSV : contenu des cellules", () => {
  it("guillemets, guillemets doublés et retours à la ligne dans une cellule", async () => {
    const lignes = [
      ["Activité", "Commentaire", "Montant"],
      ["Paddle", 'Client a dit "super"', "30,00"],
      ["Kayak; double", "Ligne 1\nLigne 2", "12,00"],
    ];
    const apercu = await construireApercu("v.csv", encoder(versCsv(lignes, ";"), "utf-8"));
    expect(apercu.lignes).toEqual(lignes.slice(1));
    expect(apercu.nombreLignes).toBe(2);
  });

  it("virgule décimale avec séparateur point-virgule : pas de confusion", () => {
    expect(detecterSeparateur("Date;Montant;Quantité\n05/01;1 234,56;2\n06/01;12,50;1\n")).toBe(";");
  });

  it("nombres « 1 234,56 » et « 1,234.56 » conservés tels quels (interprétés à l'étape 3)", async () => {
    const apercu = await construireApercu("n.csv", encoder("A;B\n1 234,56;1,234.56\n", "utf-8"));
    expect(apercu.lignes[0]).toEqual(["1 234,56", "1,234.56"]);
  });

  it("fins de ligne \\n, \\r\\n et \\r, lignes vides ignorées", () => {
    expect(decouperCsv("a;b\r\n1;2\n\n3;4\r5;6", ";")).toEqual([["a", "b"], ["1", "2"], ["3", "4"], ["5", "6"]]);
  });

  it("dates ambiguës (03/04/2026) jamais réinterprétées à la lecture", async () => {
    const apercu = await construireApercu("d.csv", encoder("Date;Montant\n03/04/2026;10\n", "utf-8"));
    expect(apercu.lignes[0][0]).toBe("03/04/2026");
  });
});

describe("CSV : fichiers anormaux", () => {
  it("fichier vide refusé", async () => {
    expect(await codeErreur(construireApercu("v.csv", new Uint8Array()))).toBe("fichier_vide");
  });

  it("en-têtes seuls, sans donnée : refusé", async () => {
    expect(await codeErreur(construireApercu("v.csv", encoder("Date;Montant\n", "utf-8")))).toBe("aucune_donnee");
  });

  it("en-têtes dupliqués et vides signalés", async () => {
    const apercu = await construireApercu("v.csv", encoder("Date;Montant;montant;\n01/01;1;2;3\n", "utf-8"));
    expect(apercu.entetes).toEqual(["Date", "Montant", "montant", "Colonne 4"]);
    expect(apercu.avertissements).toContainEqual({ code: "entetes_dupliques", colonnes: ["Montant"] });
    expect(apercu.avertissements).toContainEqual({ code: "entetes_vides", nombre: 1 });
  });

  it("colonnes manquantes sur certaines lignes : signalé, lignes complétées", async () => {
    const apercu = await construireApercu("v.csv", encoder("A;B;C\n1;2;3\n4;5\n", "utf-8"));
    expect(apercu.lignes[1]).toEqual(["4", "5", ""]);
    expect(apercu.avertissements).toContainEqual({ code: "colonnes_irregulieres", lignes: 1 });
  });

  it("fichier trop gros refusé (> 20 Mo)", async () => {
    const octets = new Uint8Array(20 * 1024 * 1024 + 1).fill(0x41);
    expect(await codeErreur(construireApercu("g.csv", octets))).toBe("fichier_trop_gros");
  });

  it("plus de 200 000 lignes refusé", async () => {
    const texte = "A;B\n" + "1;2\n".repeat(200_001);
    expect(await codeErreur(construireApercu("g.csv", encoder(texte, "utf-8")))).toBe("trop_de_lignes");
  });

  it("fichier binaire déguisé en CSV refusé", async () => {
    const octets = Uint8Array.from([0x41, 0x3b, 0x42, 0x0a, 0x00, 0x01, 0x02, 0x0a]);
    expect(await codeErreur(construireApercu("b.csv", octets))).toBe("texte_illisible");
  });

  it("détection d'encodage : BOM UTF-16 reconnu", () => {
    expect(detecterEncodage(Uint8Array.from([0xff, 0xfe, 0x41, 0x00]))).toBe("utf-16le");
  });
});

describe("Formats refusés", () => {
  it.each([
    ["ventes.pdf", "format_refuse"],
    ["ventes.json", "format_refuse"],
    ["ventes.xlsm", "macros_refusees"],
    ["ventes.xls", "format_xls"],
  ])("%s → %s", async (nom, code) => {
    expect(await codeErreur(construireApercu(nom, encoder("A;B\n1;2\n", "utf-8")))).toBe(code);
  });

  it("ancien .xls renommé en .csv : reconnu à son contenu et refusé", async () => {
    const octets = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await codeErreur(construireApercu("ventes.csv", octets))).toBe("format_xls");
  });

  it("classeur renommé en .csv : refusé", async () => {
    expect(await codeErreur(construireApercu("ventes.csv", await classeurComplet()))).toBe("format_refuse");
  });

  it("faux .xlsx (du texte) : refusé", async () => {
    expect(await codeErreur(construireApercu("ventes.xlsx", encoder("A;B\n1;2\n", "utf-8")))).toBe("excel_illisible");
  });
});

describe("Excel", () => {
  it("multi-feuilles : la première feuille avec des données est choisie par défaut", async () => {
    const apercu = await construireApercu("ventes.xlsx", await classeurComplet());
    expect(apercu.feuilles).toEqual(["Notes", "Ventes janvier", "Février"]);
    expect(apercu.feuille).toBe("Ventes janvier");
  });

  it("dates en numéro de série → jj/mm/aaaa (heure conservée si présente)", async () => {
    const apercu = await construireApercu("ventes.xlsx", await classeurComplet());
    expect(apercu.lignes.map((l) => l[0])).toEqual(["05/01/2026", "06/01/2026 14:30", "20/01/2026", ""]);
  });

  it("formules : valeur calculée lue, jamais exécutée ; formule sans valeur signalée", async () => {
    const apercu = await construireApercu("ventes.xlsx", await classeurComplet());
    expect(apercu.lignes.map((l) => l[5])).toEqual(["30", "12", "", ""]);
    expect(apercu.avertissements).toContainEqual({ code: "formules_sans_valeur", nombre: 1 });
  });

  it("cellules fusionnées : valeur répétée et zone signalée", async () => {
    const apercu = await construireApercu("ventes.xlsx", await classeurComplet());
    expect(apercu.lignes[3].slice(1, 5)).toEqual(["Total", "", "", ""]);
    expect(apercu.avertissements).toContainEqual({ code: "zones_fusionnees", nombre: 1 });
  });

  it("feuille choisie par l'utilisateur ; feuille inconnue refusée", async () => {
    const octets = await classeurComplet();
    expect(await codeErreur(construireApercu("v.xlsx", octets, { feuille: "Février" }))).toBe("aucune_donnee");
    expect(await codeErreur(construireApercu("v.xlsx", octets, { feuille: "Inexistante" }))).toBe("feuille_inconnue");
  });

  it("classeur contenant des macros refusé, même nommé .xlsx", async () => {
    expect(await codeErreur(construireApercu("v.xlsx", await classeurAvecMacros()))).toBe("macros_refusees");
  });

  it("archive anormalement compressée refusée (bombe de décompression)", async () => {
    expect(await codeErreur(verifierArchiveExcel(await classeurBombe()))).toBe("archive_suspecte");
  });

  it("classeur vide refusé", async () => {
    const octets = await classeurFictif((c) => c.addWorksheet("Vide"));
    expect(await codeErreur(construireApercu("v.xlsx", octets))).toBe("aucune_donnee");
  });
});
