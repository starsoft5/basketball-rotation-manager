import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  BackHandler,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Vibration,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import {
  getFullGameData,
  updateGameStatus,
  updateGameRotation,
  updateRotationStatus,
  updatePlayerStats,
  updatePlayerStatus,
  getActivePlayers,
  saveSchedule,
  addPlayer,
  addPlayerToRotation,
  removePlayerFromRotation,
  deletePlayer,
  linkFriends,
  unlinkPlayer,
  getSettings,
  getDatabase,
  createRotation,
  updateGameEndTime,
  updateGameBreakTime,
} from "../../db/database";
import { generateSchedule, generateScheduleEqualTime, calcRotations, calcRotationsEqualTime, formatTime } from "../../utils/scheduler";
import RotationCard from "../../components/RotationCard";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function setupNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rotation-timer", {
      name: "Rotation Timer",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 500, 200, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
}

async function scheduleRotationNotification(seconds, rotationNum, totalRotations) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (seconds <= 0) return;
  await setupNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Rotation Time!",
      body: `Rotation ${rotationNum} of ${totalRotations} is done. Time to sub!`,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      ...(Platform.OS === "android" && { channelId: "rotation-timer" }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
  });
}

async function cancelRotationNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export default function GameScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const gameId = parseInt(id, 10);

  const [gameData, setGameData] = useState(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [gameStatus, setGameStatus] = useState("ready");
  const [schedule, setSchedule] = useState([]);
  const [rotationDuration, setRotationDuration] = useState(600);
  const [minutesPerGame, setMinutesPerGame] = useState(10);

  const [gameEndTime, setGameEndTime] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTime, setBreakTime] = useState(0);
  const [endTimeWarning, setEndTimeWarning] = useState(false);
  const [endTimeReached, setEndTimeReached] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [editEndHour, setEditEndHour] = useState("10");
  const [editEndMinute, setEditEndMinute] = useState("00");
  const [editEndAmPm, setEditEndAmPm] = useState("PM");

  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakModalPlayers, setBreakModalPlayers] = useState([]);
  const [breakModalRotation, setBreakModalRotation] = useState(0);
  const [transitionCountdown, setTransitionCountdown] = useState(0);
  const [transitionExpired, setTransitionExpired] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [selectedForLink, setSelectedForLink] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paidPlayers, setPaidPlayers] = useState(new Set());
  const [paymentAmount, setPaymentAmount] = useState(280);
  const [distributionMode, setDistributionMode] = useState("unequal_games");

  useKeepAwake();

  const timerRef = useRef(null);
  const flatListRef = useRef(null);
  const currentRotationRef = useRef(0);
  const scheduleRef = useRef([]);
  const gameDataRef = useRef(null);
  const rotationDurationRef = useRef(600);
  const minutesPerGameRef = useRef(10);
  const timerEndTimeRef = useRef(null);
  const timeRemainingRef = useRef(600);
  const gameEndTimeRef = useRef(0);
  const breakTimerRef = useRef(null);
  const breakTimeRef = useRef(0);
  const breakStartRef = useRef(null);
  const endTimeAlertShownRef = useRef(false);
  const startTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const transitionSecondsRef = useRef(0);

  useEffect(() => { currentRotationRef.current = currentRotation; }, [currentRotation]);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { gameDataRef.current = gameData; }, [gameData]);
  useEffect(() => { rotationDurationRef.current = rotationDuration; }, [rotationDuration]);
  useEffect(() => { minutesPerGameRef.current = minutesPerGame; }, [minutesPerGame]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { gameEndTimeRef.current = gameEndTime; }, [gameEndTime]);
  useEffect(() => { breakTimeRef.current = breakTime; }, [breakTime]);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    loadGame();
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleExit();
      return true;
    });
    const appStateListener = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && timerEndTimeRef.current) {
        const now = Date.now();
        const remaining = Math.round((timerEndTimeRef.current - now) / 1000);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          timerEndTimeRef.current = null;
          setTimeRemaining(0);
          setIsRunning(false);
          cancelRotationNotification();
          handleRotationEnd();
        } else {
          setTimeRemaining(remaining);
        }
      }
    });
    const notifReceivedListener = Notifications.addNotificationReceivedListener(() => {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    });
    return () => {
      backHandler.remove();
      appStateListener.remove();
      notifReceivedListener.remove();
      cancelRotationNotification();
      if (timerRef.current) clearInterval(timerRef.current);
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      if (transitionTimerRef.current) clearInterval(transitionTimerRef.current);
    };
  }, []);

  const loadGame = async () => {
    const settings = await getSettings();
    const mode = settings.distributionMode;
    setDistributionMode(mode);
    const maxGameMinutes = mode === "equal_time" ? settings.equalTimeTotalMinutes : settings.gameTotalMinutes;

    const data = await getFullGameData(gameId);
    if (!data) return;
    setGameData(data);

    if (data.game.break_time_seconds && data.game.break_time_seconds > 0) {
      setBreakTime(data.game.break_time_seconds);
      breakTimeRef.current = data.game.break_time_seconds;
    }

    if (data.game.game_end_time && data.game.game_end_time > 0) {
      setGameEndTime(data.game.game_end_time);
      gameEndTimeRef.current = data.game.game_end_time;
    }

    const transitionSecs = settings.transitionTotalSeconds || 0;
    const transitionMins = transitionSecs / 60;
    const minGames = settings.minGamesPerPlayer || 0;
    setPaymentAmount(settings.paymentPerPlayer || 280);
    transitionSecondsRef.current = transitionSecs;
    let minsPerGame, duration;
    if (mode === "equal_time" && data.players.length > 0) {
      const info = calcRotationsEqualTime(data.players.length, maxGameMinutes, transitionMins);
      minsPerGame = info.minutesPerRotation;
      duration = Math.round(minsPerGame * 60);
    } else {
      const info = calcRotations(data.players.length, maxGameMinutes, settings.minutesPerGame, transitionMins, minGames);
      minsPerGame = info.minutesPerRotation;
      duration = minsPerGame * 60;
    }

    setRotationDuration(duration);
    setMinutesPerGame(minsPerGame);
    rotationDurationRef.current = duration;
    minutesPerGameRef.current = minsPerGame;
    setTimeRemaining(duration);

    if (data.rotations.length > 0) {
      setSchedule(data.rotations);
      setCurrentRotation(data.game.current_rotation);
      setGameStatus(data.game.status);
    } else {
      const newSchedule = mode === "equal_time"
        ? generateScheduleEqualTime(data.players, maxGameMinutes, transitionMins)
        : generateSchedule(data.players, maxGameMinutes, minsPerGame, transitionMins, minGames);
      await saveSchedule(gameId, newSchedule);
      const fullData = await getFullGameData(gameId);
      setGameData(fullData);
      setSchedule(fullData.rotations);
    }
  };

  const handleRotationEnd = useCallback(async () => {
    const rot = currentRotationRef.current;
    const sched = scheduleRef.current;
    const gData = gameDataRef.current;
    const currentIdx = rot - 1;

    if (currentIdx >= 0 && currentIdx < sched.length) {
      await updateRotationStatus(sched[currentIdx].id, "completed");
      const rotPlayers = sched[currentIdx].players;
      for (const player of rotPlayers) {
        const existing = gData?.players.find((p) => p.id === player.id);
        if (existing) {
          await updatePlayerStats(
            player.id,
            Math.round((existing.total_play_time || 0) + minutesPerGameRef.current),
            (existing.times_played || 0) + 1
          );
        }
      }
    }

    if (rot >= sched.length) {
      setGameStatus("completed");
      await updateGameStatus(gameId, "completed");
      cancelRotationNotification();
      Alert.alert("Game Over!", `All ${sched.length} rotations have been completed.`, [
        { text: "View Summary", onPress: () => {} },
        { text: "Go Home", onPress: () => router.replace("/") },
      ]);
      return;
    }

    const endT = gameEndTimeRef.current;
    const pastEndTime = endT && endT > 0 && Date.now() >= endT;

    const nextRotation = rot + 1;
    setCurrentRotation(nextRotation);
    await updateGameRotation(gameId, nextRotation);
    setTimeRemaining(rotationDurationRef.current);

    if (nextRotation - 1 < sched.length) {
      await updateRotationStatus(sched[nextRotation - 1].id, "active");
    }

    scrollToRotation(nextRotation - 1);

    const nextPlayers = sched[nextRotation - 1]?.players
      .map((p) => p.name)
      .join(", ");

    if (pastEndTime) {
      const remaining = sched.length - nextRotation + 1;
      Alert.alert(
        "Time's Up!",
        `End time has been reached.\n\n${remaining} rotation${remaining !== 1 ? "s" : ""} remaining.\n\nEnd the game or continue playing?`,
        [
          {
            text: "End Game",
            style: "destructive",
            onPress: async () => {
              setGameStatus("completed");
              await updateGameStatus(gameId, "completed");
              Alert.alert("Game Over!", `Game ended after ${rot} rotation${rot !== 1 ? "s" : ""}.`, [
                { text: "Go Home", onPress: () => router.replace("/") },
              ]);
            },
          },
          {
            text: "Payment",
            onPress: () => setShowPayment(true),
          },
          {
            text: "Extend 15 min",
            onPress: async () => {
              const newEnd = Date.now() + 15 * 60 * 1000;
              setGameEndTime(newEnd);
              gameEndTimeRef.current = newEnd;
              setEndTimeReached(false);
              setEndTimeWarning(false);
              endTimeAlertShownRef.current = false;
              try { await updateGameEndTime(gameId, newEnd); } catch (e) {}
              if (startTimerRef.current) startTimerRef.current();
            },
          },
          {
            text: "Continue",
            onPress: () => { if (startTimerRef.current) startTimerRef.current(); },
          },
        ]
      );
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      timerEndTimeRef.current = null;
      setIsRunning(false);
      setIsOnBreak(true);
      breakStartRef.current = Date.now();
      const accumulatedAtStart = breakTimeRef.current;
      breakTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartRef.current) / 1000);
        setBreakTime(accumulatedAtStart + elapsed);
      }, 1000);
      const nextPlayersList = sched[nextRotation - 1]?.players || [];
      setBreakModalPlayers(nextPlayersList);
      setBreakModalRotation(nextRotation);
      const transSecs = transitionSecondsRef.current;
      setTransitionExpired(false);
      if (transSecs > 0) {
        setTransitionCountdown(transSecs);
        const transEndTime = Date.now() + transSecs * 1000;
        if (transitionTimerRef.current) clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = setInterval(() => {
          const left = Math.round((transEndTime - Date.now()) / 1000);
          if (left <= 0) {
            clearInterval(transitionTimerRef.current);
            transitionTimerRef.current = null;
            setTransitionCountdown(0);
            setTransitionExpired(true);
            Vibration.vibrate([0, 500, 200, 500]);
          } else {
            setTransitionCountdown(left);
          }
        }, 1000);
      } else {
        setTransitionCountdown(0);
      }
      setShowBreakModal(true);
    }
  }, [gameId, endBreak]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining((current) => {
      timerEndTimeRef.current = Date.now() + current * 1000;
      const secs = Math.max(Math.round(current), 1);
      scheduleRotationNotification(secs, currentRotationRef.current, scheduleRef.current.length);
      return current;
    });
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.round((timerEndTimeRef.current - now) / 1000);

      const endT = gameEndTimeRef.current;
      if (endT && endT > 0) {
        const untilEnd = endT - now;
        if (untilEnd <= 300000 && untilEnd > 0) {
          setEndTimeWarning(true);
        }
        if (untilEnd <= 0 && !endTimeAlertShownRef.current) {
          setEndTimeReached(true);
          endTimeAlertShownRef.current = true;
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsRunning(false);
          cancelRotationNotification();
          const rot = currentRotationRef.current;
          const sched = scheduleRef.current;
          const left = sched.length - rot;
          Alert.alert(
            "Time's Up!",
            `End time has been reached.\n\nCurrently on rotation ${rot} of ${sched.length}.\n${left} rotation${left !== 1 ? "s" : ""} remaining.\n\nEnd the game or continue playing?`,
            [
              {
                text: "End Game",
                style: "destructive",
                onPress: async () => {
                  setGameStatus("completed");
                  await updateGameStatus(gameId, "completed");
                  Alert.alert("Game Over!", `Game ended after rotation ${rot}.`, [
                    { text: "Go Home", onPress: () => router.replace("/") },
                  ]);
                },
              },
              {
                text: "Payment",
                onPress: () => setShowPayment(true),
              },
              {
                text: "Extend 15 min",
                onPress: async () => {
                  const newEnd = Date.now() + 15 * 60 * 1000;
                  setGameEndTime(newEnd);
                  gameEndTimeRef.current = newEnd;
                  setEndTimeReached(false);
                  setEndTimeWarning(false);
                  endTimeAlertShownRef.current = false;
                  try { await updateGameEndTime(gameId, newEnd); } catch (e) {}
                  if (startTimerRef.current) startTimerRef.current();
                },
              },
              {
                text: "Continue",
                onPress: () => {
                  if (startTimerRef.current) startTimerRef.current();
                },
              },
            ]
          );
          return;
        }
      }

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        timerEndTimeRef.current = null;
        setTimeRemaining(0);
        setIsRunning(false);
        cancelRotationNotification();
        handleRotationEnd();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);
    setIsRunning(true);
  }, [handleRotationEnd]);

  useEffect(() => { startTimerRef.current = startTimer; }, [startTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerEndTimeRef.current = null;
    setIsRunning(false);
    cancelRotationNotification();
  }, []);

  const startBreak = useCallback(() => {
    pauseTimer();
    setIsOnBreak(true);
    breakStartRef.current = Date.now();
    const accumulatedAtStart = breakTimeRef.current;
    breakTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - breakStartRef.current) / 1000);
      setBreakTime(accumulatedAtStart + elapsed);
    }, 1000);
  }, [pauseTimer]);

  const endBreak = useCallback(async () => {
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    if (breakStartRef.current) {
      const elapsed = Math.floor((Date.now() - breakStartRef.current) / 1000);
      const newBreakTotal = breakTimeRef.current + elapsed;
      setBreakTime(newBreakTotal);
      breakTimeRef.current = newBreakTotal;
      breakStartRef.current = null;
      try { await updateGameBreakTime(gameId, newBreakTotal); } catch (e) {}
    }
    setIsOnBreak(false);
    await adjustRotationsForEndTime();
    startTimer();
  }, [gameId, startTimer]);

  const adjustRotationsForEndTime = useCallback(async () => {
    const endTime = gameEndTimeRef.current;
    if (!endTime || endTime <= 0) return;

    const settings = await getSettings();
    const mode = settings.distributionMode;

    if (mode === "unequal_games") return;

    const now = Date.now();
    const timeLeftSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
    const rot = currentRotationRef.current;
    const sched = scheduleRef.current;
    const remainingCount = sched.length - rot;

    if (remainingCount <= 0) return;

    const currentTimeLeft = timeRemainingRef.current;
    const futurePlayTime = (remainingCount - 1) * rotationDurationRef.current + currentTimeLeft;

    if (futurePlayTime <= timeLeftSeconds) return;

    const availableForFuture = Math.max(0, timeLeftSeconds - currentTimeLeft);
    const futureRotations = remainingCount - 1;

    if (futureRotations <= 0) return;

    let newDuration = Math.floor(availableForFuture / futureRotations);
    const MIN_ROTATION = 180;

    if (newDuration < MIN_ROTATION) newDuration = MIN_ROTATION;

    if (newDuration !== rotationDurationRef.current) {
      setRotationDuration(newDuration);
      rotationDurationRef.current = newDuration;
      const newMinutes = newDuration / 60;
      setMinutesPerGame(newMinutes);
      minutesPerGameRef.current = newMinutes;

      const adjustedMins = Math.round(newDuration / 60 * 10) / 10;
      Alert.alert(
        "Schedule Adjusted",
        `Rotation time adjusted to ${adjustedMins} min to finish on time.`
      );
    }
  }, [gameId]);

  const handleEndTimeEdit = useCallback(async (newEndTimeMs) => {
    setGameEndTime(newEndTimeMs);
    gameEndTimeRef.current = newEndTimeMs;
    try { await updateGameEndTime(gameId, newEndTimeMs); } catch (e) {}
    await adjustRotationsForEndTime();
  }, [gameId, adjustRotationsForEndTime]);

  const openEndTimePicker = useCallback(() => {
    const endDate = new Date(gameEndTimeRef.current || Date.now() + 3600000);
    let hours = endDate.getHours();
    const minutes = endDate.getMinutes();
    const amPm = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    setEditEndHour(String(hours));
    setEditEndMinute(String(minutes).padStart(2, "0"));
    setEditEndAmPm(amPm);
    setShowEndTimePicker(true);
  }, []);

  const saveEndTime = useCallback(async () => {
    let hours = parseInt(editEndHour, 10);
    const minutes = parseInt(editEndMinute, 10);
    if (isNaN(hours) || hours < 1 || hours > 12 || isNaN(minutes) || minutes < 0 || minutes > 59) {
      Alert.alert("Invalid", "Please enter a valid time.");
      return;
    }
    if (editEndAmPm === "PM" && hours !== 12) hours += 12;
    if (editEndAmPm === "AM" && hours === 12) hours = 0;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(hours, minutes, 0, 0);
    if (endDate.getTime() <= Date.now()) {
      endDate.setDate(endDate.getDate() + 1);
    }

    setShowEndTimePicker(false);
    await handleEndTimeEdit(endDate.getTime());
  }, [editEndHour, editEndMinute, editEndAmPm, handleEndTimeEdit]);

  const handleStartGame = async () => {
    try {
      const settings = await getSettings();
      const mode = settings.distributionMode;
      const totalMinutes = mode === "equal_time" ? settings.equalTimeTotalMinutes : settings.gameTotalMinutes;
      const endTime = Date.now() + totalMinutes * 60 * 1000;
      setGameEndTime(endTime);
      gameEndTimeRef.current = endTime;
      try { await updateGameEndTime(gameId, endTime); } catch (e) {}

      setGameStatus("in_progress");
      await updateGameStatus(gameId, "in_progress");
      setCurrentRotation(1);
      await updateGameRotation(gameId, 1);
      if (schedule.length > 0) {
        await updateRotationStatus(schedule[0].id, "active");
      }
      startTimer();
      scrollToRotation(0);
    } catch (error) {
      Alert.alert("Error", "Failed to start game: " + error.message);
    }
  };

  const scrollToRotation = (index) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 300);
  };

  const regenerateFutureRotations = async () => {
    const data = await getFullGameData(gameId);
    if (!data) return;
    const rot = currentRotationRef.current;
    const activePlayers = await getActivePlayers(gameId);
    const database = await getDatabase();

    const settings = await getSettings();
    const mode = settings.distributionMode;

    const pastCounts = new Map();
    activePlayers.forEach((p) => pastCounts.set(p.id, 0));
    data.rotations
      .filter((r) => r.rotation_number <= rot)
      .forEach((r) => r.players.forEach((p) => {
        pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
      }));

    const groups = new Map();
    const solos = [];
    activePlayers.forEach((p) => {
      if (p.friend_group != null) {
        if (!groups.has(p.friend_group)) groups.set(p.friend_group, []);
        groups.get(p.friend_group).push(p);
      } else {
        solos.push(p);
      }
    });
    const units = [];
    groups.forEach((members) => units.push(members));
    solos.forEach((p) => units.push([p]));

    const futureRotations = data.rotations.filter((r) => r.rotation_number > rot);

    if (mode === "equal_time" && activePlayers.length > 0) {
      const maxGameSeconds = settings.equalTimeTotalMinutes * 60;
      const oldDuration = rotationDurationRef.current;

      const transMin = (settings.transitionTotalSeconds || 0) / 60;
      const calc = calcRotationsEqualTime(activePlayers.length, settings.equalTimeTotalMinutes, transMin);
      const newTotal = Math.max(calc.totalGames, rot);
      const newDuration = Math.round(calc.minutesPerRotation * 60);
      const futureCount = newTotal - rot;

      for (const rotation of futureRotations) {
        await database.runAsync("DELETE FROM rotation_players WHERE rotation_id = ?", [rotation.id]);
        await database.runAsync("DELETE FROM rotations WHERE id = ?", [rotation.id]);
      }

      for (let i = 0; i < futureCount; i++) {
        const rotNum = rot + 1 + i;
        const rotId = await createRotation(gameId, rotNum);
        const sorted = [...units].sort((a, b) => {
          const avgA = a.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / a.length;
          const avgB = b.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / b.length;
          if (avgA !== avgB) return avgA - avgB;
          return Math.random() - 0.5;
        });
        const selected = [];
        for (const unit of sorted) {
          if (selected.length + unit.length <= 10) {
            selected.push(...unit);
          }
          if (selected.length >= 10) break;
        }
        for (const p of selected) {
          await addPlayerToRotation(rotId, p.id);
          pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
        }
      }

      if (newDuration !== oldDuration) {
        const newRemaining = Math.max(Math.round(timeRemainingRef.current * newDuration / oldDuration), 1);
        setTimeRemaining(newRemaining);
        if (timerEndTimeRef.current) {
          timerEndTimeRef.current = Date.now() + newRemaining * 1000;
        }
        setRotationDuration(newDuration);
        rotationDurationRef.current = newDuration;
        const newMinutesPerGame = newDuration / 60;
        setMinutesPerGame(newMinutesPerGame);
        minutesPerGameRef.current = newMinutesPerGame;
      }
    } else {
      for (const rotation of futureRotations) {
        await database.runAsync("DELETE FROM rotation_players WHERE rotation_id = ?", [rotation.id]);
        const sorted = [...units].sort((a, b) => {
          const avgA = a.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / a.length;
          const avgB = b.reduce((s, p) => s + (pastCounts.get(p.id) || 0), 0) / b.length;
          if (avgA !== avgB) return avgA - avgB;
          return Math.random() - 0.5;
        });
        const selected = [];
        for (const unit of sorted) {
          if (selected.length + unit.length <= 10) {
            selected.push(...unit);
          }
          if (selected.length >= 10) break;
        }
        for (const p of selected) {
          await addPlayerToRotation(rotation.id, p.id);
          pastCounts.set(p.id, (pastCounts.get(p.id) || 0) + 1);
        }
      }
    }

    const fullData = await getFullGameData(gameId);
    setGameData(fullData);
    setSchedule(fullData.rotations);
  };

  const handleAddLatePlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const jersey = (gameData?.players.length || 0) + 1;
    await addPlayer(gameId, name, jersey);
    setNewPlayerName("");
    await regenerateFutureRotations();
    Alert.alert("Player Added", `${name} added to future rotations.`);
  };

  const handleMarkNotPlaying = (player) => {
    Alert.alert(
      "Mark Not Playing",
      `Remove ${player.name} from all future rotations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            await updatePlayerStatus(player.id, "benched");
            const freshData = await getFullGameData(gameId);
            setGameData(freshData);
            await regenerateFutureRotations();
            Alert.alert("Done", `${player.name} removed from future rotations.`);
          },
        },
      ]
    );
  };

  const handleRemovePlayer = (player) => {
    const isOnCourt = gameStatus === "in_progress" &&
      schedule[currentRotation - 1]?.players.some((p) => p.id === player.id);

    if (isOnCourt) {
      Alert.alert(
        "Cannot Remove",
        `${player.name} is currently playing on court. Wait until the rotation ends or bench the player first.`
      );
      return;
    }

    Alert.alert(
      "Remove Player",
      `Permanently remove ${player.name} from the game?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deletePlayer(player.id);
            await regenerateFutureRotations();
            Alert.alert("Removed", `${player.name} has been removed.`);
          },
        },
      ]
    );
  };

  const handleExit = () => {
    if (gameStatus === "in_progress") {
      Alert.alert("Leave Game?", "The game timer will stop.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => { pauseTimer(); router.replace("/"); },
        },
      ]);
    } else {
      router.replace("/");
    }
  };

  const elapsed = (currentRotation - 1) * rotationDuration + (rotationDuration - timeRemaining);
  const totalGameTime = formatTime(Math.max(elapsed, 0));
  const endTimeDisplay = (() => {
    if (gameEndTime > 0) {
      return new Date(gameEndTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    const totalMs = schedule.length * rotationDuration * 1000;
    return new Date(Date.now() + totalMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  })();
  const progress =
    gameStatus === "in_progress"
      ? ((currentRotation - 1) / schedule.length) * 100 +
        ((rotationDuration - timeRemaining) / rotationDuration / schedule.length) * 100
      : gameStatus === "completed" ? 100 : 0;

  if (!gameData || schedule.length === 0) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.loadingText}>Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.gameName}>{gameData.game.name}</Text>

        <View style={s.timerWrap}>
          <Text style={s.timer}>{formatTime(timeRemaining)}</Text>
          <Text style={s.timerSub}>
            {gameStatus === "ready"
              ? "Ready to start"
              : gameStatus === "completed"
                ? "Game Complete"
                : `Rotation ${currentRotation} of ${schedule.length}`}
          </Text>
        </View>

        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Play Time</Text>
            <Text style={s.statValue}>{totalGameTime}</Text>
          </View>
          {breakTime > 0 && (
            <View style={s.stat}>
              <Text style={s.statLabel}>Breaks</Text>
              <Text style={[s.statValue, { color: "#FBBF24" }]}>{formatTime(breakTime)}</Text>
            </View>
          )}
          <View style={s.stat}>
            <Text style={s.statLabel}>Rotations</Text>
            <Text style={s.statValue}>
              {gameStatus === "completed" ? schedule.length : Math.max(currentRotation - 1, 0)}/{schedule.length}
            </Text>
          </View>
          <TouchableOpacity
            style={s.stat}
            onPress={gameStatus === "in_progress" ? openEndTimePicker : undefined}
            activeOpacity={gameStatus === "in_progress" ? 0.6 : 1}
          >
            <Text style={s.statLabel}>Ends At</Text>
            <Text style={[
              s.statValue,
              gameStatus === "in_progress" && { color: "#FB923C" },
              endTimeWarning && { color: "#EF4444" },
              endTimeReached && { color: "#DC2626" },
            ]}>
              {endTimeDisplay}
            </Text>
            {gameStatus === "in_progress" && !endTimeReached && <Text style={s.editHint}>tap to edit</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.btnRow}>
          {gameStatus === "ready" ? (
            <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={handleStartGame} activeOpacity={0.8}>
              <Text style={s.btnText}>Start Game</Text>
            </TouchableOpacity>
          ) : gameStatus === "in_progress" ? (
            isOnBreak ? (
              <TouchableOpacity
                style={[s.btn, s.btnGreen]}
                onPress={endBreak}
                activeOpacity={0.8}
              >
                <Text style={s.btnText}>End Break & Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btn, isRunning ? s.btnRed : s.btnGreen]}
                onPress={isRunning ? startBreak : startTimer}
                activeOpacity={0.8}
              >
                <Text style={s.btnText}>{isRunning ? "Break" : "Resume"}</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity style={[s.btn, s.btnOrange]} onPress={() => router.replace("/")} activeOpacity={0.8}>
              <Text style={s.btnText}>Back to Home</Text>
            </TouchableOpacity>
          )}
          {gameStatus !== "ready" && (
            <TouchableOpacity
              style={[s.btn, { backgroundColor: "#1E293B", borderWidth: 1, borderColor: "#FB923C", marginLeft: 10 }]}
              onPress={() => setShowPayment(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: "#FB923C" }]}>Payment</Text>
            </TouchableOpacity>
          )}
        </View>

        {isOnBreak && (
          <View style={s.breakBanner}>
            <Text style={s.breakBannerText}>BREAK — {formatTime(breakTime)}</Text>
            <TouchableOpacity onPress={openEndTimePicker} activeOpacity={0.7}>
              <Text style={s.breakEditEnd}>Edit End Time</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOnBreak && endTimeWarning && !endTimeReached && gameStatus === "in_progress" && (
          <View style={s.warningBanner}>
            <Text style={s.warningBannerText}>Less than 5 minutes until end time</Text>
          </View>
        )}

        {endTimeReached && gameStatus === "in_progress" && (
          <View style={s.overtimeBanner}>
            <Text style={s.overtimeBannerText}>OVERTIME — Past end time</Text>
            <TouchableOpacity onPress={openEndTimePicker} activeOpacity={0.7}>
              <Text style={s.breakEditEnd}>Extend</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {(gameStatus === "ready" || gameStatus === "in_progress") && (
        <TouchableOpacity
          style={s.manageBtn}
          onPress={() => setShowManage(true)}
          activeOpacity={0.8}
        >
          <Text style={s.manageBtnText}>Manage Players</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showManage} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Manage Players</Text>
              <TouchableOpacity onPress={() => { setShowManage(false); setLinkMode(false); setSelectedForLink([]); }}>
                <Text style={s.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={s.linkBar}>
              {linkMode ? (
                <>
                  <Text style={s.linkHint}>Tap players to link as friends</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[s.linkBtn, selectedForLink.length >= 2 && s.linkBtnReady]}
                      disabled={selectedForLink.length < 2}
                      onPress={async () => {
                        await linkFriends(selectedForLink, gameId);
                        await regenerateFutureRotations();
                        setSelectedForLink([]);
                        setLinkMode(false);
                        const freshData = await getFullGameData(gameId);
                        setGameData(freshData);
                        Alert.alert("Linked", "Players will always play together.");
                      }}
                    >
                      <Text style={s.linkBtnText}>Link ({selectedForLink.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => { setLinkMode(false); setSelectedForLink([]); }}
                    >
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={s.linkBtn}
                  onPress={() => setLinkMode(true)}
                >
                  <Text style={s.linkBtnText}>Link Friends</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={s.playerList}>
              {gameData?.players.map((player) => {
                const inCurrent = schedule[currentRotation - 1]?.players.some(
                  (p) => p.id === player.id
                );
                const futureCount = schedule
                  .filter((r) => r.rotation_number > currentRotation)
                  .filter((r) => r.players.some((p) => p.id === player.id)).length;
                const isSelected = selectedForLink.includes(player.id);
                const groupLabel = player.friend_group != null ? `G${player.friend_group}` : null;

                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[s.pRow, isSelected && s.pRowSelected, groupLabel && s.pRowLinked]}
                    onPress={linkMode ? () => {
                      setSelectedForLink((prev) =>
                        prev.includes(player.id)
                          ? prev.filter((id) => id !== player.id)
                          : [...prev, player.id]
                      );
                    } : undefined}
                    activeOpacity={linkMode ? 0.6 : 1}
                  >
                    <View style={s.pInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.pName}>{player.name}</Text>
                        {groupLabel && (
                          <View style={s.groupBadge}>
                            <Text style={s.groupBadgeText}>{groupLabel}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.pSub}>
                        Played: {player.times_played || 0}x
                        {inCurrent ? "  |  ON COURT" : ""}
                        {futureCount > 0 ? `  |  ${futureCount} upcoming` : "  |  benched"}
                      </Text>
                    </View>
                    {!linkMode && (
                      <View style={s.pActions}>
                        {player.status !== "benched" ? (
                          <TouchableOpacity
                            style={s.pBtnWarn}
                            onPress={() => handleMarkNotPlaying(player)}
                          >
                            <Text style={s.pBtnText}>Sit</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.pBtnGreen}
                            onPress={async () => {
                              await updatePlayerStatus(player.id, "active");
                              const freshData = await getFullGameData(gameId);
                              setGameData(freshData);
                              await regenerateFutureRotations();
                              Alert.alert("Activated", `${player.name} added back to rotations.`);
                            }}
                          >
                            <Text style={s.pBtnText}>Activate</Text>
                          </TouchableOpacity>
                        )}
                        {player.friend_group != null ? (
                          <TouchableOpacity
                            style={s.pBtnDanger}
                            onPress={async () => {
                              await unlinkPlayer(player.id);
                              await regenerateFutureRotations();
                              const freshData = await getFullGameData(gameId);
                              setGameData(freshData);
                              Alert.alert("Unlinked", `${player.name} is now independent.`);
                            }}
                          >
                            <Text style={s.pBtnText}>Unlink</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.pBtnDanger}
                            onPress={() => handleRemovePlayer(player)}
                          >
                            <Text style={s.pBtnText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEndTimePicker} animationType="fade" transparent>
        <View style={s.etOverlay}>
          <View style={s.etContent}>
            <Text style={s.etTitle}>Edit End Time</Text>
            <View style={s.etRow}>
              <TextInput
                style={s.etInput}
                value={editEndHour}
                onChangeText={setEditEndHour}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor="#64748B"
              />
              <Text style={s.etColon}>:</Text>
              <TextInput
                style={s.etInput}
                value={editEndMinute}
                onChangeText={setEditEndMinute}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor="#64748B"
              />
              <TouchableOpacity
                style={s.etAmPm}
                onPress={() => setEditEndAmPm((p) => p === "AM" ? "PM" : "AM")}
                activeOpacity={0.7}
              >
                <Text style={s.etAmPmText}>{editEndAmPm}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.etBtnRow}>
              <TouchableOpacity
                style={s.etCancelBtn}
                onPress={() => setShowEndTimePicker(false)}
                activeOpacity={0.8}
              >
                <Text style={s.etCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.etSaveBtn}
                onPress={saveEndTime}
                activeOpacity={0.8}
              >
                <Text style={s.etSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBreakModal} animationType="fade" transparent>
        <View style={s.etOverlay}>
          <View style={s.etContent}>
            <Text style={s.etTitle}>Rotation {breakModalRotation} — Next Players</Text>
            {transitionCountdown > 0 && (
              <Text style={{ color: "#FB923C", fontSize: 32, fontWeight: "bold", textAlign: "center", marginVertical: 8 }}>
                {formatTime(transitionCountdown)}
              </Text>
            )}
            {transitionExpired && (
              <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "bold", textAlign: "center", marginVertical: 8 }}>
                Transition time is up!
              </Text>
            )}
            <View style={s.breakPlayerList}>
              {breakModalPlayers.map((p, i) => (
                <View key={p.id} style={s.breakPlayerRow}>
                  <Text style={s.breakPlayerNum}>{i + 1}.</Text>
                  <Text style={s.breakPlayerName}>{p.name}</Text>
                  {p.jersey_number != null && (
                    <Text style={s.breakPlayerJersey}>#{p.jersey_number}</Text>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: "#16A34A",
                paddingVertical: 14,
                borderRadius: 12,
                marginTop: 20,
              }}
              onPress={() => {
                if (transitionTimerRef.current) {
                  clearInterval(transitionTimerRef.current);
                  transitionTimerRef.current = null;
                }
                setTransitionCountdown(0);
                setTransitionExpired(false);
                setShowBreakModal(false);
                endBreak();
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 }}>
                {transitionCountdown > 0 ? "Start Now" : "End Break & Resume"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPayment} animationType="fade" transparent>
        <View style={s.etOverlay}>
          <View style={s.etContent}>
            <Text style={s.etTitle}>Payment</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {gameData?.players.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#334155",
                  }}
                  onPress={() => {
                    setPaidPlayers((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 24, height: 24, borderRadius: 6,
                    borderWidth: 2, borderColor: paidPlayers.has(p.id) ? "#16A34A" : "#64748B",
                    backgroundColor: paidPlayers.has(p.id) ? "#16A34A" : "transparent",
                    alignItems: "center", justifyContent: "center", marginRight: 12,
                  }}>
                    {paidPlayers.has(p.id) && (
                      <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "bold" }}>✓</Text>
                    )}
                  </View>
                  <Text style={{ color: "#FFF", fontSize: 15, flex: 1 }}>{p.name}</Text>
                  {p.jersey_number != null && (
                    <Text style={{ color: "#94A3B8", fontSize: 13 }}>#{p.jersey_number}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{
              marginTop: 16, paddingTop: 12,
              borderTopWidth: 1, borderTopColor: "#334155",
            }}>
              <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                {paidPlayers.size} of {gameData?.players.length || 0} players paid
              </Text>
              <Text style={{ color: "#FB923C", fontSize: 22, fontWeight: "bold", marginTop: 4 }}>
                Total: {paidPlayers.size * paymentAmount}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: "#1E293B",
                paddingVertical: 14,
                borderRadius: 12,
                marginTop: 16,
                borderWidth: 1,
                borderColor: "#334155",
              }}
              onPress={() => setShowPayment(false)}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={schedule}
        keyExtractor={(item) => item.id.toString()}
        style={s.list}
        contentContainerStyle={s.listContent}
        renderItem={({ item, index }) => (
          <RotationCard
            rotation={item}
            isActive={gameStatus === "in_progress" && index === currentRotation - 1}
            isCompleted={gameStatus === "completed" || index < currentRotation - 1}
          />
        )}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 500);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  loadingWrap: { flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#FFF", fontSize: 17 },
  header: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  gameName: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 4 },
  timerWrap: { alignItems: "center", marginBottom: 12 },
  timer: { fontSize: 56, fontWeight: "bold", color: "#FFF", letterSpacing: 4 },
  timerSub: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  progressBg: { width: "100%", backgroundColor: "#334155", height: 5, borderRadius: 3, marginBottom: 12 },
  progressFill: { backgroundColor: "#F97316", height: 5, borderRadius: 3 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  stat: { alignItems: "center" },
  statLabel: { color: "#94A3B8", fontSize: 11 },
  statValue: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  btnRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12 },
  btnHalf: { flex: 1 },
  btnThird: { flex: 1 },
  btnGreen: { backgroundColor: "#16A34A" },
  btnYellow: { backgroundColor: "#CA8A04" },
  btnBlue: { backgroundColor: "#2563EB" },
  btnRed: { backgroundColor: "#DC2626" },
  btnOrange: { backgroundColor: "#F97316" },
  btnText: { color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  manageBtn: {
    backgroundColor: "#334155",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
  },
  manageBtnText: { color: "#FB923C", textAlign: "center", fontWeight: "bold", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  modalClose: { color: "#FB923C", fontSize: 16, fontWeight: "600" },
  addRow: { flexDirection: "row", padding: 12, gap: 8 },
  addInput: {
    flex: 1,
    backgroundColor: "#0F172A",
    color: "#FFF",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#475569",
  },
  addBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addActive: { backgroundColor: "#16A34A" },
  addDisabled: { backgroundColor: "#475569" },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  playerList: { paddingHorizontal: 12 },
  pRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  pInfo: { flex: 1 },
  pName: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  pSub: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  pActions: { flexDirection: "row", gap: 6 },
  pBtnWarn: { backgroundColor: "#CA8A04", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnGreen: { backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnDanger: { backgroundColor: "#DC2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  pRowSelected: { backgroundColor: "#1E3A5F", borderWidth: 2, borderColor: "#3B82F6" },
  pRowLinked: { borderLeftWidth: 3, borderLeftColor: "#FB923C" },
  linkBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  linkHint: { color: "#94A3B8", fontSize: 13 },
  linkBtn: { backgroundColor: "#1E293B", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#FB923C" },
  linkBtnReady: { backgroundColor: "#FB923C" },
  linkBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  cancelBtn: { backgroundColor: "#334155", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  cancelBtnText: { color: "#94A3B8", fontWeight: "bold", fontSize: 13 },
  groupBadge: { backgroundColor: "#FB923C", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  groupBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  editHint: { color: "#FB923C", fontSize: 9, marginTop: 1 },
  breakBanner: {
    backgroundColor: "#7F1D1D",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakBannerText: { color: "#FCA5A5", fontWeight: "bold", fontSize: 15 },
  breakEditEnd: { color: "#FB923C", fontWeight: "bold", fontSize: 13 },
  warningBanner: {
    backgroundColor: "#78350F",
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  warningBannerText: { color: "#FDE68A", fontWeight: "bold", fontSize: 13 },
  overtimeBanner: {
    backgroundColor: "#7F1D1D",
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overtimeBannerText: { color: "#FCA5A5", fontWeight: "bold", fontSize: 14 },
  etOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  etContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "#475569",
  },
  etTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
  etRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 },
  etInput: {
    backgroundColor: "#0F172A",
    color: "#FFF",
    fontSize: 28,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#475569",
    textAlign: "center",
    width: 70,
  },
  etColon: { color: "#FFF", fontSize: 28, fontWeight: "bold" },
  etAmPm: {
    backgroundColor: "#F97316",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  etAmPmText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  etBtnRow: { flexDirection: "row", gap: 12 },
  etCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#334155",
    borderWidth: 1,
    borderColor: "#475569",
  },
  etCancelText: { color: "#94A3B8", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  etSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F97316",
  },
  etSaveText: { color: "#FFF", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  breakPlayerList: { marginBottom: 4 },
  breakPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  breakPlayerNum: { color: "#94A3B8", fontSize: 16, width: 30 },
  breakPlayerName: { color: "#FFF", fontSize: 16, fontWeight: "600", flex: 1 },
  breakPlayerJersey: { color: "#F59E0B", fontSize: 14, fontWeight: "bold" },
  list: { flex: 1 },
  listContent: { padding: 16 },
});
