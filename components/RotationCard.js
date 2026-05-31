import { View, Text, StyleSheet, Platform } from "react-native";

export default function RotationCard({ rotation, isActive, isCompleted }) {
  const borderColor = isActive
    ? "#F97316"
    : isCompleted
      ? "#15803D"
      : "#334155";

  return (
    <View style={[
      s.card,
      { borderColor },
      isActive && s.cardActive,
      !isActive && s.cardShadow,
    ]}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Text style={s.rotTitle}>Rotation {rotation.rotationNumber}</Text>
          {isActive && (
            <View style={[s.statusBadge, { backgroundColor: "#F97316" }]}>
              <Text style={s.statusText}>PLAYING</Text>
            </View>
          )}
          {isCompleted && (
            <View style={[s.statusBadge, { backgroundColor: "#15803D" }]}>
              <Text style={s.statusText}>DONE</Text>
            </View>
          )}
        </View>
        <Text style={s.countText}>{rotation.players.length} players</Text>
      </View>

      <View style={s.playersWrap}>
        {rotation.players.map((player) => (
          <View
            key={player.id}
            style={[
              s.playerChip,
              isActive
                ? s.chipActive
                : isCompleted
                  ? s.chipDone
                  : s.chipDefault,
            ]}
          >
            <Text
              style={[
                s.chipText,
                isActive
                  ? s.chipTextActive
                  : isCompleted
                    ? s.chipTextDone
                    : s.chipTextDefault,
              ]}
            >
              #{player.jersey_number} {player.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    backgroundColor: "#1E293B",
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardActive: {
    ...Platform.select({
      ios: {
        shadowColor: "#F97316",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
        borderWidth: 2,
        backgroundColor: "#1E293B",
      },
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
  chipText: { fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#FDBA74" },
  chipTextDone: { color: "#4ADE80" },
  chipTextDefault: { color: "#CBD5E1" },
});
