import { Pool, type PoolClient } from "pg";
import { urlBaseTest } from "./preparer-base";

let pool: Pool | undefined;

function lePool(): Pool {
  pool ??= new Pool({ connectionString: urlBaseTest(), max: 4 });
  return pool;
}

export async function fermer() {
  await pool?.end();
  pool = undefined;
}

/** Requête en super-utilisateur : prépare les données, contourne la RLS. */
export async function enAdmin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await lePool().query(sql, params)).rows as T[];
}

/**
 * Exécute `fn` comme le ferait l'API Supabase pour ce compte : rôle
 * `authenticated` (ou `anon` si uid est null) et identité dans les claims.
 * La transaction est validée si `fn` réussit, annulée sinon.
 */
export async function enTantQue<T>(uid: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await lePool().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "anon" }),
    ]);
    const resultat = await fn(client);
    await client.query("commit");
    return resultat;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/** Lignes renvoyées par une requête exécutée en tant que `uid`. */
export async function lire<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  return enTantQue(uid, async (c) => (await c.query(sql, params)).rows as T[]);
}

/** Nombre de lignes touchées par une écriture exécutée en tant que `uid`. */
export async function ecrire(uid: string | null, sql: string, params: unknown[] = []) {
  return enTantQue(uid, async (c) => (await c.query(sql, params)).rowCount ?? 0);
}

/** Message d'erreur PostgreSQL d'une requête, ou null si elle réussit. */
export async function erreur(uid: string | null, sql: string, params: unknown[] = []) {
  try {
    await enTantQue(uid, (c) => c.query(sql, params));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function creerCompte(email: string, confirme = true): Promise<string> {
  const [ligne] = await enAdmin<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id",
    [email, confirme ? new Date() : null],
  );
  return ligne.id;
}
