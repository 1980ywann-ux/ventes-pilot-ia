// Crée une base de test neuve, y applique l'imitation de Supabase puis
// toutes les migrations, dans l'ordre de leur nom.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

export const URL_ADMIN =
  process.env.DATABASE_URL_ADMIN ?? "postgres://postgres:postgres@localhost:5432/postgres";
export const NOM_BASE = "ventes_pilot_ia_test";

export function urlBaseTest(): string {
  const url = new URL(URL_ADMIN);
  url.pathname = `/${NOM_BASE}`;
  return url.toString();
}

export default async function preparerBase() {
  const admin = new Client({ connectionString: URL_ADMIN });
  await admin.connect();
  await admin.query(`drop database if exists ${NOM_BASE} with (force)`);
  await admin.query(`create database ${NOM_BASE}`);
  await admin.end();

  const base = new Client({ connectionString: urlBaseTest() });
  await base.connect();
  const racine = path.resolve(__dirname, "../../supabase");
  await base.query(readFileSync(path.join(racine, "tests/supabase_stub.sql"), "utf8"));
  const migrations = readdirSync(path.join(racine, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const fichier of migrations) {
    try {
      await base.query(readFileSync(path.join(racine, "migrations", fichier), "utf8"));
    } catch (e) {
      throw new Error(`Échec de la migration ${fichier} : ${(e as Error).message}`);
    }
  }
  await base.end();
}
