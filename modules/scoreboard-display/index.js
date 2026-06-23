import { Platform } from "react-native";

let M = null;
if (Platform.OS !== "web") {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    M = requireNativeModule("ScoreboardDisplay");
  } catch (e) {
    M = null;
  }
}

export const hasNativeDisplaySupport = !!M;
export const getDisplays = M ? () => M.getDisplays() : async () => [];
export const presentScoreboard = M ? (state) => M.present(state) : async () => ({ ok: false, reason: "unavailable" });
export const updateScoreboard = M ? (state) => M.update(state) : async () => false;
export const dismissScoreboard = M ? () => M.dismiss() : async () => false;
