import { useEffect } from "react";
import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import Animated, {
  FadeIn,
  FadeInRight,
  ZoomIn,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// #5 — a soft border-glow that breathes while the rotation is on court.
function ActiveGlow() {
  const glow = useSharedValue(0.35);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(glow);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View pointerEvents="none" style={[s.glow, style]} />;
}

// A player chip for the upcoming ("Next") rotation that gently sways left↔right
// so the next group on deck draws the eye. Each chip is phase-offset by its
// index, giving the row a soft wave instead of moving in lockstep.
function SwayChip({ children, style, delay }) {
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
    return () => cancelAnimation(sway);
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (sway.value * 2 - 1) * 6 }],
  }));
  return <Animated.View style={[style, aStyle]}>{children}</Animated.View>;
}

export default function RotationCard({ rotation, isActive, isNext, isCompleted, onBenchPlayer, highlightedPlayerIds = [] }) {
  const [selectedId, setSelectedId] = useState(null);
  const borderColor = isActive
    ? "#F97316"
    : isCompleted
      ? "#15803D"
      : "#334155";
  const canBench = !!onBenchPlayer && !isCompleted;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[
        s.card,
        { borderColor },
        isActive && s.cardActive,
        !isActive && s.cardShadow,
      ]}
    >
      {isActive && <ActiveGlow />}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Text style={s.rotTitle}>Rotation {rotation.rotationNumber || rotation.rotation_number}</Text>
          {isActive && (
            <Animated.View entering={ZoomIn.duration(300).springify()} style={[s.statusBadge, { backgroundColor: "#F97316" }]}>
              <Text style={s.statusText}>PLAYING</Text>
            </Animated.View>
          )}
          {isCompleted && (
            <Animated.View entering={ZoomIn.duration(300).springify()} style={[s.statusBadge, { backgroundColor: "#15803D" }]}>
              <Text style={s.statusText}>DONE</Text>
            </Animated.View>
          )}
        </View>
        <Text style={s.countText}>{rotation.players.length} players</Text>
      </View>

      <View style={s.playersWrap}>
        {rotation.players.map((player, chipIndex) => {
          const isSelected = canBench && selectedId === player.id;
          const isHighlighted = highlightedPlayerIds.includes(player.id);
          const chipStyle = [
            s.playerChip,
            isActive
              ? s.chipActive
              : isCompleted
                ? s.chipDone
                : s.chipDefault,
            isSelected && s.chipRemove,
            isHighlighted && s.chipHighlight,
          ];
          const textStyle = [
            s.chipText,
            isActive
              ? s.chipTextActive
              : isCompleted
                ? s.chipTextDone
                : s.chipTextDefault,
            isSelected && s.chipTextRemove,
            isHighlighted && s.chipTextHighlight,
          ];

          if (canBench) {
            if (isSelected) {
              return (
                <View key={player.id} style={[chipStyle, s.chipExpanded]}>
                  <Text style={[s.chipText, s.chipTextRemove, { marginBottom: 6 }]}>
                    {player.name}
                  </Text>
                  <View style={s.chipBtnRow}>
                    <TouchableOpacity
                      style={s.chipBtnRemove}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedId(null);
                        onBenchPlayer(player);
                      }}
                    >
                      <Text style={s.chipBtnRemoveText}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.chipBtnCancel}
                      activeOpacity={0.7}
                      onPress={() => setSelectedId(null)}
                    >
                      <Text style={s.chipBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={player.id}
                style={chipStyle}
                activeOpacity={0.7}
                onPress={() => setSelectedId(player.id)}
              >
                <Text style={textStyle}>
                  #{player.jersey_number} {player.name}
                </Text>
              </TouchableOpacity>
            );
          }

          if (isNext) {
            return (
              <SwayChip key={player.id} style={chipStyle} delay={chipIndex * 90}>
                <Text style={textStyle}>
                  #{player.jersey_number} {player.name}
                </Text>
              </SwayChip>
            );
          }

          return (
            <Animated.View
              key={player.id}
              entering={
                isHighlighted
                  ? ZoomIn.duration(350).springify().damping(12)
                  : FadeInRight.delay(chipIndex * 40).duration(300)
              }
              layout={Layout.springify().damping(16)}
              style={chipStyle}
            >
              <Text style={textStyle}>
                #{player.jersey_number} {player.name}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    backgroundColor: "#1E293B",
  },
  cardShadow: {
    ...Platform.select({
      android: { elevation: 4 },
    }),
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FB923C",
  },
  cardActive: {
    ...Platform.select({
      android: { elevation: 8, borderWidth: 2, backgroundColor: "#1E293B" },
    }),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  rotTitle: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  statusBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  countText: { color: "#94A3B8", fontSize: 13 },
  playersWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  playerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: "rgba(249,115,22,0.15)",
    borderColor: "rgba(249,115,22,0.4)",
  },
  chipDone: {
    backgroundColor: "rgba(21,128,61,0.15)",
    borderColor: "rgba(21,128,61,0.3)",
  },
  chipDefault: { backgroundColor: "#334155", borderColor: "#475569" },
  chipRemove: { backgroundColor: "rgba(220,38,38,0.25)", borderColor: "#DC2626" },
  chipHighlight: { backgroundColor: "rgba(59,130,246,0.2)", borderColor: "#3B82F6", borderWidth: 2 },
  chipText: { fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#FDBA74" },
  chipTextDone: { color: "#4ADE80" },
  chipTextDefault: { color: "#CBD5E1" },
  chipTextRemove: { color: "#FCA5A5", fontWeight: "bold" },
  chipTextHighlight: { color: "#93C5FD", fontWeight: "bold" },
  chipExpanded: {
    backgroundColor: "rgba(220,38,38,0.15)",
    borderColor: "#DC2626",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipBtnRow: { flexDirection: "row", gap: 6 },
  chipBtnRemove: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipBtnRemoveText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  chipBtnCancel: {
    backgroundColor: "#475569",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipBtnCancelText: { color: "#CBD5E1", fontSize: 12, fontWeight: "bold" },
});
