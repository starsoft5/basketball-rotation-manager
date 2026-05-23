import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  BackHandler,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  getFullGameData,
  updateGameStatus,
  updateGameRotation,
  updateRotationStatus,
  updatePlayerStats,
  updatePlayerStatus,
  getActivePlayers,
  saveSchedule,
  addPlayer,
  addPlayerToRotation,
  removePlayerFromRotation,
  deletePlayer,
  linkFriends,
  unlinkPlayer,
  getSettings,
  getDatabase,
  createRotation,
} from "../../db/database";
import { generateSchedule, generateScheduleEqualTime, calcRotations, calcRotationsEqualTime, formatTime } from "../../utils/scheduler";
import RotationCard from "../../components/RotationCard";

export default function GameScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const gameId = parseInt(id, 10);

  const [gameData, setGameData] = useState(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [gameStatus, setGameStatus] = useState("ready");
  const [schedule, setSchedule] = useState([]);
  const [rotationDuration, setRotationDuration] = useState(600);
  const [minutesPerGame, setMinutesPerGame] = useState(10);

  const [showManage, setShowManage] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState([]);

  const timerRef = useRef(null);
  const flatListRef = useRef(null);
  const currentRotationRef = useRef(0);
  const scheduleRef = useRef([]);
  const gameDataRef = useRef(null);
  const rotationDurationRef = useRef(600);
  const minutesPerGameRef = useRef(10);
  const timerEndTimeRef = useRef(null);
  const timeRemainingRef = useRef(600);

  useEffect(() => { currentRotationRef.current = currentRotation; }, [currentRotation]);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);
  useEffect(() => { rotationDurationRef.current = rotationDuration; }, [rotationDuration]);
  useEffect(() => { minutesPerGameRef.current = minutesPerGame; }, [minutesPerGame]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  useEffect(() => {
    loadGame();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleExit();
      return true;
    });
    const appStateListener = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && timerEndTimeRef.current) {
        const now = Date.now();
        const remaining = Math.round((timerEndTimeRef.current - now) / 1000);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          timerEndTimeRef.current = null;
          setTimeRemaining(0);
          setIsRunning(false);
          handleRotationEnd();
        } else {
          setTimeRemaining(remaining);
        }
      }
    });
    return () => {
      backHandler.remove();
      appStateListener.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadGame = async () => {
    const settings = await getSettings();
    const mode = settings.distributionMode;
    const maxGameMinutes = (mode === "equal_time" ? settings.equalTimeHours : settings.gameHours) * 60;

    const data = await getFullGameData(gameId);
    if (!data) return;
    setGameData(data);

    let minsPerGame, duration;
    if (mode === "equal_time" && data.players.length > 0) {
      const info = calcRotationsEqualTime(data.players.length, maxGameMinutes);
      minsPerGame = info.minutesPerRotation;
      duration = Math.round(minsPerGame * 60);
    } else {
      minsPerGame = settings.minutesPerGame;
      duration = minsPerGame * 60;
    }

    setRotationDuration(duration);
    setMinutesPerGame(minsPerGame);
    rotationDurationRef.current = duration;
    minutesPerGameRef.current = minsPerGame;
    setTimeRemaining(duration);

    if (data.rotations.length > 0) {
      setSchedule(data.rotations);
      setCurrentRotation(data.game.current_rotation);
      setGameStatus(data.game.status);
    } else {
      const newSchedule = mode === "equal_time"
        ? generateScheduleEqualTime(data.players, maxGameMinutes)
        : generateSchedule(data.players, maxGameMinutes, minsPerGame);
      await saveSchedule(gameId, newSchedule);
      const fullData = await getFullGameData(gameId);
      setGameData(fullData);
      setSchedule(fullData.rotations);
    }
  };

  const handleRotationEnd = useCallback(async () => {
    const rot = currentRotationRef.current;
    const sched = scheduleRef.current;
    const gData = gameDataRef.current;
    const currentIdx = rot - 1;

    if (currentIdx >= 0 && currentIdx < sched.length) {
      await updateRotationStatus(sched[currentIdx].id, "completed");
      const rotPlayers = sched[currentIdx].players;
      for (const player of rotPlayers) {
        const existing = gData?.players.find((p) => p.id === player.id);
        if (existing) {
          await updatePlayerStats(
            player.id,
            Math.round((existing.total_play_time || 0) + minutesPerGameRef.current),
            (existing.times_played || 0) + 1
          );
        }
      }
    }

    if (rot >= sched.length) {
      setGameStatus("completed");
      await updateGameStatus(gameId, "completed");
      Alert.alert("Game Over!", `All ${sched.length} rotations have been completed.`, [
        { text: "View Summary", onPress: () => {} },
        { text: "Go Home", onPress: () => router.replace("/") },
      ]);
      return;
    }

    const nextRotation = rot + 1;
    setCurrentRotation(nextRotation);
    await updateGameRotation(gameId, nextRotation);
    setTimeRemaining(rotationDurationRef.current);

    if (nextRotation - 1 < sched.length) {
      await updateRotationStatus(sched[nextRotation - 1].id, "active");
    }

    scrollToRotation(nextRotation - 1);

    const nextPlayers = sched[nextRotation - 1]?.players
      .map((p) => p.name)
      .join(", ");

    Alert.alert(
      `Rotation ${rot} Complete!`,
      `Rotation ${nextRotation} is up next.\n\nPlayers: ${nextPlayers}`,
      [
        { text: "Start Next", onPress: () => startTimer() },
        { text: "Wait", style: "cancel" },
      ]
    );
  }, [gameId]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining((current) => {
      timerEndTimeRef.current = Date.now() + current * 1000;
      return current;
    });
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.round((timerEndTimeRef.current - now) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        timerEndTimeRef.current = null;
        setTimeRemaining(0);
        setIsRunning(false);
        handleRotationEnd();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);
    setIsRunning(true);
  }, [handleRotationEnd]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerEndTimeRef.current = null;
    setIsRunning(false);
  }, []);

  const handleStartGame = async () => {
    setGameStatus("in_progress");
    await updateGameStatus(gameId, "in_progress");
    setCurrentRotation(1);
    await updateGameRotation(gameId, 1);
    if (schedule.length > 0) {
      await updateRotationStatus(schedule[0].id, "active");
    }
    startTimer();
    scrollToRotation(0);
  };

  const scrollToRotation = (index) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 300);
  };

  const regenerateFutureRotations = async () => {
    const data = await getFullGameData(gameId);
    if (!data) return;
    const rot = currentRotationRef.current;
    const activePlayers = await getActivePlayers(gameId);
    const database = await getDatabase();

    const settings = await getSettings();
    const mode = settings.distributionMode;

    const pastCounts = new Map();
    activePlayers.forEach((p) => pastCounts.set(p.id, 0));
    data.rotations
      .filter((r) => r.rotation_number <= rot)
      .forEach((r) => r.players.forEach((p) => {
        pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
      }));

    const groups = new Map();
    const solos = [];
    activePlayers.forEach((p) => {
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

    const futureRotations = data.rotations.filter((r) => r.rotation_number > rot);

    if (mode === "equal_time" && activePlayers.length > 0) {
      const maxGameSeconds = settings.equalTimeHours * 3600;
      const oldDuration = rotationDurationRef.current;
      const currentTotal = data.rotations.length;

      const targetPlays = Math.max(Math.round(currentTotal * 10 / activePlayers.length), 1);
      const newTotal = Math.max(Math.round(targetPlays * activePlayers.length / 10), rot);
      const newDuration = Math.round(maxGameSeconds / newTotal);
      const futureCount = newTotal - rot;

      for (const rotation of futureRotations) {
        await database.runAsync("DELETE FROM rotation_players WHERE rotation_id = ?", [rotation.id]);
        await database.runAsync("DELETE FROM rotations WHERE id = ?", [rotation.id]);
      }

      for (let i = 0; i < futureCount; i++) {
        const rotNum = rot + 1 + i;
        const rotId = await createRotation(gameId, rotNum);
        const sorted = [...units].sort((a, b) => {
          const avgA = a.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / a.length;
          const avgB = b.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / b.length;
          if (avgA !== avgB) return avgA - avgB;
          return Math.random() - 0.5;
        });
        const selected = [];
        for (const unit of sorted) {
          if (selected.length + unit.length <= 10) {
            selected.push(...unit);
          }
          if (selected.length >= 10) break;
        }
        for (const p of selected) {
          await addPlayerToRotation(rotId, p.id);
          pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
        }
      }

      if (newDuration !== oldDuration) {
        const newRemaining = Math.max(Math.round(timeRemainingRef.current * newDuration / oldDuration), 1);
        setTimeRemaining(newRemaining);
        if (timerEndTimeRef.current) {
          timerEndTimeRef.current = Date.now() + newRemaining * 1000;
        }
        setRotationDuration(newDuration);
        rotationDurationRef.current = newDuration;
        const newMinutesPerGame = newDuration / 60;
        setMinutesPerGame(newMinutesPerGame);
        minutesPerGameRef.current = newMinutesPerGame;
      }
    } else {
      for (const rotation of futureRotations) {
        await database.runAsync("DELETE FROM rotation_players WHERE rotation_id = ?", [rotation.id]);
        const sorted = [...units].sort((a, b) => {
          const avgA = a.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / a.length;
          const avgB = b.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / b.length;
          if (avgA !== avgB) return avgA - avgB;
          return Math.random() - 0.5;
        });
        const selected = [];
        for (const unit of sorted) {
          if (selected.length + unit.length <= 10) {
            selected.push(...unit);
          }
          if (selected.length >= 10) break;
        }
        for (const p of selected) {
          await addPlayerToRotation(rotation.id, p.id);
          pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
        }
      }
    }

    const fullData = await getFullGameData(gameId);
    setGameData(fullData);
    setSchedule(fullData.rotations);
  };

  const handleAddLatePlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const jersey = (gameData?.players.length || 0) + 1;
    await addPlayer(gameId, name, jersey);
    setNewPlayerName("");
    await regenerateFutureRotations();
    Alert.alert("Player Added", `${name} added to future rotations.`);
  };

  const handleMarkNotPlaying = (player) => {
    Alert.alert(
      "Mark Not Playing",
      `Remove ${player.name} from all future rotations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            await updatePlayerStatus(player.id, "benched");
            const freshData = await getFullGameData(gameId);
            setGameData(freshData);
            await regenerateFutureRotations();
            Alert.alert("Done", `${player.name} removed from future rotations.`);
          },
        },
      ]
    );
  };

  const handleRemovePlayer = (player) => {
    const isOnCourt = gameStatus === "in_progress" &&
      schedule[currentRotation - 1]?.players.some((p) => p.id === player.id);

    if (isOnCourt) {
      Alert.alert(
        "Cannot Remove",
        `${player.name} is currently playing on court. Wait until the rotation ends or bench the player first.`
      );
      return;
    }

    Alert.alert(
      "Remove Player",
      `Permanently remove ${player.name} from the game?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deletePlayer(player.id);
            await regenerateFutureRotations();
            Alert.alert("Removed", `${player.name} has been removed.`);
          },
        },
      ]
    );
  };

  const handleExit = () => {
    if (gameStatus === "in_progress") {
      Alert.alert("Leave Game?", "The game timer will stop.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => { pauseTimer(); router.replace("/"); },
        },
      ]);
    } else {
      router.replace("/");
    }
  };

  const elapsed = (currentRotation - 1) * rotationDuration + (rotationDuration - timeRemaining);
  const totalGameTime = formatTime(Math.max(elapsed, 0));
  const progress =
    gameStatus === "in_progress"
      ? ((currentRotation - 1) / schedule.length) * 100 +
        ((rotationDuration - timeRemaining) / rotationDuration / schedule.length) * 100
      : gameStatus === "completed" ? 100 : 0;

  if (!gameData || schedule.length === 0) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.loadingText}>Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.gameName}>{gameData.game.name}</Text>

        <View style={s.timerWrap}>
          <Text style={s.timer}>{formatTime(timeRemaining)}</Text>
          <Text style={s.timerSub}>
            {gameStatus === "ready"
              ? "Ready to start"
              : gameStatus === "completed"
                ? "Game Complete"
                : `Rotation ${currentRotation} of ${schedule.length}`}
          </Text>
        </View>

        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Elapsed</Text>
            <Text style={s.statValue}>{totalGameTime}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Players</Text>
            <Text style={s.statValue}>{gameData.players.length}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Rotations</Text>
            <Text style={s.statValue}>
              {gameStatus === "completed" ? schedule.length : Math.max(currentRotation - 1, 0)}/{schedule.length}
            </Text>
          </View>
        </View>

        <View style={s.btnRow}>
          {gameStatus === "ready" ? (
            <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={handleStartGame} activeOpacity={0.8}>
              <Text style={s.btnText}>Start Game</Text>
            </TouchableOpacity>
          ) : gameStatus === "in_progress" ? (
            <>
              <TouchableOpacity
                style={[s.btn, s.btnHalf, isRunning ? s.btnYellow : s.btnGreen]}
                onPress={isRunning ? pauseTimer : startTimer}
                activeOpacity={0.8}
              >
                <Text style={s.btnText}>{isRunning ? "Pause" : "Resume"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnHalf, s.btnBlue]}
                onPress={() => { pauseTimer(); setTimeRemaining(0); handleRotationEnd(); }}
                activeOpacity={0.8}
              >
                <Text style={s.btnText}>Skip →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[s.btn, s.btnOrange]} onPress={() => router.replace("/")} activeOpacity={0.8}>
              <Text style={s.btnText}>Back to Home</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(gameStatus === "ready" || gameStatus === "in_progress") && (
        <TouchableOpacity
          style={s.manageBtn}
          onPress={() => setShowManage(true)}
          activeOpacity={0.8}
        >
          <Text style={s.manageBtnText}>Manage Players</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showManage} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Manage Players</Text>
              <TouchableOpacity onPress={() => { setShowManage(false); setLinkMode(false); setSelectedForLink([]); }}>
                <Text style={s.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={s.linkBar}>
              {linkMode ? (
                <>
                  <Text style={s.linkHint}>Tap players to link as friends</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[s.linkBtn, selectedForLink.length >= 2 && s.linkBtnReady]}
                      disabled={selectedForLink.length < 2}
                      onPress={async () => {
                        await linkFriends(selectedForLink, gameId);
                        await regenerateFutureRotations();
                        setSelectedForLink([]);
                        setLinkMode(false);
                        const freshData = await getFullGameData(gameId);
                        setGameData(freshData);
                        Alert.alert("Linked", "Players will always play together.");
                      }}
                    >
                      <Text style={s.linkBtnText}>Link ({selectedForLink.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => { setLinkMode(false); setSelectedForLink([]); }}
                    >
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={s.linkBtn}
                  onPress={() => setLinkMode(true)}
                >
                  <Text style={s.linkBtnText}>Link Friends</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={s.playerList}>
              {gameData?.players.map((player) => {
                const inCurrent = schedule[currentRotation - 1]?.players.some(
                  (p) => p.id === player.id
                );
                const futureCount = schedule
                  .filter((r) => r.rotation_number > currentRotation)
                  .filter((r) => r.players.some((p) => p.id === player.id)).length;
                const isSelected = selectedForLink.includes(player.id);
                const groupLabel = player.friend_group != null ? `G${player.friend_group}` : null;

                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[s.pRow, isSelected && s.pRowSelected, groupLabel && s.pRowLinked]}
                    onPress={linkMode ? () => {
                      setSelectedForLink((prev) =>
                        prev.includes(player.id)
                          ? prev.filter((id) => id !== player.id)
                          : [...prev, player.id]
                      );
                    } : undefined}
                    activeOpacity={linkMode ? 0.6 : 1}
                  >
                    <View style={s.pInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.pName}>{player.name}</Text>
                        {groupLabel && (
                          <View style={s.groupBadge}>
                            <Text style={s.groupBadgeText}>{groupLabel}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.pSub}>
                        Played: {player.times_played || 0}x
                        {inCurrent ? "  |  ON COURT" : ""}
                        {futureCount > 0 ? `  |  ${futureCount} upcoming` : "  |  benched"}
                      </Text>
                    </View>
                    {!linkMode && (
                      <View style={s.pActions}>
                        {player.status !== "benched" ? (
                          <TouchableOpacity
                            style={s.pBtnWarn}
                            onPress={() => handleMarkNotPlaying(player)}
                          >
                            <Text style={s.pBtnText}>Sit</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.pBtnGreen}
                            onPress={async () => {
                              await updatePlayerStatus(player.id, "active");
                              const freshData = await getFullGameData(gameId);
                              setGameData(freshData);
                              await regenerateFutureRotations();
                              Alert.alert("Activated", `${player.name} added back to rotations.`);
                            }}
                          >
                            <Text style={s.pBtnText}>Activate</Text>
                          </TouchableOpacity>
                        )}
                        {player.friend_group != null ? (
                          <TouchableOpacity
                            style={s.pBtnDanger}
                            onPress={async () => {
                              await unlinkPlayer(player.id);
                              await regenerateFutureRotations();
                              const freshData = await getFullGameData(gameId);
                              setGameData(freshData);
                              Alert.alert("Unlinked", `${player.name} is now independent.`);
                            }}
                          >
                            <Text style={s.pBtnText}>Unlink</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.pBtnDanger}
                            onPress={() => handleRemovePlayer(player)}
                          >
                            <Text style={s.pBtnText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={schedule}
        keyExtractor={(item) => item.id.toString()}
        style={s.list}
        contentContainerStyle={s.listContent}
        renderItem={({ item, index }) => (
          <RotationCard
            rotation={item}
            isActive={gameStatus === "in_progress" && index === currentRotation - 1}
            isCompleted={gameStatus === "completed" || index < currentRotation - 1}
          />
        )}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 500);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  loadingWrap: { flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#FFF", fontSize: 17 },
  header: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  gameName: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 4 },
  timerWrap: { alignItems: "center", marginBottom: 12 },
  timer: { fontSize: 56, fontWeight: "bold", color: "#FFF", letterSpacing: 4 },
  timerSub: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  progressBg: { width: "100%", backgroundColor: "#334155", height: 5, borderRadius: 3, marginBottom: 12 },
  progressFill: { backgroundColor: "#F97316", height: 5, borderRadius: 3 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  stat: { alignItems: "center" },
  statLabel: { color: "#94A3B8", fontSize: 11 },
  statValue: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  btnRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12 },
  btnHalf: { flex: 1 },
  btnGreen: { backgroundColor: "#16A34A" },
  btnYellow: { backgroundColor: "#CA8A04" },
  btnBlue: { backgroundColor: "#2563EB" },
  btnOrange: { backgroundColor: "#F97316" },
  btnText: { color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  manageBtn: {
    backgroundColor: "#334155",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
  },
  manageBtnText: { color: "#FB923C", textAlign: "center", fontWeight: "bold", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  modalClose: { color: "#FB923C", fontSize: 16, fontWeight: "600" },
  addRow: { flexDirection: "row", padding: 12, gap: 8 },
  addInput: {
    flex: 1,
    backgroundColor: "#0F172A",
    color: "#FFF",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
  },
  addBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addActive: { backgroundColor: "#16A34A" },
  addDisabled: { backgroundColor: "#475569" },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  playerList: { paddingHorizontal: 12 },
  pRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  pInfo: { flex: 1 },
  pName: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  pSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  pActions: { flexDirection: "row", gap: 6 },
  pBtnWarn: { backgroundColor: "#CA8A04", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnGreen: { backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnDanger: { backgroundColor: "#DC2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  pRowSelected: { backgroundColor: "#1E3A5F", borderWidth: 2, borderColor: "#3B82F6" },
  pRowLinked: { borderLeftWidth: 3, borderLeftColor: "#FB923C" },
  linkBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  linkHint: { color: "#94A3B8", fontSize: 13 },
  linkBtn: { backgroundColor: "#1E293B", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#FB923C" },
  linkBtnReady: { backgroundColor: "#FB923C" },
  linkBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  cancelBtn: { backgroundColor: "#334155", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  cancelBtnText: { color: "#94A3B8", fontWeight: "bold", fontSize: 13 },
  groupBadge: { backgroundColor: "#FB923C", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  groupBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  list: { flex: 1 },
  listContent: { padding: 16 },
});
