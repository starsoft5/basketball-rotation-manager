import { Platform } from "react-native";

let BringToFront = null;
if (Platform.OS !== "web") {
  const { requireNativeModule } = require("expo-modules-core");
  BringToFront = requireNativeModule("BringToFront");
}

const noop = async () => {};

export const bringToFront = BringToFront ? () => BringToFront.bringToFront() : noop;
export const canOverlay = BringToFront ? () => BringToFront.canOverlay() : async () => false;
export const openOverlaySettings = BringToFront ? () => BringToFront.openOverlaySettings() : noop;
export const scheduleAlarm = BringToFront ? (seconds) => BringToFront.scheduleAlarm(seconds) : noop;
export const cancelAlarm = BringToFront ? () => BringToFront.cancelAlarm() : noop;
export const isIgnoringBatteryOptimizations = BringToFront ? () => BringToFront.isIgnoringBatteryOptimizations() : async () => true;
export const requestIgnoreBatteryOptimizations = BringToFront ? () => BringToFront.requestIgnoreBatteryOptimizations() : noop;
export const beep = BringToFront ? (durationMs) => BringToFront.beep(durationMs) : noop;
export const beepFinal = BringToFront ? () => BringToFront.beepFinal() : noop;
export const speak = BringToFront ? (text) => BringToFront.speak(text) : noop;
