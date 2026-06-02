import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { Rect, Circle, Path, Line } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";

const COURT_W = 320;
const COURT_H = 200;
const POSITIONS = [
  { x: 160, y: 30 },
  { x: 260, y: 50 },
  { x: 270, y: 130 },
  { x: 160, y: 160 },
  { x: 60, y: 50 },
  { x: 50, y: 130 },
  { x: 100, y: 80 },
  { x: 220, y: 80 },
  { x: 130, y: 140 },
  { x: 190, y: 140 },
];

export default function CourtDiagram({ onCourtPlayers = [], benchPlayers = [] }) {
  const { colors, isDark } = useTheme();
  const courtBg = isDark ? "#1a2a1a" : "#C4A265";
  const lineColor = isDark ? "#4a6a4a" : "#FFFFFF";
  const courtBorder = isDark ? "#334155" : "#8B7355";

  return (
    <View style={[s.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.title, { color: colors.textSecondary }]}>On Court</Text>
      <View style={s.courtWrap}>
        <Svg width={COURT_W} height={COURT_H} viewBox={`0 0 ${COURT_W} ${COURT_H}`}>
          <Rect x={5} y={5} width={COURT_W - 10} height={COURT_H - 10} rx={4} fill={courtBg} stroke={courtBorder} strokeWidth={2} />
          <Line x1={160} y1={5} x2={160} y2={195} stroke={lineColor} strokeWidth={1} opacity={0.5} />
          <Circle cx={160} cy={100} r={30} stroke={lineColor} strokeWidth={1.5} fill="none" opacity={0.6} />
          <Rect x={5} y={55} width={60} height={90} rx={2} stroke={lineColor} strokeWidth={1.5} fill="none" opacity={0.5} />
          <Rect x={255} y={55} width={60} height={90} rx={2} stroke={lineColor} strokeWidth={1.5} fill="none" opacity={0.5} />
          <Path d={`M 5 70 Q 35 100 5 130`} stroke={lineColor} strokeWidth={1.5} fill="none" opacity={0.4} />
          <Path d={`M 315 70 Q 285 100 315 130`} stroke={lineColor} strokeWidth={1.5} fill="none" opacity={0.4} />
          <Circle cx={25} cy={100} r={4} fill={lineColor} opacity={0.5} />
          <Circle cx={295} cy={100} r={4} fill={lineColor} opacity={0.5} />

          {onCourtPlayers.slice(0, 10).map((player, i) => {
            const pos = POSITIONS[i] || { x: 160, y: 100 };
            const isTeamA = i < 5;
            const fillColor = isTeamA ? "#F97316" : "#3B82F6";
            return (
              <Circle
                key={player.id}
                cx={pos.x}
                cy={pos.y}
                r={14}
                fill={fillColor}
                stroke="#FFF"
                strokeWidth={1.5}
                opacity={0.9}
              />
            );
          })}
        </Svg>

        {onCourtPlayers.slice(0, 10).map((player, i) => {
          const pos = POSITIONS[i] || { x: 160, y: 100 };
          return (
            <View key={player.id} style={[s.playerLabel, { left: pos.x - 20, top: pos.y - 8 }]} pointerEvents="none">
              <Text style={s.playerNum}>{player.jersey_number}</Text>
            </View>
          );
        })}

        {onCourtPlayers.slice(0, 10).map((player, i) => {
          const pos = POSITIONS[i] || { x: 160, y: 100 };
          return (
            <View key={`name-${player.id}`} style={[s.nameLabel, { left: pos.x - 28, top: pos.y + 8 }]} pointerEvents="none">
              <Text style={s.nameText} numberOfLines={1}>{player.name.split(" ")[0]}</Text>
            </View>
          );
        })}
      </View>

      {benchPlayers.length > 0 && (
        <View style={s.benchSection}>
          <Text style={[s.benchTitle, { color: colors.textMuted }]}>Bench ({benchPlayers.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.benchScroll}>
            {benchPlayers.map((p) => (
              <View key={p.id} style={[s.benchChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.benchChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                  #{p.jersey_number} {p.name.split(" ")[0]}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  courtWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: COURT_H,
  },
  playerLabel: {
    position: "absolute",
    width: 40,
    alignItems: "center",
  },
  playerNum: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  nameLabel: {
    position: "absolute",
    width: 56,
    alignItems: "center",
  },
  nameText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  benchSection: {
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  benchTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },
  benchScroll: {
    flexDirection: "row",
  },
  benchChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 4,
  },
  benchChipText: {
    fontSize: 10,
    fontWeight: "500",
  },
});
