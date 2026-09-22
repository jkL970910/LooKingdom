import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { makeSeed, type KingdomState } from "./domain";
import { normalizeState } from "./lifestyle";
import { DomainError } from "./errors";

const globals = globalThis as unknown as {
  looPool?: Pool;
  looReady?: Promise<void>;
  looQueue?: Promise<unknown>;
  looRate?: Map<string, { count: number; until: number }>;
  looGeoCache?: Map<string, { expires: number; data: unknown }>;
  looGeoBusy?: boolean;
  looGeoLast?: number;
};
export function localMode() {
  return (
    !process.env.DATABASE_URL &&
    !process.env.VERCEL &&
    (process.env.NODE_ENV !== "production" ||
      process.env.LOO_LOCAL_DEMO === "true")
  );
}
const dataDir = () =>
  path.join(process.cwd(), ".local", process.env.LOO_DATA_DIR || "home");
const statePath = () => path.join(dataDir(), "kingdom.json");
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required outside local development");
  return (globals.looPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
  }));
}
export async function ready() {
  if (!globals.looReady)
    globals.looReady = (async () => {
      await pool()
        .query(`CREATE TABLE IF NOT EXISTS loo_kingdom (id text PRIMARY KEY, state jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS loo_photos (id uuid PRIMARY KEY, owner text NOT NULL, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS loo_login_limits (id text PRIMARY KEY, attempts integer NOT NULL, expires timestamptz NOT NULL);
      CREATE TABLE IF NOT EXISTS loo_geocode_cache (id text PRIMARY KEY, data jsonb NOT NULL, expires timestamptz NOT NULL);
      CREATE TABLE IF NOT EXISTS loo_push_subscriptions (id text PRIMARY KEY, owner text NOT NULL, subscription jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS loo_service_clock (id text PRIMARY KEY, last_request timestamptz NOT NULL);`);
      await pool().query(
        "INSERT INTO loo_kingdom (id, state) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING",
        [
          "home",
          JSON.stringify(
            makeSeed(false, process.env.LOO_TIMEZONE || "America/Toronto"),
          ),
        ],
      );
    })().catch((error) => {
      globals.looReady = undefined;
      throw error;
    });
  await globals.looReady;
}
async function localRead(): Promise<KingdomState> {
  try {
    return normalizeState(JSON.parse(await readFile(statePath(), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const seed = makeSeed(true, process.env.LOO_TIMEZONE || "America/Toronto");
    await localWrite(seed);
    return seed;
  }
}
async function localWrite(state: KingdomState) {
  await mkdir(dataDir(), { recursive: true });
  const temp = statePath() + "." + crypto.randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(state), "utf8");
  await rename(temp, statePath());
}
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const job = (globals.looQueue ?? Promise.resolve()).then(work);
  globals.looQueue = job.catch(() => {});
  return job;
}
export async function readState(): Promise<KingdomState> {
  if (localMode()) return exclusive(localRead);
  await ready();
  const result = await pool().query(
    "SELECT state FROM loo_kingdom WHERE id = $1",
    ["home"],
  );
  return normalizeState(result.rows[0].state);
}
export async function updateState(
  mutate: (state: KingdomState) => KingdomState,
): Promise<KingdomState> {
  if (localMode())
    return exclusive(async () => {
      const state = mutate(await localRead());
      await localWrite(state);
      return state;
    });
  await ready();
  const connection = await pool().connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      "SELECT state FROM loo_kingdom WHERE id = $1 FOR UPDATE",
      ["home"],
    );
    const state = mutate(normalizeState(result.rows[0].state));
    await connection.query(
      "UPDATE loo_kingdom SET state = $1::jsonb WHERE id = $2",
      [JSON.stringify(state), "home"],
    );
    await connection.query("COMMIT");
    return state;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
export async function savePhoto(
  id: string,
  owner: string,
  mime: string,
  data: Buffer,
) {
  if (localMode()) {
    const folder = path.join(dataDir(), "photos");
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, id + ".json"),
      JSON.stringify({ owner, mime }),
    );
    await writeFile(path.join(folder, id), data);
    return;
  }
  await ready();
  await pool().query(
    "INSERT INTO loo_photos (id, owner, mime, data) VALUES ($1,$2,$3,$4)",
    [id, owner, mime, data],
  );
}
export async function getPhoto(
  id: string,
): Promise<{ mime: string; data: Buffer } | null> {
  if (localMode()) {
    try {
      const meta = JSON.parse(
        await readFile(path.join(dataDir(), "photos", id + ".json"), "utf8"),
      );
      return {
        mime: meta.mime,
        data: await readFile(path.join(dataDir(), "photos", id)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  await ready();
  const result = await pool().query(
    "SELECT mime, data FROM loo_photos WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}
// A single shared gate covers every cloud instance. Searches are user-triggered,
// cached for a day, never parallel, and start at least 1.2 seconds apart.
export async function cachedGeocode<T>(
  key: string,
  fetchPlaces: () => Promise<T>,
): Promise<T> {
  const tooFast = () =>
    new DomainError("地图正在找路，稍等两秒再搜一次吧", 429);
  if (localMode()) {
    const cache = (globals.looGeoCache ??= new Map());
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data as T;
    if (globals.looGeoBusy || Date.now() - (globals.looGeoLast || 0) < 1200)
      throw tooFast();
    globals.looGeoBusy = true;
    globals.looGeoLast = Date.now();
    try {
      const data = await fetchPlaces();
      cache.set(key, { expires: Date.now() + 86400000, data });
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
      return data;
    } finally {
      globals.looGeoBusy = false;
    }
  }
  await ready();
  const cached = await pool().query(
    "SELECT data FROM loo_geocode_cache WHERE id=$1 AND expires>now()",
    [key],
  );
  if (cached.rowCount) return cached.rows[0].data as T;
  const connection = await pool().connect();
  try {
    await connection.query("BEGIN");
    // Transaction advisory locks also work through transaction-pooling Postgres proxies.
    const lock = await connection.query(
      "SELECT pg_try_advisory_xact_lock(786214, 1) AS acquired",
    );
    if (!lock.rows[0].acquired) throw tooFast();
    const recent = await connection.query(
      "SELECT 1 FROM loo_service_clock WHERE id='geocode' AND last_request>now()-interval '1.2 seconds'",
    );
    if (recent.rowCount) throw tooFast();
    let data: T | undefined, error: unknown;
    try {
      data = await fetchPlaces();
    } catch (e) {
      error = e;
    }
    // Record even failed lookups, so retries still obey the provider's limit.
    await connection.query(
      "INSERT INTO loo_service_clock (id,last_request) VALUES ('geocode',clock_timestamp()) ON CONFLICT (id) DO UPDATE SET last_request=EXCLUDED.last_request",
    );
    if (data !== undefined)
      await connection.query(
        "INSERT INTO loo_geocode_cache (id,data,expires) VALUES ($1,$2::jsonb,now()+interval '1 day') ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,expires=EXCLUDED.expires",
        [key, JSON.stringify(data)],
      );
    await connection.query("DELETE FROM loo_geocode_cache WHERE expires<now()");
    await connection.query("COMMIT");
    if (error) throw error;
    return data as T;
  } catch (e) {
    await connection.query("ROLLBACK");
    throw e;
  } finally {
    connection.release();
  }
}
export async function allowLogin(key: string): Promise<boolean> {
  if (localMode()) {
    const map = (globals.looRate ??= new Map());
    for (const [k, value] of map) if (value.until < Date.now()) map.delete(k);
    const value = map.get(key) ?? { count: 0, until: Date.now() + 15 * 60000 };
    value.count++;
    map.set(key, value);
    return value.count <= 15;
  }
  await ready();
  const result = await pool().query(
    `INSERT INTO loo_login_limits (id, attempts, expires) VALUES ($1, 1, now() + interval '15 minutes')
    ON CONFLICT (id) DO UPDATE SET attempts = CASE WHEN loo_login_limits.expires < now() THEN 1 ELSE loo_login_limits.attempts + 1 END,
    expires = CASE WHEN loo_login_limits.expires < now() THEN now() + interval '15 minutes' ELSE loo_login_limits.expires END RETURNING attempts`,
    [key],
  );
  return result.rows[0].attempts <= 15;
}
