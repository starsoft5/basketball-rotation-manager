const PLAYERS_PER_GAME = 10;
const MIN_GAMES_PER_PLAYER = 4;
const MIN_MINUTES_PER_ROTATION = 10;

function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function calcRotations(playerCount, maxGameMinutes = 120, minutesPerGame = 10, transitionMinutes = 0, minGamesPerPlayer = 0) {
  const effectiveMin = Math.max(minGamesPerPlayer, MIN_GAMES_PER_PLAYER);
  const minGames = playerCount > 0 ? Math.ceil(playerCount * effectiveMin / PLAYERS_PER_GAME) : 1;

  let totalGames = minGames;
  let adjustedMinutesPerGame = minutesPerGame;

  const availablePlay = (g) => maxGameMinutes - Math.max(g - 1, 0) * transitionMinutes;

  const bestFromPlay = Math.floor(availablePlay(1) / minutesPerGame);
  if (bestFromPlay > totalGames) totalGames = bestFromPlay;

  while (totalGames > minGames && availablePlay(totalGames) / totalGames < minutesPerGame) {
    totalGames--;
  }

  totalGames = Math.max(totalGames, minGames);
  const playTime = availablePlay(totalGames);
  adjustedMinutesPerGame = Math.max(Math.floor(playTime / totalGames), 1);

  const totalSlots = totalGames * PLAYERS_PER_GAME;
  const minPlays = Math.floor(totalSlots / playerCount);
  const maxPlays = Math.ceil(totalSlots / playerCount);
  const extraSlots = totalSlots - playerCount * minPlays;
  const playingMinutes = totalGames * adjustedMinutesPerGame;
  return {
    totalGames,
    totalMinutes: playingMinutes,
    totalWithTransitions: playingMinutes + Math.max(totalGames - 1, 0) * transitionMinutes,
    minutesPerRotation: adjustedMinutesPerGame,
    transitionMinutes,
    minPlays,
    maxPlays,
    playersWithExtra: extraSlots,
    playersWithMin: playerCount - extraSlots,
    isEven: extraSlots === 0,
    adjusted: adjustedMinutesPerGame !== minutesPerGame,
    originalMinutesPerGame: minutesPerGame,
  };
}

export function calcRotationsEqualTime(playerCount, maxGameMinutes = 120, transitionMinutes = 0) {
  const step = playerCount / gcd(playerCount, PLAYERS_PER_GAME);
  const minRotations = Math.ceil(MIN_GAMES_PER_PLAYER * playerCount / PLAYERS_PER_GAME);

  const availablePlay = (r) => maxGameMinutes - Math.max(r - 1, 0) * transitionMinutes;
  const effectiveDuration = (r) => availablePlay(r) / r;

  const startStep = Math.ceil(minRotations / step) * step;
  let perfectBest = startStep;
  for (let r = startStep; r <= maxGameMinutes * 4; r += step) {
    const duration = effectiveDuration(r);
    if (duration < MIN_MINUTES_PER_ROTATION) break;
    if (duration <= 15) {
      perfectBest = r;
      break;
    }
    perfectBest = r;
  }

  const perfectDur = effectiveDuration(perfectBest);

  if (perfectDur >= MIN_MINUTES_PER_ROTATION) {
    const playsPerPlayer = (perfectBest * PLAYERS_PER_GAME) / playerCount;
    const playingMinutes = perfectBest * perfectDur;
    return {
      totalGames: perfectBest,
      totalMinutes: Math.round(playingMinutes * 100) / 100,
      totalWithTransitions: Math.round(maxGameMinutes * 100) / 100,
      minutesPerRotation: Math.round(perfectDur * 100) / 100,
      transitionMinutes,
      playsPerPlayer,
      minPlays: playsPerPlayer,
      maxPlays: playsPerPlayer,
      isEven: true,
    };
  }

  let bestR = null;
  let bestDiff = Infinity;
  const lo = Math.max(minRotations, Math.ceil(maxGameMinutes / 15));
  const hi = Math.floor(maxGameMinutes / MIN_MINUTES_PER_ROTATION);
  for (let r = lo; r <= hi; r++) {
    const dur = effectiveDuration(r);
    if (dur < MIN_MINUTES_PER_ROTATION) continue;
    const diff = Math.abs(dur - 10);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestR = r;
    }
  }

  if (bestR === null) bestR = perfectBest;

  const perRotation = effectiveDuration(bestR);
  const totalSlots = bestR * PLAYERS_PER_GAME;
  const minPlays = Math.floor(totalSlots / playerCount);
  const maxPlays = Math.ceil(totalSlots / playerCount);
  const playingMinutes = bestR * perRotation;

  return {
    totalGames: bestR,
    totalMinutes: Math.round(playingMinutes * 100) / 100,
    totalWithTransitions: Math.round((playingMinutes + Math.max(bestR - 1, 0) * transitionMinutes) * 100) / 100,
    minutesPerRotation: Math.round(perRotation * 100) / 100,
    transitionMinutes,
    playsPerPlayer: maxPlays,
    minPlays,
    maxPlays,
    isEven: minPlays === maxPlays,
  };
}

export function generateSchedule(players, maxGameMinutes = 120, minutesPerGame = 10, transitionMinutes = 0, minGamesPerPlayer = 0, firstRotationIds = null) {
  const { totalGames } = calcRotations(players.length, maxGameMinutes, minutesPerGame, transitionMinutes, minGamesPerPlayer);
  const rotations = [];
  const playCounts = new Map();
  players.forEach((p) => playCounts.set(p.id, 0));

  const groups = new Map();
  const solos = [];
  players.forEach((p) => {
    if (p.friend_group != null) {
      if (!groups.has(p.friend_group)) groups.set(p.friend_group, []);
      groups.get(p.friend_group).push(p);
    } else {
      solos.push(p);
    }
  });

  const units = [];
  groups.forEach((members) => units.push(members));
  solos.forEach((p) => units.push([p]));

  for (let r = 0; r < totalGames; r++) {
    rotations.push({ rotationNumber: r + 1, players: [] });
  }

  if (firstRotationIds && rotations.length > 0) {
    const firstIdSet = new Set(firstRotationIds);
    const selected = players.filter((p) => firstIdSet.has(p.id));
    rotations[0].players = selected;
    selected.forEach((p) => playCounts.set(p.id, 1));
  }

  for (const rotation of rotations) {
    if (rotation.players.length >= PLAYERS_PER_GAME) continue;
    const candidates = [...units]
      .filter((unit) => !rotation.players.some((p) => unit.some((u) => u.id === p.id)))
      .sort((a, b) => {
        const avgA = a.reduce((s, p) => s + playCounts.get(p.id), 0) / a.length;
        const avgB = b.reduce((s, p) => s + playCounts.get(p.id), 0) / b.length;
        if (avgA !== avgB) return avgA - avgB;
        return Math.random() - 0.5;
      });
    for (const unit of candidates) {
      if (rotation.players.length + unit.length <= PLAYERS_PER_GAME) {
        rotation.players.push(...unit);
        unit.forEach((p) => playCounts.set(p.id, playCounts.get(p.id) + 1));
      }
      if (rotation.players.length >= PLAYERS_PER_GAME) break;
    }
  }

  return rotations;
}

export function generateScheduleEqualTime(players, maxGameMinutes = 120, transitionMinutes = 0, firstRotationIds = null) {
  const info = calcRotationsEqualTime(players.length, maxGameMinutes, transitionMinutes);
  const { totalGames } = info;

  const rotations = [];
  for (let r = 0; r < totalGames; r++) {
    rotations.push({ rotationNumber: r + 1, players: [] });
  }

  const playCounts = new Map();
  players.forEach((p) => playCounts.set(p.id, 0));

  const groups = new Map();
  const solos = [];
  players.forEach((p) => {
    if (p.friend_group != null) {
      if (!groups.has(p.friend_group)) groups.set(p.friend_group, []);
      groups.get(p.friend_group).push(p);
    } else {
      solos.push(p);
    }
  });
  const units = [];
  groups.forEach((members) => units.push(members));
  solos.forEach((p) => units.push([p]));

  if (firstRotationIds && rotations.length > 0) {
    const firstIdSet = new Set(firstRotationIds);
    const selected = players.filter((p) => firstIdSet.has(p.id));
    rotations[0].players = selected;
    selected.forEach((p) => playCounts.set(p.id, 1));
  }

  for (const rotation of rotations) {
    if (rotation.players.length >= PLAYERS_PER_GAME) continue;
    const candidates = [...units]
      .filter((unit) => !rotation.players.some((p) => unit.some((u) => u.id === p.id)))
      .sort((a, b) => {
        const avgA = a.reduce((s, p) => s + playCounts.get(p.id), 0) / a.length;
        const avgB = b.reduce((s, p) => s + playCounts.get(p.id), 0) / b.length;
        if (avgA !== avgB) return avgA - avgB;
        return Math.random() - 0.5;
      });

    for (const unit of candidates) {
      if (rotation.players.length + unit.length <= PLAYERS_PER_GAME) {
        rotation.players.push(...unit);
        unit.forEach((p) => playCounts.set(p.id, playCounts.get(p.id) + 1));
      }
      if (rotation.players.length >= PLAYERS_PER_GAME) break;
    }
  }

  return rotations;
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
