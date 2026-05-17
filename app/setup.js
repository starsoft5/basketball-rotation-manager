import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { createGame } from "../db/database";
export default function SetupScreen() {
  const router = useRouter();
  const [gameName, setGameName] = useState("");

  const handleContinue = async () => {
    if (!gameName.trim()) {
      Alert.alert("Error", "Please enter a game name.");
      return;
    }

    try {
      const gameId = await createGame(gameName.trim(), 0);
      router.push(`/players/${gameId}`);
    } catch (error) {
      Alert.alert("Error", "Failed to create game. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.flex}
    >
      <ScrollView style={s.scroll}>
        <Text style={s.heading}>Game Setup</Text>

        <View style={s.field}>
          <Text style={s.label}>Game Name</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Sunday Pickup Game"
            placeholderTextColor="#64748B"
            value={gameName}
            onChangeText={setGameName}
          />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Rotation Info</Text>
          <Text style={s.infoText}>
            • 2 hours max, 10 min per game{"\n"}
            • 10 players per game (5v5){"\n"}
            • Add any number of players — rotations auto-calculated
          </Text>
        </View>

        <TouchableOpacity
          style={[
            s.continueBtn,
            gameName.trim() ? s.btnActive : s.btnDisabled,
          ]}
          onPress={handleContinue}
          disabled={!gameName.trim()}
          activeOpacity={0.8}
        >
          <Text style={s.continueBtnText}>Add Players →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 24,
  },
  field: { marginBottom: 24 },
  label: { color: "#CBD5E1", fontSize: 15, marginBottom: 8, fontWeight: "600" },
  input: {
    backgroundColor: "#1E293B",
    color: "#FFF",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#475569",
  },
  infoCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  infoTitle: {
    color: "#FB923C",
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 8,
  },
  infoText: { color: "#CBD5E1", fontSize: 13, lineHeight: 22 },
  continueBtn: { paddingVertical: 16, borderRadius: 16, marginBottom: 32 },
  btnActive: { backgroundColor: "#F97316" },
  btnDisabled: { backgroundColor: "#334155" },
  continueBtnText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
});
