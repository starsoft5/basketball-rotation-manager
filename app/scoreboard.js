import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScoreboardState, saveScoreboardState } from "../db/database";
import { getDisplays, presentScoreboard, updateScoreboard, dismissScoreboard } from "../modules/scoreboard-display";
import { beepFinal } from "../modules/bring-to-front";

// LED look: a monospaced, heavy, glowing digit set on a near-black panel.
const MONO = Platform.OS === "ios" ? "Courier" : "monospace";
const COL = {
  bg: "#0A0A0A",
  panel: "#111111",
  panelEdge: "#2A2A2A",
  clock: "#F4F4F4",
  clockOff: "#8A8A8A",
  score: "#FFB200",
  foul: "#FF3B30",
  shot: "#FF7A1A",
  to: "#27C24C",
  toOff: "#243024",
  label: "#9AA0A6",
  dim: "#3A3A3A",
  btn: "#1C2536",
  btnEdge: "#2E3B52",
  accent: "#F97316",
};

const PERIOD_DEFAULT = 600; // 10:00
// FIBA timeouts: two team timeouts in the first half, three in the second half.
// Unused first-half timeouts do NOT carry over — they're reset at halftime.
const TO_FIRST_HALF = 2;
const TO_SECOND_HALF = 3;
const TO_MAX = TO_SECOND_HALF; // most a team can hold at once → timeout-dot capacity
const toAllotment = (period) => (period <= 2 ? TO_FIRST_HALF : TO_SECOND_HALF);
const SHOT_FULL = 24;  // a full shot clock; the shot clock is switched off in a period's final 24s
const FOUL_BONUS = 5;  // FIBA: a team's 5th foul in a period puts it in the penalty (opponent shoots)
const CORNER_W = 74;     // width of each T.O./fouls corner column
const BOARD_PAD_H = 12;  // board horizontal padding (must match styles.board)

const pad2 = (n) => String(n).padStart(2, "0");
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad2(s % 60)}`;

// True while mirroring to an external display — makes every Btn render taller so
// the phone becomes a finger-friendly control panel.
const PresentingCtx = createContext(false);

// One glowing LED readout.
function Led({ value, size, color, style, fit, width }) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      // When `fit` + a fixed `width` are given the digits auto-shrink to fit that
      // width on one line — so a 5-char clock like "10:00" always renders in full
      // (never wraps or ellipsizes) regardless of the device's screen width.
      adjustsFontSizeToFit={!!fit}
      minimumFontScale={0.5}
      style={[
        {
          fontFamily: MONO,
          fontWeight: "900",
          color,
          fontSize: size,
          textShadowColor: color,
          textShadowRadius: Math.max(4, size * 0.16),
          textShadowOffset: { width: 0, height: 0 },
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
        },
        width != null && { width, textAlign: "center" },
        style,
      ]}
    >
      {value}
    </Text>
  );
}

// Timeout dots (filled = remaining).
function Dots({ n }) {
  return (
    <View style={s.dotsRow}>
      {Array.from({ length: TO_MAX }).map((_, i) => (
        <View
          key={i}
          style={[s.dot, { backgroundColor: i < n ? COL.to : COL.toOff }]}
        />
      ))}
    </View>
  );
}

function Btn({ label, onPress, color, flex, big }) {
  const tall = useContext(PresentingCtx);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[s.btn, big && s.btnBig, tall && s.btnTall, flex && { flex }, color && { borderColor: color }]}
    >
      <Text style={[s.btnText, tall && s.btnTextTall, color && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconBtn({ glyph, onPress, color, label }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.iconBtn, color && { borderColor: color }]}
    >
      <Text style={s.iconBtnText}>{glyph}</Text>
    </TouchableOpacity>
  );
}

export default function ScoreboardScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Horizontal margin on each side so the board isn't edge-to-edge. The board
  // width — and the digit sizes derived from it — fit inside the remaining space.
  const M = Math.round(Math.min(Math.max(width * 0.06, 18), 44));
  const W = Math.min(width - M * 2, 720);

  // Digit sizes are the smaller of a width budget and a height budget, so the
  // whole board + controls fit on one screen (no scroll) on short devices too.
  const clockSize = Math.round(Math.min(W * 0.17, height * 0.072));
  const scoreSize = Math.round(Math.min(W * 0.2, height * 0.085));
  const shotSize = Math.round(Math.min(W * 0.11, height * 0.05));
  const foulSize = Math.round(Math.min(W * 0.1, height * 0.045));
  // Exact width the clock has between the two corner columns; the clock auto-fits
  // into this so "10:00" always shows fully and identically across screen sizes.
  const clockColW = Math.max(110, W - BOARD_PAD_H * 2 - CORNER_W * 2);

  // Fresh-game defaults; on mount any persisted state is loaded over these, so the
  // board keeps its values when you leave and come back (Reset Board starts over).
  const [clock, setClock] = useState(PERIOD_DEFAULT); // 10:00
  const [running, setRunning] = useState(false);
  const [shot, setShot] = useState(24);
  const [home, setHome] = useState(0);
  const [guest, setGuest] = useState(0);
  const [hFoul, setHFoul] = useState(0);
  const [gFoul, setGFoul] = useState(0);
  const [hTO, setHTO] = useState(TO_FIRST_HALF);
  const [gTO, setGTO] = useState(TO_FIRST_HALF);
  const [period, setPeriod] = useState(1);
  const [poss, setPoss] = useState("home");
  const [periodLen, setPeriodLen] = useState(PERIOD_DEFAULT);

  const [editing, setEditing] = useState(false);
  const [editM, setEditM] = useState("10");
  const [editS, setEditS] = useState("00");
  const [presenting, setPresenting] = useState(false); // mirroring to an external display

  const timer = useRef(null);
  const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  // Loud NBA-style game horn (force-maxes MUSIC volume) + haptic, for the buzzer events.
  const horn = () => { buzz(); beepFinal().catch(() => {}); };
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  // ----- persist across navigation: keep state when leaving/returning; a true
  // first run (no saved state) shows the fresh reset defaults above. -----
  const stateRef = useRef(null);
  useEffect(() => {
    stateRef.current = { clock, shot, home, guest, hFoul, gFoul, hTO, gTO, period, poss, periodLen };
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await getScoreboardState();
      if (saved && alive) {
        setClock(saved.clock ?? PERIOD_DEFAULT);
        setShot(saved.shot ?? 24);
        setHome(saved.home ?? 0);
        setGuest(saved.guest ?? 0);
        setHFoul(saved.hFoul ?? 0);
        setGFoul(saved.gFoul ?? 0);
        setHTO(saved.hTO ?? TO_FIRST_HALF);
        setGTO(saved.gTO ?? TO_FIRST_HALF);
        setPeriod(saved.period ?? 1);
        setPoss(saved.poss ?? "home");
        setPeriodLen(saved.periodLen ?? PERIOD_DEFAULT);
      }
    })();
    const id = setInterval(() => { if (stateRef.current) saveScoreboardState(stateRef.current).catch(() => {}); }, 3000);
    return () => {
      alive = false;
      clearInterval(id);
      if (stateRef.current) saveScoreboardState(stateRef.current).catch(() => {});
    };
  }, []);

  // ----- the running clock (game + shot count down together) -----
  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setClock((c) => Math.max(0, c - 1));
      setShot((sc) => Math.max(0, sc - 1));
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  useEffect(() => {
    if (clock === 0 && running) { setRunning(false); horn(); } // period clock ends → loud buzzer
  }, [clock, running]);
  useEffect(() => {
    // The shot clock is switched off once the game clock has less time left than
    // the shot clock (clock <= shot), so a 0 then is the period clock running out,
    // not a shot-clock violation — only buzz/flip while the shot clock is on.
    if (shot === 0 && running && clock > shot) {
      setRunning(false);
      horn(); // shot-clock violation stops play → sound the loud buzzer (same as game-clock end)
      setPoss((p) => (p === "home" ? "guest" : "home")); // violation is a turnover → other team's ball
    }
  }, [shot, running, clock]);

  // ----- handlers -----
  const toggleRun = useCallback(() => {
    tap();
    if (!running) {
      // Starting: a 0 shot clock would instantly re-trigger the violation auto-stop
      // (deadlock), and a 0:00 period clock has nothing to run — handle both.
      if (clock === 0) return;     // reset the clock or advance the period first
      if (shot === 0) setShot(24); // expired shot clock → fresh 24 for the new possession
    }
    setRunning((r) => !r);
  }, [running, clock, shot]);
  const resetClock = useCallback(() => { tap(); setRunning(false); setClock(periodLen); setShot(24); }, [periodLen]);
  const bumpScore = (side, d) => {
    tap();
    side === "home" ? setHome((v) => Math.max(0, v + d)) : setGuest((v) => Math.max(0, v + d));
    if (d > 0) {
      setShot(24); // a made basket automatically resets the shot clock
      setPoss(side === "home" ? "guest" : "home"); // ...and hands the ball to the team that was scored on
    }
  };
  const bumpFoul = (side, d) => {
    tap();
    side === "home" ? setHFoul((v) => Math.max(0, v + d)) : setGFoul((v) => Math.max(0, v + d));
    if (d > 0) setRunning(false); // a foul whistle stops the game clock
  };
  const bumpTO = (side, d) => { tap(); const cap = toAllotment(period); side === "home" ? setHTO((v) => Math.min(cap, Math.max(0, v + d))) : setGTO((v) => Math.min(cap, Math.max(0, v + d))); };
  // A team calling a timeout: spend one of its remaining timeouts, stop the clock, sound the buzzer.
  // Possession is unchanged — the team that had the ball keeps it after a timeout.
  const takeTimeout = (side) => { bumpTO(side, -1); setRunning(false); horn(); };
  const setShotClock = (v) => { tap(); setShot(v); };
  const stepPeriod = (d) => {
    tap();
    const next = Math.min(4, Math.max(1, period + d));
    setPeriod(next);
    if (d > 0) {
      setClock(periodLen); setShot(SHOT_FULL); setRunning(false);
      setHFoul(0); setGFoul(0); // FIBA: team fouls reset at the start of each period
      setPoss((p) => (p === "home" ? "guest" : "home")); // alternating-possession arrow each new period
      // Crossing into the second half (Q3): replenish to the second-half timeout allotment.
      if (period <= 2 && next >= 3) { setHTO(TO_SECOND_HALF); setGTO(TO_SECOND_HALF); }
    }
  };
  const togglePoss = () => { tap(); setPoss((p) => (p === "home" ? "guest" : "home")); };

  const resetBoard = useCallback(() => {
    buzz();
    setRunning(false);
    setClock(periodLen);
    setShot(24);
    setHome(0); setGuest(0);
    setHFoul(0); setGFoul(0);
    setHTO(TO_FIRST_HALF); setGTO(TO_FIRST_HALF);
    setPeriod(1);
    setPoss("home");
  }, [periodLen]);

  // The new-game icon confirms before wiping the board.
  const confirmNewGame = useCallback(() => {
    tap();
    Alert.alert(
      "New Game?",
      "Start a new game? This clears the score, fouls, timeouts and resets the clock.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "New Game", style: "destructive", onPress: resetBoard },
      ]
    );
  }, [resetBoard]);

  // Snapshot of everything the external display needs to draw.
  const buildState = useCallback(() => ({
    clock: fmtClock(clock),
    shot, home, guest, hFoul, gFoul, hTO, gTO, period, poss, running,
    shotOff: clock <= shot,                // hide the shot clock once game time left <= shot clock
    hBonus: hFoul >= FOUL_BONUS,           // home in the penalty (guest shoots free throws)
    gBonus: gFoul >= FOUL_BONUS,           // guest in the penalty (home shoots free throws)
    toMax: toAllotment(period),            // how many timeout dots to show this half
  }), [clock, shot, home, guest, hFoul, gFoul, hTO, gTO, period, poss, running]);

  // Start/stop mirroring a clean scoreboard to an external display (HDMI / cast),
  // while this phone keeps the control buttons.
  const togglePresent = useCallback(async () => {
    tap();
    if (presenting) {
      await dismissScoreboard();
      setPresenting(false);
      return;
    }
    const res = await presentScoreboard(buildState());
    if (res && res.ok) {
      setPresenting(true);
    } else {
      const reason = res && res.reason;
      Alert.alert(
        "No External Display",
        reason === "no_external_display"
          ? "No second screen detected. Connect a TV/monitor via USB‑C→HDMI or cast with Chromecast/Miracast, then tap Present again."
          : "Couldn't start the external scoreboard display." + (reason ? `\n(${reason})` : ""),
      );
    }
  }, [presenting, buildState]);

  // While presenting, push every change to the external display.
  useEffect(() => {
    if (presenting) updateScoreboard(buildState());
  }, [presenting, buildState]);

  // Auto-present: whenever an external display is available, start showing the
  // board on it automatically — no need to tap Present. Stops when it's gone.
  const presentingRef = useRef(false);
  const buildStateRef = useRef(buildState);
  const lastMaxIdRef = useRef(-1); // newest presentation display we've presented onto
  useEffect(() => { presentingRef.current = presenting; }, [presenting]);
  useEffect(() => { buildStateRef.current = buildState; }, [buildState]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const displays = await getDisplays();
        if (!alive) return;
        if (displays && displays.length > 0) {
          // Re-present when not yet presenting OR when a NEWER display appears (e.g. a fresh
          // scrcpy/cast window over a leftover "zombie" display) — present() targets the
          // highest id, so following the max id keeps the board on the live window.
          const maxId = Math.max(...displays.map((d) => d.id));
          if (!presentingRef.current || maxId !== lastMaxIdRef.current) {
            const res = await presentScoreboard(buildStateRef.current());
            if (alive && res && res.ok) { setPresenting(true); lastMaxIdRef.current = maxId; }
          }
        } else if (presentingRef.current) {
          setPresenting(false);
          lastMaxIdRef.current = -1;
        }
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Tear down the external display if the screen is left.
  useEffect(() => () => { dismissScoreboard(); }, []);

  const openEdit = () => {
    setEditM(String(Math.floor(clock / 60)));
    setEditS(pad2(clock % 60));
    setEditing(true);
  };
  const saveEdit = () => {
    const m = Math.max(0, parseInt(editM, 10) || 0);
    const sec = Math.min(59, Math.max(0, parseInt(editS, 10) || 0));
    const total = m * 60 + sec;
    setClock(total);
    setPeriodLen(total); // future resets/period changes use this length
    setEditing(false);
  };

  return (
    <View style={[s.screen, { paddingTop: 8, paddingBottom: insets.bottom + 8 }, s.screenPresenting]}>
        {/* The phone is a pure control panel — the board is never shown here; it
            renders only on the external display via Present to TV. */}

        {/* ===================== CONTROLS ===================== */}
        <PresentingCtx.Provider value={true}>
        <View style={[s.controls, { width: W }]}>
          <View style={s.row}>
            <Btn label={running ? "⏸  Pause" : "▶  Start"} onPress={toggleRun} color={running ? COL.foul : COL.to} flex={2} big />
            <Btn label="⟲ Reset" onPress={resetClock} flex={1} big />
            <Btn label="✎ Edit" onPress={openEdit} flex={1} big />
          </View>
          <View style={s.row}>
            <Btn label="🆕  New Game" onPress={confirmNewGame} color={COL.foul} flex={1} />
            <Btn label={presenting ? "📺  Stop Display" : "📺  Present to TV"} onPress={togglePresent} color={presenting ? COL.to : COL.accent} flex={1} />
          </View>

          <Text style={s.group}>SCORE</Text>
          <View style={s.row}>
            <Text style={s.rowTag}>HOME</Text>
            <Btn label="−" onPress={() => bumpScore("home", -1)} flex={1} />
            <Btn label="+1" onPress={() => bumpScore("home", 1)} color={COL.score} flex={1} />
            <Btn label="+2" onPress={() => bumpScore("home", 2)} color={COL.score} flex={1} />
            <Btn label="+3" onPress={() => bumpScore("home", 3)} color={COL.score} flex={1} />
          </View>
          <View style={s.row}>
            <Text style={s.rowTag}>GUEST</Text>
            <Btn label="−" onPress={() => bumpScore("guest", -1)} flex={1} />
            <Btn label="+1" onPress={() => bumpScore("guest", 1)} color={COL.score} flex={1} />
            <Btn label="+2" onPress={() => bumpScore("guest", 2)} color={COL.score} flex={1} />
            <Btn label="+3" onPress={() => bumpScore("guest", 3)} color={COL.score} flex={1} />
          </View>

          <Text style={s.group}>FOULS</Text>
          <View style={s.row}>
            <Text style={s.rowTag}>HOME</Text>
            <Btn label="−" onPress={() => bumpFoul("home", -1)} flex={1} />
            <Btn label="+ Foul" onPress={() => bumpFoul("home", 1)} color={COL.foul} flex={2} />
            <Text style={s.rowTag}>GUEST</Text>
            <Btn label="−" onPress={() => bumpFoul("guest", -1)} flex={1} />
            <Btn label="+ Foul" onPress={() => bumpFoul("guest", 1)} color={COL.foul} flex={2} />
          </View>

          <Text style={s.group}>TIMEOUTS</Text>
          <View style={s.row}>
            <Text style={s.rowTag}>HOME</Text>
            <Btn label="+" onPress={() => bumpTO("home", 1)} flex={1} />
            <Btn label="⏱ Time Out" onPress={() => takeTimeout("home")} color={COL.to} flex={2} />
            <Text style={s.rowTag}>GUEST</Text>
            <Btn label="+" onPress={() => bumpTO("guest", 1)} flex={1} />
            <Btn label="⏱ Time Out" onPress={() => takeTimeout("guest")} color={COL.to} flex={2} />
          </View>

          <Text style={s.group}>SHOT CLOCK · PERIOD · POSSESSION</Text>
          <View style={s.row}>
            <Btn label="Shot 24" onPress={() => setShotClock(24)} color={COL.shot} flex={1} />
            <Btn label="Shot 14" onPress={() => setShotClock(14)} color={COL.shot} flex={1} />
            <Btn label="◀ Per" onPress={() => stepPeriod(-1)} flex={1} />
            <Btn label="Per ▶" onPress={() => stepPeriod(1)} flex={1} />
            <Btn label="⇄ Poss" onPress={togglePoss} color={COL.accent} flex={1} />
          </View>

        </View>
        </PresentingCtx.Provider>

      {/* ===================== EDIT CLOCK MODAL ===================== */}
      <Modal visible={editing} transparent animationType="fade">
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Set Game Clock</Text>
            <View style={s.modalRow}>
              <TextInput
                style={s.modalInput}
                value={editM}
                onChangeText={setEditM}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor="#64748B"
              />
              <Text style={s.modalColon}>:</Text>
              <TextInput
                style={s.modalInput}
                value={editS}
                onChangeText={setEditS}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor="#64748B"
              />
            </View>
            <Text style={s.modalHint}>This also sets the length used on Reset / next period.</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => setEditing(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalSave]} onPress={saveEdit}>
                <Text style={s.modalSaveText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F172A", alignItems: "center" },

  // ---- LED board ----
  board: {
    backgroundColor: COL.bg,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#3A2A12",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  corner: { alignItems: "center", width: CORNER_W },
  toLabel: { color: COL.to, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  tinyLabel: { color: COL.foul, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  poss: { color: COL.foul, fontSize: 22, fontWeight: "900", textShadowColor: COL.foul, textShadowRadius: 8, marginBottom: 2 },
  clockWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  hintLabel: { color: "#5A5A5A", fontSize: 10, marginTop: 2 },
  dotsRow: { flexDirection: "row", gap: 4, marginVertical: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },

  midRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4 },
  teamCol: { flex: 1, alignItems: "center" },
  teamLabel: { color: "#E6E6E6", fontSize: 18, fontWeight: "900", letterSpacing: 2, textAlign: "center", marginBottom: 2 },
  centerCol: { alignItems: "center", paddingHorizontal: 8 },
  periodLabel: { color: COL.label, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  periodNums: { flexDirection: "row", gap: 12, marginTop: 2, marginBottom: 6 },
  periodNum: { color: COL.dim, fontSize: 16, fontWeight: "900" },
  periodNumOn: { color: COL.shot, textShadowColor: COL.shot, textShadowRadius: 8 },
  shotLabel: { color: COL.label, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },

  // ---- controls ----
  controls: { marginTop: 10 },
  group: { color: COL.label, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  rowTag: { color: "#94A3B8", fontSize: 12, fontWeight: "800", width: 52 },
  btn: {
    backgroundColor: COL.btn,
    borderWidth: 1,
    borderColor: COL.btnEdge,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnBig: { paddingVertical: 11 },
  btnTall: { paddingVertical: 18 },          // presenting: finger-friendly control panel
  btnText: { color: "#E2E8F0", fontSize: 15, fontWeight: "800" },
  btnTextTall: { fontSize: 18 },
  screenPresenting: { justifyContent: "center" },
  presentBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#13203A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#26344F",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  presentLive: { color: "#27C24C", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  presentMeta: { color: "#94A3B8", fontSize: 13, fontWeight: "600", marginTop: 3 },
  presentScore: { color: "#FFB200", fontSize: 34, fontWeight: "900", fontVariant: ["tabular-nums"] },
  iconBtn: {
    width: 52,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COL.btnEdge,
    backgroundColor: COL.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 22 },

  // ---- modal ----
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  modalCard: { backgroundColor: "#1E293B", borderRadius: 16, padding: 22, width: "100%", borderWidth: 1, borderColor: "#475569" },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  modalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  modalInput: { backgroundColor: "#0F172A", color: "#FFF", fontSize: 30, fontWeight: "bold", textAlign: "center", paddingVertical: 10, width: 90, borderRadius: 12, borderWidth: 1, borderColor: "#475569" },
  modalColon: { color: "#FFF", fontSize: 30, fontWeight: "bold" },
  modalHint: { color: "#94A3B8", fontSize: 12, textAlign: "center", marginTop: 12 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalCancel: { backgroundColor: "#334155" },
  modalCancelText: { color: "#94A3B8", fontWeight: "bold", fontSize: 16 },
  modalSave: { backgroundColor: "#F97316" },
  modalSaveText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});
