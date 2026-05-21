const PLAYERS_PER_GAME = 10;

function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function calcRotations(playerCount, maxGameMinutes = 120, minutesPerGame = 10) {
  const totalGames = Math.floor(maxGameMinutes / minutesPerGame);
  const totalSlots = totalGames * PLAYERS_PER_GAME;
  const minPlays = Math.floor(totalSlots / playerCount);
  const maxPlays = Math.ceil(totalSlots / playerCount);
  const extraSlots = totalSlots - playerCount * minPlays;
  return {
    totalGames,
    totalMinutes: totalGames * minutesPerGame,
    minutesPerRotation: minutesPerGame,
    minPlays,
    maxPlays,
    playersWithExtra: extraSlots,
    playersWithMin: playerCount - extraSlots,
    isEven: extraSlots === 0,
  };
}

export function calcRotationsEqualTime(playerCount, maxGameMinutes = 120) {
  const step = playerCount / gcd(playerCount, PLAYERS_PER_GAME);

  let best = step;
  for (let r = step; r <= maxGameMinutes * 4; r += step) {
    const duration = maxGameMinutes / r;
    if (duration < 3) break;
    if (duration <= 15) {
      best = r;
      break;
    }
    best = r;
  }

  const totalGames = best;
  const minutesPerRotation = maxGameMinutes / totalGames;
  const playsPerPlayer = (totalGames * PLAYERS_PER_GAME) / playerCount;

  return {
    totalGames,
    totalMinutes: maxGameMinutes,
    minutesPerRotation: Math.round(minutesPerRotation * 100) / 100,
    playsPerPlayer,
    isEven: true,
  };
}

export function generateSchedule(players, maxGameMinutes = 120, minutesPerGame = 10) {
  const { totalGames, minPlays } = calcRotations(players.length, maxGameMinutes, minutesPerGame);
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

  const targetMin = Math.max(minPlays, 1);

  for (let round = 0; round < targetMin; round++) {
    const shuffled = [...units].sort(() => Math.random() - 0.5);
    for (const unit of shuffled) {
      const available = rotations
        .filter((r) => r.players.length + unit.length <= PLAYERS_PER_GAME)
        .filter((r) => !r.players.some((p) => unit.some((u) => u.id === p.id)))
        .sort((a, b) => a.players.length - b.players.length);
      const target = available[0];
      if (!target) continue;
      target.players.push(...unit);
      unit.forEach((p) => playCounts.set(p.id, playCounts.get(p.id) + 1));
    }
  }

  for (const rotation of rotations) {
    if (rotation.players.length >= PLAYERS_PER_GAME) continue;
    const sorted = [...units]
      .filter((unit) => !rotation.players.some((p) => unit.some((u) => u.id === p.id)))
      .sort((a, b) => {
        const avgA = a.reduce((s, p) => s + playCounts.get(p.id), 0) / a.length;
        const avgB = b.reduce((s, p) => s + playCounts.get(p.id), 0) / b.length;
        if (avgA !== avgB) return avgA - avgB;
        return Math.random() - 0.5;
      });
    for (const unit of sorted) {
      if (rotation.players.length + unit.length <= PLAYERS_PER_GAME) {
        rotation.players.push(...unit);
        unit.forEach((p) => playCounts.set(p.id, playCounts.get(p.id) + 1));
      }
      if (rotation.players.length >= PLAYERS_PER_GAME) break;
    }
  }

  for (const player of players) {
    while (playCounts.get(player.id) < targetMin) {
      let didSwap = false;
      for (const rotation of rotations) {
        if (playCounts.get(player.id) >= targetMin) break;
        if (rotation.players.some((p) => p.id === player.id)) continue;
        const victim = rotation.players
          .filter((p) => playCounts.get(p.id) > targetMin)
          .sort((a, b) => playCounts.get(b.id) - playCounts.get(a.id))[0];
        if (!victim) continue;
        rotation.players = rotation.players.map((p) => p.id === victim.id ? player : p);
        playCounts.set(victim.id, playCounts.get(victim.id) - 1);
        playCounts.set(player.id, playCounts.get(player.id) + 1);
        didSwap = true;
      }
      if (!didSwap) break;
    }
  }

  return rotations;
}

export function generateScheduleEqualTime(players, maxGameMinutes = 120) {
  const info = calcRotationsEqualTime(players.length, maxGameMinutes);
  const { totalGames, playsPerPlayer } = info;

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

  for (const rotation of rotations) {
    const candidates = [...units]
      .filter((unit) => !rotation.players.some((p) => unit.some((u) => u.id === p.id)))
      .filter((unit) => unit.every((p) => playCounts.get(p.id) < playsPerPlayer))
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
