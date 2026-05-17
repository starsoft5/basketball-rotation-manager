import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getAllGames, deleteGame } from "../db/database";

export default function HistoryScreen() {
  const router = useRouter();
  const [games, setGames] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [])
  );

  const loadGames = async () => {
    const allGames = await getAllGames();
    setGames(allGames);
  };

  const handleDelete = (gameId, gameName) => {
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

  const statusColors = {
    completed: "#15803D",
    in_progress: "#F97316",
    ready: "#2563EB",
    setup: "#475569",
  };

  const statusLabels = {
    completed: "COMPLETED",
    in_progress: "IN PROGRESS",
    ready: "READY",
    setup: "SETUP",
  };

  return (
    <View style={s.container}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => {
              if (item.status === "setup") {
                router.push(`/players/${item.id}?count=${item.total_players}`);
              } else {
                router.push(`/game/${item.id}`);
              }
            }}
            onLongPress={() => handleDelete(item.id, item.name)}
            activeOpacity={0.7}
          >
            <View style={s.cardHeader}>
              <Text style={s.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  s.statusBadge,
                  { backgroundColor: statusColors[item.status] || "#475569" },
                ]}
              >
                <Text style={s.statusText}>
                  {statusLabels[item.status] || item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.infoText}>{item.total_players} players</Text>
              <Text style={s.infoText}>
                Rotation {item.current_rotation}/12
              </Text>
              <Text style={s.dateText}>{item.created_at}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>🏀</Text>
            <Text style={s.emptyTitle}>No games yet</Text>
            <Text style={s.emptyText}>
              Start a new game from the home screen
            </Text>
          </View>
        }
      />
      <Text style={s.hint}>Long press a game to delete it</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 24, paddingTop: 16 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitle: { color: "#FFF", fontWeight: "bold", fontSize: 17, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  cardInfo: { flexDirection: "row", gap: 16 },
  infoText: { color: "#94A3B8", fontSize: 13 },
  dateText: { color: "#64748B", fontSize: 11, alignSelf: "center" },
  emptyWrap: { alignItems: "center", paddingVertical: 64 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#94A3B8", fontSize: 17, marginBottom: 8 },
  emptyText: { color: "#64748B", fontSize: 13 },
  hint: { color: "#475569", fontSize: 11, textAlign: "center", paddingBottom: 16 },
});
