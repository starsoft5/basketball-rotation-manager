import { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, Alert, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { getAllGames, deleteGame } from "../db/database";
import AnimatedButton from "../components/AnimatedButton";
import AnimatedCounter from "../components/AnimatedCounter";
import BouncingBall from "../components/BouncingBall";
import * as Haptics from "expo-haptics";

const COLORS = {
  bg: "#0F172A",
  card: "#1E293B",
  cardAlt: "#263348",
  border: "#334155",
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  accent: "#FB923C",
};

const STATUS = {
  completed: { color: "#22C55E", label: "COMPLETED", glyph: "✓" },
  in_progress: { color: "#F97316", label: "LIVE", glyph: "●" },
  ready: { color: "#3B82F6", label: "READY", glyph: "▶" },
  setup: { color: "#64748B", label: "SETUP", glyph: "✎" },
};

const statusOf = (s) => STATUS[s] || STATUS.setup;

// Parse the sqlite "YYYY-MM-DD HH:MM:SS" localtime string into a friendly,
// relative label so the list reads like a feed instead of raw timestamps.
function relativeDate(raw) {
  if (!raw) return "";
  const iso = raw.replace(" ", "T");
  const then = new Date(iso);
  if (isNaN(then.getTime())) return raw;
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);
  const time = then.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  return then.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// current_rotation is a live pointer; completed games are shown as fully run.
function progressOf(item) {
  const total = item.total_rotations || 0;
  if (total === 0) return { current: 0, total: 0, frac: 0, ready: false };
  const current =
    item.status === "completed"
      ? total
      : Math.max(0, Math.min(item.current_rotation || 0, total));
  return { current, total, frac: current / total, ready: true };
}

function LiveDot({ color }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[s.liveDot, { backgroundColor: color }, style]} />;
}

function ProgressBar({ frac, color, delay }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      delay,
      withTiming(frac, { duration: 850, easing: Easing.out(Easing.cubic) })
    );
  }, [frac]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.progressTrack}>
      <Animated.View style={[s.progressFill, { backgroundColor: color }, style]} />
    </View>
  );
}

function GameCard({ item, index, onPress, onDelete }) {
  const st = statusOf(item.status);
  const prog = progressOf(item);
  const delay = Math.min(index * 60, 600);
  const isLive = item.status === "in_progress";

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(350)}
      exiting={FadeOut.duration(220)}
      layout={LinearTransition.springify().damping(18)}
    >
      <AnimatedButton style={s.card} onPress={onPress} onLongPress={onDelete}>
        <View style={[s.stripe, { backgroundColor: st.color }]} />
        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[s.statusBadge, { backgroundColor: st.color + "22", borderColor: st.color }]}>
              {isLive ? (
                <LiveDot color={st.color} />
              ) : (
                <Text style={[s.statusGlyph, { color: st.color }]}>{st.glyph}</Text>
              )}
              <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <Text style={s.metaIcon}>👥</Text>
            <AnimatedCounter value={item.total_players} style={s.metaStrong} />
            <Text style={s.metaText}> players</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.metaIcon}>🔄</Text>
            <Text style={s.metaText}>
              {prog.ready ? `${prog.current}/${prog.total} rotations` : "Not scheduled yet"}
            </Text>
          </View>

          {prog.ready && <ProgressBar frac={prog.frac} color={st.color} delay={delay + 150} />}

          <Text style={s.dateText}>{relativeDate(item.created_at)}</Text>
        </View>
      </AnimatedButton>
    </Animated.View>
  );
}

function SummaryHeader({ games }) {
  const total = games.length;
  const completed = games.filter((g) => g.status === "completed").length;
  const players = games.reduce((sum, g) => sum + (g.total_players || 0), 0);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.summary}>
      <View style={s.summaryTile}>
        <AnimatedCounter value={total} style={s.summaryNum} />
        <Text style={s.summaryLabel}>Games</Text>
      </View>
      <View style={s.summaryDivider} />
      <View style={s.summaryTile}>
        <AnimatedCounter value={completed} style={[s.summaryNum, { color: STATUS.completed.color }]} />
        <Text style={s.summaryLabel}>Completed</Text>
      </View>
      <View style={s.summaryDivider} />
      <View style={s.summaryTile}>
        <AnimatedCounter value={players} style={s.summaryNum} />
        <Text style={s.summaryLabel}>Players</Text>
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [])
  );

  const loadGames = async () => {
    const allGames = await getAllGames();
    setGames(allGames);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const handleDelete = (gameId, gameName) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert("Delete Game", `Delete "${gameName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteGame(gameId);
          await loadGames();
        },
      },
    ]);
  };

  const openGame = (item) => {
    if (item.status === "setup") {
      router.push(`/players/${item.id}?count=${item.total_players}`);
    } else {
      router.push(`/game/${item.id}`);
    }
  };

  return (
    <View style={s.container}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={games.length > 0 ? <SummaryHeader games={games} /> : null}
        renderItem={({ item, index }) => (
          <GameCard
            item={item}
            index={index}
            onPress={() => openGame(item)}
            onDelete={() => handleDelete(item.id, item.name)}
          />
        )}
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.duration(500)} style={s.emptyWrap}>
            <BouncingBall size={64} mode="idle" />
            <Text style={s.emptyTitle}>No games yet</Text>
            <Text style={s.emptyText}>Start a new game from the home screen and it'll show up here.</Text>
          </Animated.View>
        }
      />
      {games.length > 0 && <Text style={s.hint}>Long press a game to delete it</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20, paddingTop: 12 },
  listContent: { paddingBottom: 8 },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    marginBottom: 18,
  },
  summaryTile: { flex: 1, alignItems: "center" },
  summaryNum: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, letterSpacing: 0.3 },
  summaryDivider: { width: 1, height: 32, backgroundColor: COLORS.border },

  card: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { color: COLORS.text, fontWeight: "bold", fontSize: 17, flex: 1, marginRight: 10 },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusGlyph: { fontSize: 10, fontWeight: "bold", marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },

  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  metaIcon: { fontSize: 12, marginRight: 5 },
  metaStrong: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  metaText: { color: COLORS.textSecondary, fontSize: 13 },
  metaDot: { color: COLORS.textMuted, fontSize: 13, marginHorizontal: 8 },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cardAlt,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: { height: "100%", borderRadius: 3 },

  dateText: { color: COLORS.textMuted, fontSize: 11 },

  emptyWrap: { alignItems: "center", paddingVertical: 72, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },

  hint: { color: COLORS.textMuted, fontSize: 11, textAlign: "center", paddingVertical: 12 },
});
