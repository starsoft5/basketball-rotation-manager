import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  FadeOut,
  ZoomIn,
  ZoomOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
import { addPlayer, getPlayers, updateGameStatus, deletePlayer, getSettings } from "../../db/database";
import AnimatedButton from "../../components/AnimatedButton";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AVATAR_COLORS = ["#F97316", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#EAB308", "#EF4444", "#06B6D4"];
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
import { calcRotations, calcRotationsEqualTime, formatTime } from "../../utils/scheduler";
import * as ImagePicker from "expo-image-picker";
import TextRecognition from "@react-native-ml-kit/text-recognition";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PlayerRow({ item, index, isChecked, onToggle, onRemove }) {
  const checkScale = useSharedValue(1);
  const rowScale = useSharedValue(1);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));

  const handlePress = () => {
    checkScale.value = withSequence(
      withSpring(0.7, { damping: 12, stiffness: 500 }),
      withSpring(1.15, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 14, stiffness: 300 })
    );
    rowScale.value = withSequence(
      withSpring(0.97, { damping: 15, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
    onToggle(item.id);
  };

  const avatarColor = getAvatarColor(item.name);

  return (
    <Animated.View
      entering={SlideInLeft.duration(350).delay(Math.min(index * 50, 500)).springify().damping(16)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(16)}
      style={rowAnimStyle}
    >
      <Pressable
        style={[s.playerRow, isChecked && s.playerRowSelected]}
        onPress={handlePress}
      >
        <View style={s.selectArea}>
          <Animated.View
            style={[
              s.checkbox,
              isChecked && s.checkboxChecked,
              checkAnimStyle,
            ]}
          >
            {isChecked && (
              <Animated.Text
                entering={ZoomIn.duration(200).springify()}
                style={s.checkmark}
              >
                ✓
              </Animated.Text>
            )}
          </Animated.View>
          <View style={[s.jerseyCircle, { backgroundColor: avatarColor }]}>
            <Text style={s.jerseyText}>{item.jersey_number}</Text>
          </View>
          <View style={s.playerInfo}>
            <Text style={s.playerName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.playerSub}>#{item.jersey_number}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [s.removeBtn, pressed && s.removeBtnPressed]}
          onPress={() => onRemove(item)}
          hitSlop={8}
        >
          <Text style={s.removeBtnText}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function PlayerEntryScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [gameTotalMinutes, setGameTotalMinutes] = useState(120);
  const [equalTimeTotalMinutes, setEqualTimeTotalMinutes] = useState(120);
  const [minutesPerGame, setMinutesPerGame] = useState(10);
  const [transitionTotalSeconds, setTransitionTotalSeconds] = useState(120);
  const [distributionMode, setDistributionMode] = useState("unequal_games");
  const [minGamesPerPlayer, setMinGamesPerPlayer] = useState(0);

  useEffect(() => {
    loadPlayers();
    loadSettings();
  }, []);

  const loadPlayers = async () => {
    const existing = await getPlayers(parseInt(gameId, 10));
    setPlayers(existing);
  };

  const loadSettings = async () => {
    const settings = await getSettings();
    setGameTotalMinutes(settings.gameTotalMinutes);
    setEqualTimeTotalMinutes(settings.equalTimeTotalMinutes);
    setMinutesPerGame(settings.minutesPerGame);
    setTransitionTotalSeconds(settings.transitionTotalSeconds);
    setDistributionMode(settings.distributionMode);
    setMinGamesPerPlayer(settings.minGamesPerPlayer || 0);
  };

  const activeTotalMinutes = distributionMode === "equal_time" ? equalTimeTotalMinutes : gameTotalMinutes;
  const transitionMins = transitionTotalSeconds / 60;
  const stats = players.length >= 10
    ? distributionMode === "equal_time"
      ? calcRotationsEqualTime(players.length, activeTotalMinutes, transitionMins)
      : calcRotations(players.length, activeTotalMinutes, minutesPerGame, transitionMins, minGamesPerPlayer)
    : null;

  const handleAddPlayer = async () => {
    if (!playerName.trim()) return;
    const jerseyNumber = players.length + 1;
    await addPlayer(parseInt(gameId, 10), playerName.trim(), jerseyNumber);
    setPlayerName("");
    await loadPlayers();
  };

  const ocrFromUri = async (uri) => {
    const result = await TextRecognition.recognize(uri);

    return result.text
      .split(/[\n\r]+/)
      .map((line) => line
        .replace(/^\d+[\.\)\-\s]*/, "")
        .replace(/^[+@]+/, "")
        .replace(/\*+/g, "")
        .trim()
      )
      .filter((name) => name.length >= 2 && name.length <= 40);
  };

  const handleScanList = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled) return;

      setScanning(true);
      const names = await ocrFromUri(result.assets[0].uri);

      if (names.length === 0) {
        Alert.alert("No Names Found", "Could not detect player names. Try a clearer photo.");
        setScanning(false);
        return;
      }

      for (let i = 0; i < names.length; i++) {
        const jerseyNumber = players.length + i + 1;
        await addPlayer(parseInt(gameId, 10), names[i], jerseyNumber);
      }
      await loadPlayers();
    } catch (err) {
      Alert.alert("Scan Failed", "Could not read the image. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled) return;

      setScanning(true);
      const names = await ocrFromUri(result.assets[0].uri);

      if (names.length === 0) {
        Alert.alert("No Names Found", "Could not detect player names.");
        setScanning(false);
        return;
      }

      for (let i = 0; i < names.length; i++) {
        const jerseyNumber = players.length + i + 1;
        await addPlayer(parseInt(gameId, 10), names[i], jerseyNumber);
      }
      await loadPlayers();
    } catch (err) {
      Alert.alert("Scan Failed", "Could not read the image. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleRemovePlayer = (player) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert("Remove Player", `Remove ${player.name} from the game?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deletePlayer(player.id);
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(player.id); return next; });
          await loadPlayers();
        },
      },
    ]);
  };

  const toggleSelect = (playerId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        if (next.size >= 10) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Alert.alert("Maximum Reached", "Only 10 players can be selected per game.");
          return prev;
        }
        next.add(playerId);
      }
      return next;
    });
  };

  const handleStartGame = async () => {
    if (selectedIds.size < 10) {
      Alert.alert("Error", `Select 10 players to start. (${selectedIds.size} selected)`);
      return;
    }
    await updateGameStatus(parseInt(gameId, 10), "ready");
    const ids = Array.from(selectedIds).join(",");
    router.replace(`/game/${gameId}?firstRotation=${ids}`);
  };

  const progressPercent = Math.min(selectedIds.size / 10, 1);

  return (
    <View style={s.flex}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={s.headerCard}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerText}>Players</Text>
              <Text style={s.headerCount}>{players.length} registered</Text>
            </View>
            <Animated.View
              key={`badge-${selectedIds.size}`}
              entering={ZoomIn.duration(250).springify()}
              style={[
                s.badge,
                players.length >= 10 && selectedIds.size === 10 && s.badgeReady,
              ]}
            >
              <Text style={[
                s.badgeText,
                players.length >= 10 && selectedIds.size === 10 && s.badgeTextReady,
              ]}>
                {players.length < 10 ? `Need ${10 - players.length} more` : `${selectedIds.size}/10`}
              </Text>
            </Animated.View>
          </View>
          {players.length >= 10 && (
            <Animated.View entering={FadeIn.duration(300)} style={s.progressBarOuter}>
              <Animated.View
                style={[
                  s.progressBarInner,
                  {
                    width: `${progressPercent * 100}%`,
                    backgroundColor: selectedIds.size === 10 ? "#16A34A" : "#3B82F6",
                  },
                ]}
              />
            </Animated.View>
          )}
        </Animated.View>

        {/* Stats Card */}
        {stats && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.statsCard}>
            <View style={s.statsHeader}>
              <View style={s.statsDot} />
              <Text style={s.statsTitle}>Game Preview</Text>
            </View>
            <Text style={s.statsText}>
              {`${stats.totalGames} rotations  ·  ${formatTime(Math.round(stats.minutesPerRotation * 60))} each`}
            </Text>
            {transitionTotalSeconds > 0 && (
              <Text style={[s.statsText, s.statsSecondary]}>
                {`${formatTime(transitionTotalSeconds)} transition  ·  ${Math.round(stats.totalWithTransitions)} min total`}
              </Text>
            )}
            {stats.adjusted && (
              <Text style={[s.statsText, s.statsWarning]}>
                {`Adjusted to ${stats.minutesPerRotation} min/rotation for ${minGamesPerPlayer}+ games`}
              </Text>
            )}
            <View style={s.statsDivider} />
            <Text style={s.statsHighlight}>
              {(() => {
                const minMin = Math.round(stats.minPlays * stats.minutesPerRotation);
                if (stats.isEven) return `${stats.minPlays} games × ${formatTime(Math.round(stats.minutesPerRotation * 60))} = ${minMin} min per player`;
                const maxMin = Math.round(stats.maxPlays * stats.minutesPerRotation);
                const extraSlots = stats.totalGames * 10 - players.length * stats.minPlays;
                return `${players.length - extraSlots} play ${stats.minPlays}× (${minMin} min)  ·  ${extraSlots} play ${stats.maxPlays}× (${maxMin} min)`;
              })()}
            </Text>
          </Animated.View>
        )}

        {/* Input Row */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={s.inputCard}>
          <View style={s.inputRow}>
            <TextInput
              style={s.nameInput}
              placeholder={`Player ${players.length + 1} name`}
              placeholderTextColor="#64748B"
              value={playerName}
              onChangeText={setPlayerName}
              onSubmitEditing={handleAddPlayer}
              returnKeyType="done"
            />
            <AnimatedButton
              style={[s.addBtn, playerName.trim() ? s.addActive : s.addDisabled]}
              onPress={handleAddPlayer}
              disabled={!playerName.trim()}
            >
              <Text style={s.addBtnText}>+</Text>
            </AnimatedButton>
          </View>
        </Animated.View>

        {/* Scan Buttons */}
        {scanning ? (
          <Animated.View entering={FadeIn.duration(300)} style={s.scanningWrap}>
            <ActivityIndicator size="large" color="#FB923C" />
            <Text style={s.scanningText}>Reading player names...</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.scanRow}>
            <AnimatedButton style={s.scanBtn} onPress={handleScanList}>
              <Text style={s.scanIcon}>📷</Text>
              <Text style={s.scanBtnText}>Scan List</Text>
            </AnimatedButton>
            <AnimatedButton style={s.scanBtn} onPress={handlePickImage}>
              <Text style={s.scanIcon}>🖼️</Text>
              <Text style={s.scanBtnText}>Pick Photo</Text>
            </AnimatedButton>
          </Animated.View>
        )}

        {/* Section Label */}
        {players.length > 0 && (
          <Animated.View entering={FadeIn.duration(300).delay(250)} style={s.sectionRow}>
            <View style={s.sectionLine} />
            <Text style={s.sectionLabel}>ROSTER</Text>
            <View style={s.sectionLine} />
          </Animated.View>
        )}

        {/* Player List */}
        {players.length === 0 ? (
          <Animated.View entering={FadeIn.duration(500).delay(300)} style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🏀</Text>
            <Text style={s.emptyTitle}>No players yet</Text>
            <Text style={s.emptyText}>Type a name above or scan a list to add players</Text>
          </Animated.View>
        ) : (
          players.map((item, index) => (
            <PlayerRow
              key={item.id}
              item={item}
              index={index}
              isChecked={selectedIds.has(item.id)}
              onToggle={toggleSelect}
              onRemove={handleRemovePlayer}
            />
          ))
        )}

      </ScrollView>

      {/* Bottom Bar */}
      {players.length >= 10 && (
        <Animated.View entering={FadeInUp.duration(400).springify()} style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}>
          <View style={s.bottomInfo}>
            <Text style={s.bottomLabel}>Selected</Text>
            <Text style={s.bottomCount}>
              <Text style={selectedIds.size === 10 ? s.bottomCountReady : s.bottomCountPending}>
                {selectedIds.size}
              </Text>
              /10
            </Text>
          </View>
          <AnimatedButton
            style={[
              s.bottomBtn,
              selectedIds.size === 10 ? s.startReady : s.startDisabled,
            ]}
            onPress={handleStartGame}
            disabled={selectedIds.size !== 10}
          >
            <Text style={[s.bottomBtnText, selectedIds.size !== 10 && s.bottomBtnTextDisabled]}>
              {selectedIds.size === 10 ? "Start Game →" : `Need ${10 - selectedIds.size} more`}
            </Text>
          </AnimatedButton>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0F172A" },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 130 },

  // Header Card
  headerCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  headerCount: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: "rgba(251,146,60,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.3)",
  },
  badgeReady: {
    backgroundColor: "rgba(22,163,74,0.15)",
    borderColor: "rgba(22,163,74,0.4)",
  },
  badgeText: { color: "#FB923C", fontWeight: "700", fontSize: 14 },
  badgeTextReady: { color: "#16A34A" },
  progressBarOuter: {
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBarInner: {
    height: 4,
    borderRadius: 2,
  },

  // Stats Card
  statsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FB923C",
    marginRight: 8,
  },
  statsTitle: { color: "#FB923C", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  statsText: { color: "#CBD5E1", fontSize: 13, textAlign: "center" },
  statsSecondary: { marginTop: 4, fontSize: 12, color: "#94A3B8" },
  statsWarning: { marginTop: 4, fontSize: 12, color: "#FB923C" },
  statsDivider: { height: 1, backgroundColor: "#334155", marginVertical: 8 },
  statsHighlight: { color: "#34D399", fontSize: 13, textAlign: "center", fontWeight: "500" },

  // Input
  inputCard: { marginBottom: 10 },
  inputRow: { flexDirection: "row" },
  nameInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    color: "#FFF",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: "#475569",
  },
  addBtn: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  addActive: { backgroundColor: "#F97316" },
  addDisabled: { backgroundColor: "#475569" },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 22 },

  // Scan Buttons
  scanRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: "#1E293B",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#475569",
    alignItems: "center",
  },
  scanIcon: { fontSize: 18, marginBottom: 4 },
  scanBtnText: {
    color: "#CBD5E1",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 13,
  },
  scanningWrap: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 14,
  },
  scanningText: {
    color: "#FB923C",
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
  },

  // Section Divider
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#334155",
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginHorizontal: 12,
  },

  // Player Row
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    paddingRight: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#2D3B4F",
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3 },
    }),
  },
  selectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingVertical: 12,
    minHeight: 58,
  },
  playerRowSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4B5C73",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  checkmark: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  jerseyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jerseyText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  playerInfo: { flex: 1 },
  playerName: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  playerSub: { color: "#64748B", fontSize: 11, marginTop: 1 },
  removeBtn: {
    width: 28,
    height: 28,
    backgroundColor: "rgba(220,38,38,0.15)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.3)",
  },
  removeBtnPressed: {
    backgroundColor: "rgba(220,38,38,0.4)",
  },
  removeBtnText: { color: "#EF4444", fontWeight: "bold", fontSize: 12 },

  // Empty State
  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: "#94A3B8", fontSize: 17, fontWeight: "600", marginBottom: 6 },
  emptyText: { color: "#64748B", fontSize: 14, textAlign: "center", paddingHorizontal: 40 },

  // Bottom Bar
  startReady: { backgroundColor: "#16A34A" },
  startDisabled: { backgroundColor: "#334155" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 14,
    ...Platform.select({
      android: { elevation: 8 },
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.2, shadowRadius: 6 },
    }),
  },
  bottomInfo: { alignItems: "center", minWidth: 70 },
  bottomLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  bottomCount: { color: "#94A3B8", fontSize: 22, fontWeight: "bold" },
  bottomCountReady: { color: "#16A34A" },
  bottomCountPending: { color: "#FB923C" },
  bottomBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
  },
  bottomBtnText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "bold",
  },
  bottomBtnTextDisabled: {
    color: "#94A3B8",
  },
});
