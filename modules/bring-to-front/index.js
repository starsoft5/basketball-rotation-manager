import { requireNativeModule } from "expo-modules-core";

const BringToFront = requireNativeModule("BringToFront");

export async function bringToFront() { return BringToFront.bringToFront(); }
export async function canOverlay() { return BringToFront.canOverlay(); }
export async function openOverlaySettings() { return BringToFront.openOverlaySettings(); }
export async function scheduleAlarm(seconds) { return BringToFront.scheduleAlarm(seconds); }
export async function cancelAlarm() { return BringToFront.cancelAlarm(); }
export async function beep(durationMs) { return BringToFront.beep(durationMs); }
export async function beepFinal() { return BringToFront.beepFinal(); }
export async function speak(text) { return BringToFront.speak(text); }
