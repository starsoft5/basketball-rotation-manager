import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { getFullGameData } from "../../db/database";
import AnimatedButton from "../../components/AnimatedButton";
import AnimatedCounter from "../../components/AnimatedCounter";
import BouncingBall from "../../components/BouncingBall";

export default function SummaryScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams();
  const id = parseInt(gameId, 10);

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rotations, setRotations] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    const data = await getFullGameData(id);
    if (!data) return;
    setGame(data.game);
    setRotations(data.rotations);

    const sorted = [...data.players].sort((a, b) => {
      if (a.status === "benched" && b.status !== "benched") return 1;
      if (a.status !== "benched" && b.status === "benched") return -1;
      return (b.times_played || 0) - (a.times_played || 0);
    });
    setPlayers(sorted);
  };

  if (!game) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <BouncingBall size={52} mode="bounce" style={{ marginBottom: 14 }} />
        <Text style={[s.loadingText, { marginTop: 0 }]}>Loading summary...</Text>
      </View>
    );
  }

  const completedRotations = rotations.filter((r) => r.status === "completed").length;
  const activePlayers = players.filter((p) => p.status !== "benched");

  const maxTimesPlayed = Math.max(...activePlayers.map((p) => p.times_played || 0), 1);
  const maxTotalTime = Math.max(...activePlayers.map((p) => p.total_play_time || 0), 0);
  const minutesPerRotation = maxTimesPlayed > 0 ? Math.round(maxTotalTime / maxTimesPlayed) : 0;
  const totalPlayMinutes = completedRotations * minutesPerRotation;

  const completedRots = rotations
    .filter((r) => r.started_at && r.ended_at)
    .sort((a, b) => a.rotation_number - b.rotation_number);
  let totalBreakSeconds = 0;
  for (let i = 1; i < completedRots.length; i++) {
    const prevEnd = new Date(completedRots[i - 1].ended_at.replace(" ", "T")).getTime();
    const start = new Date(completedRots[i].started_at.replace(" ", "T")).getTime();
    totalBreakSeconds += Math.max(0, (start - prevEnd) / 1000);
  }
  const breakMinutes = Math.round(totalBreakSeconds / 60);

  const activePlayTimes = activePlayers.map((p) => p.total_play_time || 0);
  const maxPlayTime = activePlayTimes.length > 0 ? Math.max(...activePlayTimes) : 0;
  const minPlayTime = activePlayTimes.length > 0 ? Math.min(...activePlayTimes) : 0;
  const spread = maxPlayTime - minPlayTime;

  const formatDuration = (minutes) => {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  const renderPlayer = ({ item, index }) => {
    const isBenched = item.status === "benched";
    const isTop = !isBenched && (item.total_play_time || 0) === maxPlayTime && activePlayers.length > 1;
    const isBottom = !isBenched && (item.total_play_time || 0) === minPlayTime && activePlayers.length > 1 && spread > 0;

    return (
      <Animated.View
        entering={FadeInDown.duration(350).delay(450 + index * 45)}
        style={[s.playerRow, isBenched && s.playerRowBenched]}
      >
        <Text style={[s.playerRank, isBenched && s.textMuted]}>{index + 1}</Text>
        <View style={s.playerJersey}>
          <Text style={[s.jerseyText, isBenched && s.textMuted]}>
            #{item.jersey_number ?? "—"}
          </Text>
        </View>
        <View style={s.playerInfo}>
          <Text style={[s.playerName, isBenched && s.textMuted]} numberOfLines={1}>
            {isTop ? "🏆 " : ""}{item.name}
            {isBenched ? " (Benched)" : ""}
          </Text>
        </View>
        <View style={s.playerStats}>
          <Text style={[s.statValue, isTop && s.statTop, isBottom && s.statBottom]}>
            {item.times_played || 0}x
          </Text>
          <Text style={[s.statLabel, isBenched && s.textMuted]}>
            {item.total_play_time || 0}m
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Animated.View entering={FadeInDown.duration(400)} style={s.titleRow}>
        <Text style={s.gameTitle} numberOfLines={2}>{game.name}</Text>
        <Animated.View entering={ZoomIn.duration(400).delay(200).springify()} style={s.statusBadge}>
          <Text style={s.statusText}>
            {game.status === "completed" ? "COMPLETED" : game.status?.toUpperCase()}
          </Text>
        </Animated.View>
      </Animated.View>
      <Text style={s.dateText}>{game.created_at}</Text>

      <View style={s.statsGrid}>
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.statCard}>
          <AnimatedCounter value={completedRotations} style={s.statCardValue} />
          <Text style={s.statCardLabel}>🔄 Rotations</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(400).delay(180)} style={s.statCard}>
          <Text style={s.statCardValue}>{formatDuration(totalPlayMinutes)}</Text>
          <Text style={s.statCardLabel}>⏱ Play Time</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(400).delay(260)} style={s.statCard}>
          <Text style={s.statCardValue}>{formatDuration(breakMinutes)}</Text>
          <Text style={s.statCardLabel}>☕ Break Time</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(400).delay(340)} style={s.statCard}>
          <AnimatedCounter value={players.length} style={s.statCardValue} />
          <Text style={s.statCardLabel}>👥 Players</Text>
        </Animated.View>
      </View>

      {activePlayers.length > 1 && (
        <Animated.View entering={FadeInDown.duration(400).delay(420)} style={s.fairnessCard}>
          <Text style={s.fairnessTitle}>Fairness</Text>
          <Text style={s.fairnessValue}>
            {spread === 0
              ? "All active players had equal play time"
              : `Play time spread: ${spread} min between most and least played`}
          </Text>
        </Animated.View>
      )}

      <View style={s.playerSection}>
        <View style={s.playerHeader}>
          <Text style={s.sectionTitle}>Player Stats</Text>
          <Text style={s.headerLabels}>Played  Time</Text>
        </View>
        <FlatList
          data={players}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPlayer}
          scrollEnabled={false}
        />
      </View>

      <View style={s.actions}>
        <AnimatedButton
          style={[s.actionBtn, s.actionBtnPrimary]}
          onPress={() => router.replace("/")}
        >
          <Text style={s.actionBtnText}>Go Home</Text>
        </AnimatedButton>
        <AnimatedButton
          style={[s.actionBtn, s.actionBtnSecondary]}
          onPress={() => router.push("/history")}
        >
          <Text style={s.actionBtnText}>View History</Text>
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  loadingText: { color: "#94A3B8", fontSize: 16, textAlign: "center", marginTop: 64 },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  gameTitle: { color: "#FFF", fontSize: 22, fontWeight: "bold", flex: 1, marginRight: 12 },
  statusBadge: {
    backgroundColor: "#15803D",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  dateText: { color: "#64748B", fontSize: 13, marginBottom: 20 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statCardValue: { color: "#F97316", fontSize: 22, fontWeight: "bold" },
  statCardLabel: { color: "#94A3B8", fontSize: 12, marginTop: 4 },

  fairnessCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  fairnessTitle: { color: "#FB923C", fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  fairnessValue: { color: "#CBD5E1", fontSize: 13 },

  playerSection: { marginBottom: 24 },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { color: "#FFF", fontSize: 17, fontWeight: "bold" },
  headerLabels: { color: "#64748B", fontSize: 12 },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  playerRowBenched: { opacity: 0.5 },
  playerRank: { color: "#64748B", fontSize: 13, width: 24, textAlign: "center" },
  playerJersey: { marginRight: 10 },
  jerseyText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  playerInfo: { flex: 1 },
  playerName: { color: "#FFF", fontSize: 15 },
  playerStats: { flexDirection: "row", gap: 16, alignItems: "center" },
  statValue: { color: "#F97316", fontSize: 15, fontWeight: "bold", width: 36, textAlign: "right" },
  statTop: { color: "#16A34A" },
  statBottom: { color: "#EF4444" },
  statLabel: { color: "#94A3B8", fontSize: 13, width: 36, textAlign: "right" },
  textMuted: { color: "#475569" },

  actions: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  actionBtnPrimary: { backgroundColor: "#F97316" },
  actionBtnSecondary: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});
