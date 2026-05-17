const MAX_GAME_MINUTES = 120;
const MINUTES_PER_GAME = 10;
const PLAYERS_PER_GAME = 10;
const MIN_PLAYS = 4;

export function calcRotations(playerCount) {
  const totalGames = Math.floor(MAX_GAME_MINUTES / MINUTES_PER_GAME);
  const totalSlots = totalGames * PLAYERS_PER_GAME;
  const minPlays = Math.floor(totalSlots / playerCount);
  const maxPlays = Math.ceil(totalSlots / playerCount);
  const extraSlots = totalSlots - playerCount * minPlays;
  return {
    totalGames,
    totalMinutes: totalGames * MINUTES_PER_GAME,
    minPlays,
    maxPlays,
    playersWithExtra: extraSlots,
    playersWithMin: playerCount - extraSlots,
    isEven: extraSlots === 0,
  };
}

export function generateSchedule(players) {
  const { totalGames } = calcRotations(players.length);
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

  // Phase 1: guarantee every player gets MIN_PLAYS games
  for (let round = 0; round < MIN_PLAYS; round++) {
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

  // Phase 2: fill remaining slots with least-played players
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

  // Phase 3: force-fix any player still under MIN_PLAYS
  for (const player of players) {
    while (playCounts.get(player.id) < MIN_PLAYS) {
      let didSwap = false;
      for (const rotation of rotations) {
        if (playCounts.get(player.id) >= MIN_PLAYS) break;
        if (rotation.players.some((p) => p.id === player.id)) continue;
        const victim = rotation.players
          .filter((p) => playCounts.get(p.id) > MIN_PLAYS)
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

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
