import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { createGame, getSettings, saveSetting } from "../db/database";

export default function SetupScreen() {
  const router = useRouter();
  const [gameName, setGameName] = useState("");
  const [gameHours, setGameHours] = useState(2);
  const [equalTimeHours, setEqualTimeHours] = useState(2);
  const [minutesPerGame, setMinutesPerGame] = useState(10);
  const [distributionMode, setDistributionMode] = useState("unequal_games");
  const [showSettings, setShowSettings] = useState(false);
  const [editHours, setEditHours] = useState("2");
  const [editEqualTimeHours, setEditEqualTimeHours] = useState("2");
  const [editMinutes, setEditMinutes] = useState("10");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    setGameHours(settings.gameHours);
    setEqualTimeHours(settings.equalTimeHours);
    setMinutesPerGame(settings.minutesPerGame);
    setDistributionMode(settings.distributionMode);
    setEditHours(String(settings.gameHours));
    setEditEqualTimeHours(String(settings.equalTimeHours));
    setEditMinutes(String(settings.minutesPerGame));
  };

  const handleOpenSettings = () => {
    setEditHours(String(gameHours));
    setEditEqualTimeHours(String(equalTimeHours));
    setEditMinutes(String(minutesPerGame));
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    const h = parseInt(editHours, 10);
    const eqH = parseInt(editEqualTimeHours, 10);
    const m = parseInt(editMinutes, 10);
    if (isNaN(h) || h < 1 || h > 10) {
      Alert.alert("Invalid", "Flexible Rotations hours must be between 1 and 10.");
      return;
    }
    if (isNaN(eqH) || eqH < 1 || eqH > 10) {
      Alert.alert("Invalid", "Equal Playing Time hours must be between 1 and 10.");
      return;
    }
    if (isNaN(m) || m < 1 || m > 60) {
      Alert.alert("Invalid", "Minutes per game must be between 1 and 60.");
      return;
    }
    const totalMinutes = h * 60;
    if (m > totalMinutes) {
      Alert.alert("Invalid", "Minutes per game cannot exceed Flexible Rotations total time.");
      return;
    }
    await saveSetting("game_hours", h);
    await saveSetting("equal_time_hours", eqH);
    await saveSetting("minutes_per_game", m);
    setGameHours(h);
    setEqualTimeHours(eqH);
    setMinutesPerGame(m);
    setShowSettings(false);
    Alert.alert("Saved", "Game duration settings updated.");
  };

  const handleModeChange = async (mode) => {
    setDistributionMode(mode);
    await saveSetting("distribution_mode", mode);
  };

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

  const activeHours = distributionMode === "equal_time" ? equalTimeHours : gameHours;
  const totalMinutes = activeHours * 60;
  const totalRotations = Math.floor(totalMinutes / minutesPerGame);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.flex}
    >
      <ScrollView style={s.scroll}>
        <View style={s.headingRow}>
          <Text style={s.heading}>Game Setup</Text>
          <TouchableOpacity onPress={handleOpenSettings} activeOpacity={0.7} style={s.settingsBtn}>
            <Text style={s.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

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

        <View style={s.modeSection}>
          <Text style={s.modeTitle}>Distribution Mode</Text>

          <TouchableOpacity
            style={[s.modeCard, distributionMode === "equal_time" && s.modeCardActive]}
            onPress={() => handleModeChange("equal_time")}
            activeOpacity={0.8}
          >
            <View style={s.modeRadio}>
              {distributionMode === "equal_time" && <View style={s.modeRadioInner} />}
            </View>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeCardTitle, distributionMode === "equal_time" && s.modeCardTitleActive]}>
                Equal Playing Time
              </Text>
              <Text style={s.modeCardDesc}>
                All players get the same number of games. Rotation duration is auto-calculated for fairness.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modeCard, distributionMode === "unequal_games" && s.modeCardActive]}
            onPress={() => handleModeChange("unequal_games")}
            activeOpacity={0.8}
          >
            <View style={s.modeRadio}>
              {distributionMode === "unequal_games" && <View style={s.modeRadioInner} />}
            </View>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeCardTitle, distributionMode === "unequal_games" && s.modeCardTitleActive]}>
                Flexible Rotations
              </Text>
              <Text style={s.modeCardDesc}>
                Fixed {minutesPerGame} min per rotation. Some players may play 1 more game to fill total time.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Rotation Info</Text>
          <Text style={s.infoText}>
            {"• "}{activeHours} hour{activeHours !== 1 ? "s" : ""} total ({totalMinutes} min){"\n"}
            {distributionMode === "unequal_games"
              ? `• ${minutesPerGame} min per rotation — ${totalRotations} rotation${totalRotations !== 1 ? "s" : ""} total`
              : "• Rotation duration auto-calculated per player count"}{"\n"}
            {"• 10 players per game (5v5)"}{"\n"}
            {"• Fair rotation for all players"}
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

      <Modal visible={showSettings} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Game Duration Settings</Text>

            {distributionMode === "equal_time" ? (
              <>
                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Total Hours of Playing Time</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editEqualTimeHours}
                    onChangeText={setEditEqualTimeHours}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={s.previewCard}>
                  <Text style={s.previewText}>
                    {(() => {
                      const eqH = parseInt(editEqualTimeHours, 10) || 0;
                      const total = eqH * 60;
                      return `${total} min total — equal time per player`;
                    })()}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Total Hours of Playing Time</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editHours}
                    onChangeText={setEditHours}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Minutes Per Game</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editMinutes}
                    onChangeText={setEditMinutes}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={s.previewCard}>
                  <Text style={s.previewText}>
                    {(() => {
                      const h = parseInt(editHours, 10) || 0;
                      const m = parseInt(editMinutes, 10) || 0;
                      const total = h * 60;
                      const rotations = m > 0 ? Math.floor(total / m) : 0;
                      return `${total} min total → ${rotations} rotation${rotations !== 1 ? "s" : ""} of ${m} min`;
                    })()}
                  </Text>
                </View>
              </>
            )}

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowSettings(false)}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={handleSaveSettings}
                activeOpacity={0.8}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#475569",
  },
  settingsIcon: { fontSize: 20 },
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
  modeSection: { marginBottom: 24 },
  modeTitle: { color: "#CBD5E1", fontSize: 15, marginBottom: 10, fontWeight: "600" },
  modeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#334155",
  },
  modeCardActive: {
    borderColor: "#F97316",
    backgroundColor: "#1E293B",
  },
  modeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  modeRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F97316",
  },
  modeTextWrap: { flex: 1 },
  modeCardTitle: { color: "#CBD5E1", fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  modeCardTitleActive: { color: "#FFF" },
  modeCardDesc: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "#475569",
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
  },
  settingsField: { marginBottom: 16 },
  settingsLabel: { color: "#CBD5E1", fontSize: 14, marginBottom: 8, fontWeight: "600" },
  settingsInput: {
    backgroundColor: "#0F172A",
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#475569",
    textAlign: "center",
  },
  previewCard: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  previewText: { color: "#FB923C", fontSize: 13, textAlign: "center", fontWeight: "600" },
  modalBtnRow: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#334155",
    borderWidth: 1,
    borderColor: "#475569",
  },
  cancelBtnText: { color: "#94A3B8", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F97316",
  },
  saveBtnText: { color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 },
});
