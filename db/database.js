import * as SQLite from "expo-sqlite";

let db = null;

export async function getDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("basketball_rotation.db");
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database) {
  await database.execAsync(`PRAGMA journal_mode = WAL`);

  try {
    await database.runAsync("ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch (e) {}
  try {
    await database.runAsync("ALTER TABLE players ADD COLUMN friend_group INTEGER DEFAULT NULL");
  } catch (e) {}
  try {
    await database.runAsync("ALTER TABLE games ADD COLUMN game_end_time INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await database.runAsync("ALTER TABLE games ADD COLUMN break_time_seconds INTEGER DEFAULT 0");
  } catch (e) {}

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_players INTEGER NOT NULL,
      game_duration INTEGER NOT NULL DEFAULT 120,
      rotation_minutes INTEGER NOT NULL DEFAULT 10,
      players_per_rotation INTEGER NOT NULL DEFAULT 10,
      plays_per_player INTEGER NOT NULL DEFAULT 4,
      current_rotation INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'setup',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      jersey_number INTEGER,
      total_play_time INTEGER DEFAULT 0,
      times_played INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      friend_group INTEGER DEFAULT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      rotation_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT,
      ended_at TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rotation_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rotation_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      FOREIGN KEY (rotation_id) REFERENCES rotations(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const existing = await database.getFirstAsync("SELECT COUNT(*) as cnt FROM settings");
  if (existing.cnt === 0) {
    await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('game_hours', '2')");
    await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('minutes_per_game', '10')");
  }
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('distribution_mode', 'unequal_games')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('equal_time_hours', '2')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('game_total_minutes', '120')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('equal_time_total_minutes', '120')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('transition_minutes', '2')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('transition_total_seconds', '120')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('payment_per_player', '280')");
  await database.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark')");
}

export async function createGame(name, totalPlayers) {
  const database = await getDatabase();
  const result = await database.runAsync(
    "INSERT INTO games (name, total_players) VALUES (?, ?)",
    [name, totalPlayers]
  );
  return result.lastInsertRowId;
}

export async function getGame(gameId) {
  const database = await getDatabase();
  return await database.getFirstAsync("SELECT * FROM games WHERE id = ?", [
    gameId,
  ]);
}

export async function updateGameStatus(gameId, status) {
  const database = await getDatabase();
  await database.runAsync("UPDATE games SET status = ? WHERE id = ?", [
    status,
    gameId,
  ]);
}

export async function updateGameRotation(gameId, rotationNumber) {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE games SET current_rotation = ? WHERE id = ?",
    [rotationNumber, gameId]
  );
}

export async function addPlayer(gameId, name, jerseyNumber) {
  const database = await getDatabase();
  const result = await database.runAsync(
    "INSERT INTO players (game_id, name, jersey_number) VALUES (?, ?, ?)",
    [gameId, name, jerseyNumber]
  );
  return result.lastInsertRowId;
}

export async function getPlayers(gameId) {
  const database = await getDatabase();
  return await database.getAllAsync(
    "SELECT * FROM players WHERE game_id = ? ORDER BY jersey_number",
    [gameId]
  );
}

export async function updatePlayerStatus(playerId, status) {
  const database = await getDatabase();
  await database.runAsync("UPDATE players SET status = ? WHERE id = ?", [status, playerId]);
}

export async function linkFriends(playerIds, gameId) {
  const database = await getDatabase();
  const existing = await database.getFirstAsync(
    "SELECT MAX(friend_group) as maxGroup FROM players WHERE game_id = ?",
    [gameId]
  );
  const groupId = (existing?.maxGroup || 0) + 1;
  for (const id of playerIds) {
    await database.runAsync("UPDATE players SET friend_group = ? WHERE id = ?", [groupId, id]);
  }
}

export async function unlinkPlayer(playerId) {
  const database = await getDatabase();
  await database.runAsync("UPDATE players SET friend_group = NULL WHERE id = ?", [playerId]);
}

export async function getActivePlayers(gameId) {
  const database = await getDatabase();
  return await database.getAllAsync(
    "SELECT * FROM players WHERE game_id = ? AND status = 'active' ORDER BY jersey_number",
    [gameId]
  );
}

export async function updatePlayerStats(playerId, totalPlayTime, timesPlayed) {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE players SET total_play_time = ?, times_played = ? WHERE id = ?",
    [totalPlayTime, timesPlayed, playerId]
  );
}

export async function incrementPlayerStats(playerId, playTimeToAdd) {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE players SET total_play_time = total_play_time + ?, times_played = times_played + 1 WHERE id = ?",
    [playTimeToAdd, playerId]
  );
}

export async function createRotation(gameId, rotationNumber) {
  const database = await getDatabase();
  const result = await database.runAsync(
    "INSERT INTO rotations (game_id, rotation_number) VALUES (?, ?)",
    [gameId, rotationNumber]
  );
  return result.lastInsertRowId;
}

export async function addPlayerToRotation(rotationId, playerId) {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT INTO rotation_players (rotation_id, player_id) VALUES (?, ?)",
    [rotationId, playerId]
  );
}

export async function getRotations(gameId) {
  const database = await getDatabase();
  return await database.getAllAsync(
    "SELECT * FROM rotations WHERE game_id = ? ORDER BY rotation_number",
    [gameId]
  );
}

export async function getRotationPlayers(rotationId) {
  const database = await getDatabase();
  return await database.getAllAsync(
    `SELECT p.* FROM players p
     INNER JOIN rotation_players rp ON p.id = rp.player_id
     WHERE rp.rotation_id = ?
     ORDER BY p.jersey_number`,
    [rotationId]
  );
}

export async function updateRotationStatus(rotationId, status) {
  const database = await getDatabase();
  const timeField =
    status === "active"
      ? ", started_at = datetime('now', 'localtime')"
      : status === "completed"
        ? ", ended_at = datetime('now', 'localtime')"
        : "";
  await database.runAsync(
    `UPDATE rotations SET status = ?${timeField} WHERE id = ?`,
    [status, rotationId]
  );
}

export async function getAllGames() {
  const database = await getDatabase();
  return await database.getAllAsync(
    `SELECT g.*,
            (SELECT COUNT(*) FROM players p WHERE p.game_id = g.id) AS total_players,
            (SELECT COUNT(*) FROM rotations r WHERE r.game_id = g.id) AS total_rotations
     FROM games g
     ORDER BY g.created_at DESC`
  );
}

export async function deleteGame(gameId) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM games WHERE id = ?", [gameId]);
}

export async function saveSchedule(gameId, schedule) {
  const database = await getDatabase();
  for (const rotation of schedule) {
    const rotationId = await createRotation(gameId, rotation.rotationNumber);
    for (const player of rotation.players) {
      await addPlayerToRotation(rotationId, player.id);
    }
  }
}

export async function removePlayerFromRotation(rotationId, playerId) {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM rotation_players WHERE rotation_id = ? AND player_id = ?",
    [rotationId, playerId]
  );
}

export async function addPlayerToFutureRotations(gameId, playerId, fromRotation) {
  const database = await getDatabase();
  const rotations = await database.getAllAsync(
    "SELECT * FROM rotations WHERE game_id = ? AND rotation_number >= ? ORDER BY rotation_number",
    [gameId, fromRotation]
  );
  return rotations;
}

export async function deletePlayer(playerId) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM rotation_players WHERE player_id = ?", [playerId]);
  await database.runAsync("DELETE FROM players WHERE id = ?", [playerId]);
}

export async function getSettings() {
  const database = await getDatabase();
  const rows = await database.getAllAsync("SELECT key, value FROM settings");
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  const gameHours = parseInt(settings.game_hours || "2", 10);
  const equalTimeHours = parseInt(settings.equal_time_hours || "2", 10);
  return {
    gameHours,
    equalTimeHours,
    gameTotalMinutes: parseInt(settings.game_total_minutes || String(gameHours * 60), 10),
    equalTimeTotalMinutes: parseInt(settings.equal_time_total_minutes || String(equalTimeHours * 60), 10),
    minutesPerGame: parseInt(settings.minutes_per_game || "10", 10),
    transitionMinutes: parseInt(settings.transition_minutes || "2", 10),
    transitionTotalSeconds: parseInt(settings.transition_total_seconds || String(parseInt(settings.transition_minutes || "2", 10) * 60), 10),
    distributionMode: settings.distribution_mode || "unequal_games",
    paymentPerPlayer: parseInt(settings.payment_per_player || "280", 10),
    minGamesPerPlayer: parseInt(settings.min_games_per_player || "0", 10),
    theme: settings.theme || "dark",
  };
}

export async function saveSetting(key, value) {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, String(value)]
  );
}

export async function updateGameEndTime(gameId, endTimeMs) {
  const database = await getDatabase();
  await database.runAsync("UPDATE games SET game_end_time = ? WHERE id = ?", [endTimeMs, gameId]);
}

export async function updateGameBreakTime(gameId, breakTimeSeconds) {
  const database = await getDatabase();
  await database.runAsync("UPDATE games SET break_time_seconds = ? WHERE id = ?", [breakTimeSeconds, gameId]);
}

export async function getFullGameData(gameId) {
  const game = await getGame(gameId);
  if (!game) return null;

  const players = await getPlayers(gameId);
  const rotations = await getRotations(gameId);

  const rotationsWithPlayers = await Promise.all(
    rotations.map(async (rotation) => ({
      ...rotation,
      players: await getRotationPlayers(rotation.id),
    }))
  );

  return { game, players, rotations: rotationsWithPlayers };
}
