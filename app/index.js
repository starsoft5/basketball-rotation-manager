import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { getSettings } from "../db/database";

export default function HomeScreen() {
  const router = useRouter();
  const [gameHours, setGameHours] = useState(2);
  const [minutesPerGame, setMinutesPerGame] = useState(10);
  const [distributionMode, setDistributionMode] = useState("unequal_games");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const settings = await getSettings();
        setGameHours(settings.gameHours);
        setMinutesPerGame(settings.minutesPerGame);
        setDistributionMode(settings.distributionMode);
      })();
    }, [])
  );

  const totalMinutes = gameHours * 60;
  const totalRotations = Math.floor(totalMinutes / minutesPerGame);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <Text style={s.footer}>Developed by Pol Estrella{"\n"}Version 1.0</Text>
      <Text style={s.emoji}>🏀</Text>
      <Text style={s.title}>Basketball Rotation</Text>
      <Text style={s.subtitle}>
        Manage player rotations for your pickup games
      </Text>

      <TouchableOpacity
        style={s.primaryBtn}
        onPress={() => router.push("/setup")}
        activeOpacity={0.8}
      >
        <Text style={s.primaryBtnText}>New Game</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.secondaryBtn}
        onPress={() => router.push("/history")}
        activeOpacity={0.8}
      >
        <Text style={s.secondaryBtnText}>Game History</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.secondaryBtn, s.shareBtn]}
        onPress={() => router.push("/share")}
        activeOpacity={0.8}
      >
        <Text style={s.secondaryBtnText}>📲 Share to Another Device</Text>
      </TouchableOpacity>

      <View style={s.infoCard}>
        <Text style={s.infoTitle}>How it works:</Text>
        <Text style={s.infoText}>
          {"• "}Game lasts {totalMinutes} minutes{"\n"}
          {"• "}10 players on court per rotation{"\n"}
          {"• "}Mode: {distributionMode === "equal_time" ? "Equal Playing Time" : "Flexible Rotations"}{"\n"}
          {distributionMode === "unequal_games"
            ? `• Each rotation is ${minutesPerGame} minutes\n• ${totalRotations} rotation${totalRotations !== 1 ? "s" : ""} total`
            : "• Rotation duration calculated per player count"}{"\n"}
          {"• "}Supports any number of players (10+){"\n"}
          {"• "}Playing time balanced fairly for all
        </Text>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FB923C",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: "#F97316",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  secondaryBtn: {
    backgroundColor: "#334155",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#475569",
  },
  secondaryBtnText: {
    color: "#E2E8F0",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  shareBtn: {
    marginTop: 12,
    borderColor: "#F97316",
  },
  infoCard: {
    marginTop: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  infoTitle: { color: "#CBD5E1", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  infoText: { color: "#94A3B8", fontSize: 13, lineHeight: 20 },
  footer: { color: "#64748B", fontSize: 12, textAlign: "center", marginBottom: 16 },
});
