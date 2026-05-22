import { getDatabase } from "../db/database";

const _K = 0x5A3C6F91E2B7D4A8n;
const _S = "r0t@t10n_v1_s4lt!#";
const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

function _h(val) {
  let h = 0x811C9DC5;
  const s = _S + String(val) + _S;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function _enc(ts) {
  return (BigInt(ts) ^ _K).toString(16);
}

function _dec(encoded) {
  return Number(BigInt("0x" + encoded) ^ _K);
}

async function _getDb() {
  return await getDatabase();
}

async function _ensureTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _sys_cfg (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      c TEXT NOT NULL
    )
  `);
}

async function _read(db, key) {
  const row = await db.getFirstAsync("SELECT v, c FROM _sys_cfg WHERE k = ?", [key]);
  if (!row) return null;
  const decoded = _dec(row.v);
  if (_h(decoded) !== row.c) return -1;
  return decoded;
}

async function _write(db, key, val) {
  const encoded = _enc(val);
  const check = _h(val);
  await db.runAsync(
    "INSERT OR REPLACE INTO _sys_cfg (k, v, c) VALUES (?, ?, ?)",
    [key, encoded, check]
  );
}

export async function checkLicense() {
  const db = await _getDb();
  await _ensureTable(db);

  const now = Date.now();

  const installTs = await _read(db, "i");
  const lastSeen = await _read(db, "s");

  if (installTs === -1 || lastSeen === -1) {
    return { valid: false, reason: "integrity" };
  }

  if (installTs === null) {
    await _write(db, "i", now);
    await _write(db, "s", now);
    return { valid: true, remaining: TRIAL_MS };
  }

  if (lastSeen !== null && now < lastSeen - 5000) {
    return { valid: false, reason: "clock" };
  }

  await _write(db, "s", now);

  const elapsed = now - installTs;
  if (elapsed >= TRIAL_MS) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, remaining: TRIAL_MS - elapsed };
}
