import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { createGame, getSettings, saveSetting } from "../db/database";
import AnimatedButton from "../components/AnimatedButton";
import Animated, {
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";

export default function SetupScreen() {
  const router = useRouter();
  const [gameName, setGameName] = useState("");
  const [gameTotalMinutes, setGameTotalMinutes] = useState(120);
  const [equalTimeTotalMinutes, setEqualTimeTotalMinutes] = useState(120);
  const [minutesPerGame, setMinutesPerGame] = useState(10);
  const [distributionMode, setDistributionMode] = useState("unequal_games");
  const [showSettings, setShowSettings] = useState(false);
  const [editHours, setEditHours] = useState("2");
  const [editMins, setEditMins] = useState(0);
  const [editEqualTimeHours, setEditEqualTimeHours] = useState("2");
  const [editEqualTimeMins, setEditEqualTimeMins] = useState(0);
  const [editMinutes, setEditMinutes] = useState("10");
  const [transitionTotalSeconds, setTransitionTotalSeconds] = useState(120);
  const [editTransitionMins, setEditTransitionMins] = useState("2");
  const [editTransitionSecs, setEditTransitionSecs] = useState("0");
  const [paymentPerPlayer, setPaymentPerPlayer] = useState(280);
  const [editPayment, setEditPayment] = useState("280");
  const [minGamesPerPlayer, setMinGamesPerPlayer] = useState(0);
  const [editMinGames, setEditMinGames] = useState("0");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    setGameTotalMinutes(settings.gameTotalMinutes);
    setEqualTimeTotalMinutes(settings.equalTimeTotalMinutes);
    setMinutesPerGame(settings.minutesPerGame);
    setTransitionTotalSeconds(settings.transitionTotalSeconds);
    setDistributionMode(settings.distributionMode);
    setEditHours((settings.gameTotalMinutes / 60).toFixed(2));
    setEditEqualTimeHours((settings.equalTimeTotalMinutes / 60).toFixed(2));
    setEditMinutes(String(settings.minutesPerGame));
    setEditTransitionMins(String(Math.floor(settings.transitionTotalSeconds / 60)));
    setEditTransitionSecs(String(settings.transitionTotalSeconds % 60));
    setPaymentPerPlayer(settings.paymentPerPlayer);
    setEditPayment(String(settings.paymentPerPlayer));
    setMinGamesPerPlayer(settings.minGamesPerPlayer);
    setEditMinGames(String(settings.minGamesPerPlayer));
  };

  const handleOpenSettings = () => {
    setEditHours((gameTotalMinutes / 60).toFixed(2));
    setEditEqualTimeHours((equalTimeTotalMinutes / 60).toFixed(2));
    setEditMinutes(String(minutesPerGame));
    setEditTransitionMins(String(Math.floor(transitionTotalSeconds / 60)));
    setEditTransitionSecs(String(transitionTotalSeconds % 60));
    setEditPayment(String(paymentPerPlayer));
    setEditMinGames(String(minGamesPerPlayer));
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    const h = parseFloat(editHours);
    const eqH = parseFloat(editEqualTimeHours);
    const m = parseFloat(editMinutes);
    if (isNaN(h) || h < 0 || h > 10) {
      Alert.alert("Invalid", "Hours must be between 0 and 10.");
      return;
    }
    const gameTotal = Math.round(h * 60);
    if (gameTotal < 1) {
      Alert.alert("Invalid", "Total time must be at least 1 minute.");
      return;
    }
    if (isNaN(eqH) || eqH < 0 || eqH > 10) {
      Alert.alert("Invalid", "Hours must be between 0 and 10.");
      return;
    }
    const eqTotal = Math.round(eqH * 60);
    if (eqTotal < 1) {
      Alert.alert("Invalid", "Equal Playing Time total must be at least 1 minute.");
      return;
    }
    if (isNaN(m) || m < 0.01 || m > 60) {
      Alert.alert("Invalid", "Minutes per game must be between 0.01 and 60.");
      return;
    }
    if (m > gameTotal) {
      Alert.alert("Invalid", "Minutes per game cannot exceed Flexible Rotations total time.");
      return;
    }
    const tMins = parseInt(editTransitionMins, 10) || 0;
    const tSecs = parseInt(editTransitionSecs, 10) || 0;
    const tTotal = tMins * 60 + tSecs;
    if (tMins < 0 || tSecs < 0 || tSecs > 59 || tTotal > 600) {
      Alert.alert("Invalid", "Transition time must be between 0:00 and 10:00.");
      return;
    }
    const pay = parseInt(editPayment, 10);
    if (isNaN(pay) || pay < 0) {
      Alert.alert("Invalid", "Payment per player must be 0 or more.");
      return;
    }
    const minG = parseInt(editMinGames, 10) || 0;
    if (minG < 0 || minG > 20) {
      Alert.alert("Invalid", "Minimum games per player must be between 0 and 20.");
      return;
    }
    await saveSetting("game_total_minutes", gameTotal);
    await saveSetting("equal_time_total_minutes", eqTotal);
    await saveSetting("game_hours", Math.floor(gameTotal / 60));
    await saveSetting("equal_time_hours", Math.floor(eqTotal / 60));
    await saveSetting("minutes_per_game", m);
    await saveSetting("transition_total_seconds", tTotal);
    await saveSetting("transition_minutes", Math.floor(tTotal / 60));
    await saveSetting("payment_per_player", pay);
    await saveSetting("min_games_per_player", minG);
    setGameTotalMinutes(gameTotal);
    setEqualTimeTotalMinutes(eqTotal);
    setMinutesPerGame(m);
    setTransitionTotalSeconds(tTotal);
    setPaymentPerPlayer(pay);
    setMinGamesPerPlayer(minG);
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

  const activeTotalMinutes = distributionMode === "equal_time" ? equalTimeTotalMinutes : gameTotalMinutes;
  const activeHours = Math.floor(activeTotalMinutes / 60);
  const activeRemainingMins = activeTotalMinutes % 60;
  const transitionMins = transitionTotalSeconds / 60;
  const totalRotations = transitionMins > 0
    ? Math.floor((activeTotalMinutes + transitionMins) / (minutesPerGame + transitionMins))
    : Math.floor(activeTotalMinutes / minutesPerGame);

  // Smoothly fade the Continue button between disabled (grey) and active (orange).
  const continueEnabled = useSharedValue(gameName.trim() ? 1 : 0);
  useEffect(() => {
    continueEnabled.value = withTiming(gameName.trim() ? 1 : 0, { duration: 250 });
  }, [gameName]);
  const continueBtnStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(continueEnabled.value, [0, 1], ["#334155", "#F97316"]),
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.flex}
    >
      <ScrollView style={s.scroll}>
        <Animated.View entering={FadeInDown.duration(400)} style={s.headingRow}>
          <Text style={s.heading}>Game Setup</Text>
          <Animated.View entering={ZoomIn.duration(300).delay(120).springify()}>
            <AnimatedButton onPress={handleOpenSettings} style={s.settingsBtn}>
              <Text style={s.settingsIcon}>⚙️</Text>
            </AnimatedButton>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={s.field}>
          <Text style={s.label}>Game Name <Text style={{ color: "#EF4444" }}>(Required)</Text></Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Sunday Pickup Game"
            placeholderTextColor="#64748B"
            value={gameName}
            onChangeText={setGameName}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={s.modeSection}>
          <View style={[s.modeCard, s.modeCardActive]}>
            <View style={s.modeTextWrap}>
              <Text style={[s.modeCardTitle, s.modeCardTitleActive]}>
                Rotations
              </Text>
              <Text style={s.modeCardDesc}>
                Fixed {minutesPerGame} min per rotation. Some players may play 1 more game to fill total time.
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(240)} style={s.infoCard}>
          <Text style={s.infoTitle}>Rotation Info</Text>
          <Text style={s.infoText}>
            {"• "}{activeHours}h {activeRemainingMins > 0 ? `${activeRemainingMins}m` : ""} total ({activeTotalMinutes} min){"\n"}
            {distributionMode === "unequal_games"
              ? `• ${minutesPerGame} min per rotation — ${totalRotations} rotation${totalRotations !== 1 ? "s" : ""} total`
              : "• Rotation duration auto-calculated per player count"}{"\n"}
            {"• "}Transition time: {transitionTotalSeconds === 0 ? "None" : `${Math.floor(transitionTotalSeconds / 60)}m${transitionTotalSeconds % 60 > 0 ? ` ${transitionTotalSeconds % 60}s` : ""}`}{"\n"}
            {"• 10 players per game (5v5)"}{"\n"}
            {"• Fair rotation for all players"}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(320)}>
          <AnimatedButton
            style={[s.continueBtn, continueBtnStyle]}
            onPress={handleContinue}
            disabled={!gameName.trim()}
          >
            <Text style={s.continueBtnText}>Add Players →</Text>
          </AnimatedButton>
        </Animated.View>
      </ScrollView>

      <Modal visible={showSettings} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent} showsVerticalScrollIndicator={true}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Game Duration Settings</Text>

            {distributionMode === "equal_time" ? (
              <>
                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Total Playing Time</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editEqualTimeHours}
                    onChangeText={setEditEqualTimeHours}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={s.durationLabel}>hours (e.g. 1.50 = 1h 30m)</Text>
                </View>

                <View style={s.previewCard}>
                  <Text style={s.previewText}>
                    {(() => {
                      const eqH = parseFloat(editEqualTimeHours) || 0;
                      const total = Math.round(eqH * 60);
                      const tTotalSecs = (parseInt(editTransitionMins, 10) || 0) * 60 + (parseInt(editTransitionSecs, 10) || 0);
                      const note = tTotalSecs > 0 ? ` (incl. transition time)` : "";
                      return `${total} min total — equal time per player${note}`;
                    })()}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Total Playing Time</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editHours}
                    onChangeText={setEditHours}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={s.durationLabel}>hours (e.g. 1.50 = 1h 30m)</Text>
                </View>

                <View style={s.settingsField}>
                  <Text style={s.settingsLabel}>Minutes Per Game</Text>
                  <TextInput
                    style={s.settingsInput}
                    value={editMinutes}
                    onChangeText={setEditMinutes}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={s.previewCard}>
                  <Text style={s.previewText}>
                    {(() => {
                      const h = parseFloat(editHours) || 0;
                      const m = parseInt(editMinutes, 10) || 0;
                      const total = Math.round(h * 60);
                      const tMins = ((parseInt(editTransitionMins, 10) || 0) * 60 + (parseInt(editTransitionSecs, 10) || 0)) / 60;
                      const rotations = m > 0
                        ? (tMins > 0 ? Math.floor((total + tMins) / (m + tMins)) : Math.floor(total / m))
                        : 0;
                      return `${total} min total → ${rotations} rotation${rotations !== 1 ? "s" : ""} of ${m} min`;
                    })()}
                  </Text>
                </View>
              </>
            )}

            <View style={s.settingsField}>
              <Text style={s.settingsLabel}>Transition Time Between Rotations</Text>
              <View style={s.durationRow}>
                <View style={s.durationItem}>
                  <TextInput
                    style={s.settingsInput}
                    value={editTransitionMins}
                    onChangeText={setEditTransitionMins}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={s.durationLabel}>min</Text>
                </View>
                <View style={s.durationItem}>
                  <TextInput
                    style={s.settingsInput}
                    value={editTransitionSecs}
                    onChangeText={setEditTransitionSecs}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#64748B"
                  />
                  <Text style={s.durationLabel}>sec</Text>
                </View>
              </View>
            </View>

            {distributionMode === "unequal_games" && (
              <View style={s.settingsField}>
                <Text style={s.settingsLabel}>Minimum Games Per Player</Text>
                <TextInput
                  style={s.settingsInput}
                  value={editMinGames}
                  onChangeText={setEditMinGames}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0 = no minimum"
                  placeholderTextColor="#64748B"
                />
                <Text style={s.settingsHint}>
                  Auto-adjusts rotation time if needed to guarantee minimum games. Set to 0 to disable.
                </Text>
              </View>
            )}

            <View style={s.settingsField}>
              <Text style={s.settingsLabel}>Payment Per Player</Text>
              <TextInput
                style={s.settingsInput}
                value={editPayment}
                onChangeText={setEditPayment}
                keyboardType="number-pad"
                maxLength={5}
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={s.modalBtnRow}>
              <AnimatedButton
                style={s.cancelBtn}
                onPress={() => setShowSettings(false)}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </AnimatedButton>
              <AnimatedButton
                style={s.saveBtn}
                onPress={handleSaveSettings}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </AnimatedButton>
            </View>
          </View>
          </ScrollView>
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
    borderRadius: 16,
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
    borderRadius: 16,
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
  modalScroll: {
    flex: 1,
    width: "100%",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
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
  durationRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  durationItem: { flex: 1 },
  durationLabel: { color: "#94A3B8", fontSize: 11, textAlign: "center", marginTop: 4 },
  minsBtnRow: { flexDirection: "row", gap: 4 },
  minsBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#475569",
    alignItems: "center",
  },
  minsBtnActive: { backgroundColor: "#F97316", borderColor: "#F97316" },
  minsBtnText: { color: "#94A3B8", fontSize: 16, fontWeight: "bold" },
  minsBtnTextActive: { color: "#FFF" },
  settingsHint: { color: "#94A3B8", fontSize: 11, marginTop: 4, textAlign: "center" },
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
