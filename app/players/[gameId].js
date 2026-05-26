import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { addPlayer, getPlayers, updateGameStatus, deletePlayer, getSettings } from "../../db/database";
import { calcRotations, calcRotationsEqualTime, formatTime } from "../../utils/scheduler";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export default function PlayerEntryScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams();
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
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
    const resized = await manipulateAsync(uri, [{ resize: { width: 1500 } }], {
      compress: 0.85,
      format: SaveFormat.JPEG,
      base64: true,
    });

    const formData = new FormData();
    formData.append("base64Image", `data:image/jpeg;base64,${resized.base64}`);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("scale", "true");
    formData.append("OCREngine", "2");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: "K85403655788957" },
      body: formData,
    });

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || "OCR processing error");
    }
    if (!data.ParsedResults || !data.ParsedResults[0]) return [];

    return data.ParsedResults[0].ParsedText
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

      Alert.alert("Players Scanned", `Added ${names.length} player${names.length !== 1 ? "s" : ""}: ${names.join(", ")}`);
    } catch (err) {
      Alert.alert("Scan Failed", "Check your internet connection and try again.");
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

      Alert.alert("Players Scanned", `Added ${names.length} player${names.length !== 1 ? "s" : ""}: ${names.join(", ")}`);
    } catch (err) {
      Alert.alert("Scan Failed", "Check your internet connection and try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleRemovePlayer = (player) => {
    Alert.alert("Remove Player", `Remove ${player.name} from the game?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deletePlayer(player.id);
          await loadPlayers();
        },
      },
    ]);
  };

  const handleStartGame = async () => {
    if (players.length < 10) {
      Alert.alert("Error", "Need at least 10 players to start.");
      return;
    }
    await updateGameStatus(parseInt(gameId, 10), "ready");
    router.replace(`/game/${gameId}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.flex}
    >
      <View style={s.container}>
        <View style={s.headerRow}>
          <Text style={s.headerText}>Players: {players.length}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {players.length < 10 ? `Need ${10 - players.length} more` : "Ready!"}
            </Text>
          </View>
        </View>

        {stats && (
          <View style={s.statsCard}>
            <Text style={s.statsText}>
              {`${stats.totalGames} rotations — ${formatTime(Math.round(stats.minutesPerRotation * 60))} each`}
            </Text>
            {transitionTotalSeconds > 0 && (
              <Text style={[s.statsText, { marginTop: 4, fontSize: 12, color: "#94A3B8" }]}>
                {`${formatTime(transitionTotalSeconds)} transition between rotations — total: ${Math.round(stats.totalWithTransitions)} min`}
              </Text>
            )}
            {stats.adjusted && (
              <Text style={[s.statsText, { marginTop: 4, fontSize: 12, color: "#FB923C" }]}>
                {`Rotation adjusted from ${stats.originalMinutesPerGame} to ${stats.minutesPerRotation} min to guarantee ${minGamesPerPlayer}+ games`}
              </Text>
            )}
            <Text style={[s.statsText, { marginTop: 4, fontSize: 13, color: "#34D399" }]}>
              {(() => {
                const minMin = Math.round(stats.minPlays * stats.minutesPerRotation);
                if (stats.isEven) return `${stats.minPlays} games × ${formatTime(Math.round(stats.minutesPerRotation * 60))} = ${minMin} min per player`;
                const maxMin = Math.round(stats.maxPlays * stats.minutesPerRotation);
                const extraSlots = stats.totalGames * 10 - players.length * stats.minPlays;
                return `${players.length - extraSlots} get ${stats.minPlays} games (${minMin} min), ${extraSlots} get ${stats.maxPlays} games (${maxMin} min)`;
              })()}
            </Text>
          </View>
        )}

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
          <TouchableOpacity
            style={[s.addBtn, playerName.trim() ? s.addActive : s.addDisabled]}
            onPress={handleAddPlayer}
            disabled={!playerName.trim()}
          >
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {scanning ? (
          <View style={s.scanningWrap}>
            <ActivityIndicator size="large" color="#FB923C" />
            <Text style={s.scanningText}>Reading player names...</Text>
          </View>
        ) : (
          <View style={s.scanRow}>
            <TouchableOpacity style={s.scanBtn} onPress={handleScanList} activeOpacity={0.8}>
              <Text style={s.scanBtnText}>Scan List</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.scanBtn} onPress={handlePickImage} activeOpacity={0.8}>
              <Text style={s.scanBtnText}>Pick Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={players}
          keyExtractor={(item) => item.id.toString()}
          style={s.list}
          renderItem={({ item }) => (
            <View style={s.playerRow}>
              <View style={s.jerseyCircle}>
                <Text style={s.jerseyText}>{item.jersey_number}</Text>
              </View>
              <Text style={s.playerName}>{item.name}</Text>
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => handleRemovePlayer(item)}
              >
                <Text style={s.removeBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>Add players to get started</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={[
                s.startBtn,
                players.length >= 10 ? s.startReady : s.startDisabled,
              ]}
              onPress={handleStartGame}
              disabled={players.length < 10}
              activeOpacity={0.8}
            >
              <Text style={s.startBtnText}>
                {players.length >= 10
                  ? `Start Game with ${players.length} players`
                  : `Need ${10 - players.length} more players`}
              </Text>
            </TouchableOpacity>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0F172A" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerText: { color: "#FFF", fontSize: 17, fontWeight: "bold" },
  badge: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: "#FB923C", fontWeight: "600", fontSize: 13 },
  statsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsText: { color: "#CBD5E1", fontSize: 13, textAlign: "center" },
  inputRow: { flexDirection: "row", marginBottom: 12 },
  nameInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    color: "#FFF",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: "#475569",
  },
  addBtn: { paddingHorizontal: 24, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  addActive: { backgroundColor: "#F97316" },
  addDisabled: { backgroundColor: "#475569" },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  modeBadge: { backgroundColor: "#1E3A5F", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 8 },
  modeBadgeText: { color: "#60A5FA", fontSize: 11, fontWeight: "bold" },
  list: { flex: 1 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  jerseyCircle: {
    width: 32,
    height: 32,
    backgroundColor: "#F97316",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jerseyText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  playerName: { color: "#FFF", fontSize: 15, flex: 1 },
  removeBtn: {
    width: 28,
    height: 28,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "#64748B", fontSize: 15 },
  scanRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FB923C",
  },
  scanBtnText: {
    color: "#FB923C",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 14,
  },
  scanningWrap: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 12,
  },
  scanningText: {
    color: "#FB923C",
    marginTop: 8,
    fontSize: 14,
  },
  startBtn: { paddingVertical: 16, borderRadius: 16, marginBottom: 24 },
  startReady: { backgroundColor: "#16A34A" },
  startDisabled: { backgroundColor: "#334155" },
  startBtnText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
});
