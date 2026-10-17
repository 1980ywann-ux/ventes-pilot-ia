// Scénario de bout en bout : vrai navigateur, vraie authentification Supabase.
// Prérequis : `npx supabase start` puis `npm run dev` (voir README).
// Lancement : npm run test:e2e
// Comptes et entreprises : tous fictifs, créés à chaque exécution.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Clé publique du Supabase local (identique sur toutes les machines).
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const NAVIGATEUR = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOTS = new URL("./captures/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const MDP = "MotDePasse2026";
const suffixe = Date.now();

const navigateur = await chromium.launch({ executablePath: NAVIGATEUR });
const etapes = [];
const ok = (t) => { etapes.push(`OK  ${t}`); console.log(`OK  ${t}`); };
const verifier = (cond, t) => { if (!cond) throw new Error(`ÉCHEC : ${t}`); ok(t); };

async function lienConfirmation(email) {
  for (let i = 0; i < 30; i++) {
    const liste = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    if (liste.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${liste.messages[0].ID}`)).json();
      const m = msg.HTML.match(/href="([^"]+)"/);
      return m[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`pas d'e-mail pour ${email}`);
}

async function inscrire(email, largeur = 1280) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  await page.goto(`${APP}/entreprises`);
  verifier(page.url().endsWith("/connexion"), `${email} : page privée redirigée vers /connexion`);
  const form = page.locator("form").nth(1);
  await form.getByLabel("Adresse e-mail").filter({ visible: true }).fill(email);
  await form.getByLabel(/Mot de passe/).filter({ visible: true }).fill(MDP);
  await form.getByRole("button", { name: "Créer mon compte" }).filter({ visible: true }).click();
  await page.getByText("Compte créé").filter({ visible: true }).waitFor();
  ok(`${email} : inscription, message de confirmation affiché`);

  // Sans confirmation, la connexion est refusée.
  const f1 = page.locator("form").nth(0);
  await f1.getByLabel("Adresse e-mail").filter({ visible: true }).fill(email);
  await f1.getByLabel("Mot de passe").filter({ visible: true }).fill(MDP);
  await f1.getByRole("button", { name: "Se connecter" }).filter({ visible: true }).click();
  await page.getByText("Confirmez d'abord votre adresse").filter({ visible: true }).waitFor();
  ok(`${email} : connexion refusée tant que l'adresse n'est pas confirmée`);

  await page.goto(await lienConfirmation(email));
  await page.waitForURL(/\/entreprises$/);
  ok(`${email} : lien de confirmation → connecté sur /entreprises`);
  return { ctx, page };
}

try {
  const alice = `alice.${suffixe}@entreprise-a.fictif.test`;
  const arthur = `arthur.${suffixe}@entreprise-a.fictif.test`;
  const bea = `bea.${suffixe}@entreprise-b.fictif.test`;

  // --- Alice crée l'entreprise A
  const A = await inscrire(alice);
  await A.page.screenshot({ path: `${SHOTS}1-entreprises-vide.png`, fullPage: true });
  await A.page.getByLabel("Nom de l'entreprise").filter({ visible: true }).fill("Base de loisirs Fictive A");
  await A.page.getByRole("button", { name: "Créer" }).filter({ visible: true }).click();
  await A.page.waitForURL(/\/e\/[0-9a-f-]{36}$/);
  const urlA = A.page.url();
  await A.page.getByRole("heading", { name: "Tableau de bord" }).filter({ visible: true }).waitFor();
  await A.page.screenshot({ path: `${SHOTS}1b-tableau-de-bord.png`, fullPage: true });
  await A.page.getByText(/· Administrateur/).filter({ visible: true }).waitFor();
  verifier(!(await A.page.getByText("Créer une entreprise").isVisible()), "Le tableau de bord remplace bien la page précédente");
  ok("Alice est administratrice de A");

  await A.page.getByRole("link", { name: "Sources", exact: true }).filter({ visible: true }).click();
  await A.page.getByLabel("Nom").filter({ visible: true }).fill("Caisse");
  await A.page.getByLabel("Priorité (1 = la plus fiable)").filter({ visible: true }).fill("1");
  await A.page.getByRole("button", { name: "Ajouter" }).filter({ visible: true }).click();
  await A.page.getByText("montants TTC · priorité 1").filter({ visible: true }).waitFor();
  ok("Alice ajoute la source Caisse (TTC, priorité 1)");
  await A.page.getByLabel("Nom").filter({ visible: true }).fill("Caisse");
  await A.page.getByRole("button", { name: "Ajouter" }).filter({ visible: true }).click();
  await A.page.getByText("Une source porte déjà ce nom.").filter({ visible: true }).waitFor();
  ok("Doublon de nom de source refusé avec un message clair");

  // --- Étape 2 : import de fichiers (fichiers fictifs générés ici)
  const dossier = path.join(tmpdir(), `vpi-${suffixe}`);
  mkdirSync(dossier, { recursive: true });
  const csv = path.join(dossier, "caisse-janvier.csv");
  // Export de caisse typique : Windows-1252, point-virgule, virgule décimale.
  const texteCsv = "Date;N° transaction;Activité;Quantité;Montant TTC\r\n05/01/2026;T001;Paddle été;2;30,00\r\n06/01/2026;T002;Accrobranche – nuit;1;12,00\r\n20/01/2026;R001;Paddle été;1;-15,00\r\n";
  writeFileSync(csv, Buffer.from([...texteCsv].map((c) => (c === "–" ? 0x96 : c.charCodeAt(0)))));
  const xls = path.join(dossier, "ancien.xls");
  writeFileSync(xls, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const xlsx = path.join(dossier, "reservations.xlsx");
  const classeur = new ExcelJS.Workbook();
  classeur.addWorksheet("Notes");
  const feuille = classeur.addWorksheet("Réservations");
  feuille.addRow(["Date", "Référence", "Montant"]);
  feuille.addRow([new Date(Date.UTC(2026, 0, 5)), "T001", 30]);
  await classeur.xlsx.writeFile(xlsx);

  const deposer = async (fichier) => {
    await A.page.goto(`${urlA}/imports/nouveau`);
    await A.page.getByLabel("Source du fichier").selectOption({ label: "Caisse (montants TTC)" });
    await A.page.locator('input[type="file"]').setInputFiles(fichier);
    await A.page.getByRole("button", { name: "Déposer et prévisualiser" }).click();
  };

  await deposer(csv);
  await A.page.waitForURL(/\/imports\/[0-9a-f-]{36}$/);
  const urlImport = A.page.url();
  await A.page.getByText("Accrobranche – nuit").filter({ visible: true }).waitFor();
  verifier(await A.page.getByLabel("Encodage").inputValue() === "windows-1252", "CSV Windows-1252 : encodage détecté");
  verifier(await A.page.getByLabel("Séparateur").inputValue() === ";", "CSV : séparateur point-virgule détecté");
  await A.page.getByText("3 lignes de données, 5 colonnes.").filter({ visible: true }).waitFor();
  ok("Aperçu : « é », « – », 3 lignes et 5 colonnes lues correctement");
  await A.page.screenshot({ path: `${SHOTS}6-apercu-csv.png`, fullPage: true });

  await A.page.getByLabel("Séparateur").selectOption(",");
  await A.page.getByRole("button", { name: "Actualiser l'aperçu" }).click();
  await A.page.getByText(/pas le même nombre de colonnes|1 colonne/).filter({ visible: true }).first().waitFor();
  ok("Mauvais séparateur choisi : l'aperçu le montre aussitôt");
  await A.page.getByLabel("Séparateur").selectOption(";");
  await A.page.getByRole("button", { name: "Actualiser l'aperçu" }).click();
  await A.page.getByText("3 lignes de données, 5 colonnes.").filter({ visible: true }).waitFor();
  await A.page.getByRole("button", { name: /valider ces paramètres/ }).click();
  await A.page.getByText("Paramètres de lecture enregistrés").filter({ visible: true }).waitFor();
  ok("Paramètres de lecture validés");

  await deposer(csv);
  await A.page.getByText("Ce fichier a déjà été importé").filter({ visible: true }).waitFor();
  verifier(A.page.url().startsWith(urlImport), "Même fichier redéposé : détecté, renvoi vers l'import existant");

  await deposer(xls);
  await A.page.getByText("L'ancien format Excel (.xls)").filter({ visible: true }).waitFor();
  ok("Ancien format .xls refusé avec la marche à suivre");

  await deposer(xlsx);
  await A.page.waitForURL(/\/imports\/[0-9a-f-]{36}$/);
  verifier(await A.page.getByLabel("Feuille").inputValue() === "Réservations", "Excel : la feuille avec des données est choisie");
  await A.page.getByRole("cell", { name: "05/01/2026" }).filter({ visible: true }).waitFor();
  ok("Excel : date en numéro de série affichée jj/mm/aaaa");

  const urlXlsx = A.page.url();
  await A.page.getByText("Supprimer cet import…").filter({ visible: true }).click();
  await A.page.getByRole("button", { name: "Confirmer la suppression" }).filter({ visible: true }).click();
  await A.page.getByText("Import supprimé.").filter({ visible: true }).waitFor();
  verifier(!(await A.page.getByText("reservations.xlsx").filter({ visible: true }).count()), "Suppression d'un import, après confirmation");
  await deposer(xlsx);
  await A.page.waitForURL(/\/imports\/[0-9a-f-]{36}$/);
  verifier(A.page.url() !== urlXlsx, "Fichier supprimé puis redéposé : accepté comme nouvel import");

  await A.page.goto(`${urlA}/imports`);
  await A.page.getByText("Lecture validée").filter({ visible: true }).waitFor();
  await A.page.screenshot({ path: `${SHOTS}7-liste-imports.png`, fullPage: true });
  ok("Liste des imports : 2 fichiers, statuts affichés");
  await A.page.screenshot({ path: `${SHOTS}2-sources.png`, fullPage: true });

  await A.page.getByRole("link", { name: "Équipe", exact: true }).filter({ visible: true }).click();
  await A.page.getByLabel("Adresse e-mail").filter({ visible: true }).fill(arthur);
  await A.page.getByRole("button", { name: "Inviter" }).filter({ visible: true }).click();
  await A.page.getByText("Invitation enregistrée").filter({ visible: true }).waitFor();
  ok("Alice invite Arthur comme lecteur");
  await A.page.locator("li", { hasText: "(vous)" }).getByRole("button", { name: "Retirer" }).filter({ visible: true }).click();
  await A.page.getByText("au moins un administrateur").filter({ visible: true }).waitFor();
  ok("Alice ne peut pas se retirer : dernière administratrice");
  await A.page.screenshot({ path: `${SHOTS}3-equipe.png`, fullPage: true });

  // --- Arthur rejoint A comme lecteur (sur mobile)
  const R = await inscrire(arthur, 390);
  await R.page.getByText("Base de loisirs Fictive A").filter({ visible: true }).waitFor();
  verifier(await R.page.locator("li", { hasText: "Base de loisirs Fictive A" }).getByText("Lecteur").isVisible(), "Arthur rejoint A automatiquement, en lecteur");
  await R.page.goto(`${urlA}/sources`);
  await R.page.getByText("Caisse").first().waitFor();
  verifier((await R.page.getByRole("button", { name: "Ajouter" }).filter({ visible: true }).count()) === 0, "Arthur voit les sources mais sans formulaire d'ajout");
  verifier((await R.page.getByRole("button", { name: "Supprimer" }).filter({ visible: true }).count()) === 0, "Arthur n'a pas de bouton Supprimer");
  await R.page.goto(urlImport);
  await R.page.getByText("Accrobranche – nuit").filter({ visible: true }).waitFor();
  verifier((await R.page.getByRole("button", { name: /valider|Supprimer/ }).filter({ visible: true }).count()) === 0,
    "Arthur voit l'aperçu d'un import, sans pouvoir le valider ni le supprimer");
  await R.page.goto(`${urlA}/imports/nouveau`);
  await R.page.getByText(/could not be found|introuvable/i).filter({ visible: true }).waitFor();
  ok("Arthur n'a pas accès au dépôt de fichier");
  await R.page.screenshot({ path: `${SHOTS}4-lecteur-mobile.png`, fullPage: true });

  // --- Béa, entreprise B, tente d'ouvrir A
  const B = await inscrire(bea);
  await B.page.getByLabel("Nom de l'entreprise").filter({ visible: true }).fill("Parc Fictif B");
  await B.page.getByRole("button", { name: "Créer" }).filter({ visible: true }).click();
  await B.page.waitForURL(/\/e\/[0-9a-f-]{36}$/);
  verifier(!(await B.page.getByText("Base de loisirs Fictive A").filter({ visible: true }).count()), "Béa ne voit pas A dans son espace");
  for (const chemin of ["", "/sources", "/equipe", "/imports", `/imports/${urlImport.split("/").pop()}`]) {
    await B.page.goto(`${urlA}${chemin}`);
    await B.page.getByText(/could not be found|introuvable/i).filter({ visible: true }).waitFor();
    verifier(!(await B.page.getByText("Caisse").filter({ visible: true }).count()) && !(await B.page.getByText(alice).filter({ visible: true }).count()),
      `Béa sur ${chemin || "/"} de A : page introuvable, aucune donnée de A`);
  }
  await B.page.goto(`${APP}/e/00000000-0000-4000-8000-000000000000`);
  await B.page.getByText(/could not be found|introuvable/i).filter({ visible: true }).waitFor();
  ok("Entreprise inexistante : même page introuvable (existence non révélée)");
  await B.page.screenshot({ path: `${SHOTS}5-acces-refuse.png`, fullPage: true });

  // Béa appelle directement l'API Supabase avec sa session.
  const session = await (await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CLE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: bea, password: MDP }),
  })).json();
  const orgA = urlA.split("/").pop();
  const api = (chemin, opts = {}) => fetch(`${SUPABASE}/rest/v1/${chemin}`, {
    ...opts,
    headers: { apikey: CLE, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers ?? {}) },
  });
  for (const t of ["organisations", "sources", "adhesions", "profils", "invitations", "journal_audit", "imports"]) {
    const r = await (await api(`${t}?select=*`)).json();
    const fuite = JSON.stringify(r).includes(orgA) || JSON.stringify(r).includes(alice);
    verifier(!fuite, `API directe, table ${t} : rien de A`);
  }
  const ins = await api("sources", { method: "POST", body: JSON.stringify({ organisation_id: orgA, nom: "Pirate", base_montant: "HT" }) });
  verifier(ins.status === 403, `API directe : insertion dans A refusée (HTTP ${ins.status})`);
  const anon = await fetch(`${SUPABASE}/rest/v1/organisations?select=*`, { headers: { apikey: CLE } });
  verifier(anon.status === 401 || anon.status === 403, `API sans connexion refusée (HTTP ${anon.status})`);

  // Fichiers : Béa tente de lister, télécharger et déposer dans le dossier de A.
  const stockage = (chemin, opts = {}) => fetch(`${SUPABASE}/storage/v1/${chemin}`, {
    ...opts,
    headers: { apikey: CLE, Authorization: `Bearer ${session.access_token}`, ...(opts.headers ?? {}) },
  });
  const liste = await (await stockage("object/list/imports", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: orgA }),
  })).json();
  verifier(Array.isArray(liste) && liste.length === 0, "Stockage : Béa ne voit aucun fichier de A");
  const idImport = urlImport.split("/").pop();
  const empreinte = createHash("sha256").update(readFileSync(csv)).digest("hex");
  const telechargement = await stockage(`object/imports/${orgA}/${idImport}/${empreinte}.csv`);
  const sessionAlice = await (await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: CLE, "Content-Type": "application/json" }, body: JSON.stringify({ email: alice, password: MDP }),
  })).json();
  const parAlice = await fetch(`${SUPABASE}/storage/v1/object/imports/${orgA}/${idImport}/${empreinte}.csv`, {
    headers: { apikey: CLE, Authorization: `Bearer ${sessionAlice.access_token}` },
  });
  verifier(parAlice.status === 200 && Buffer.from(await parAlice.arrayBuffer()).equals(readFileSync(csv)),
    "Stockage : Alice télécharge ce même fichier, identique à l'original (le chemin testé est le bon)");
  verifier(telechargement.status >= 400, `Stockage : téléchargement d'un fichier de A refusé (HTTP ${telechargement.status})`);
  const depot = await stockage(`object/imports/${orgA}/pirate/x.csv`, { method: "POST", headers: { "Content-Type": "text/csv" }, body: "a;b\n1;2\n" });
  verifier(depot.status >= 400, `Stockage : dépôt dans le dossier de A refusé (HTTP ${depot.status})`);

  console.log(`\n${etapes.length} vérifications réussies`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await navigateur.close();
}
