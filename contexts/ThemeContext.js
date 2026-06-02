import { createContext, useContext, useState, useEffect } from "react";
import { getSettings, saveSetting } from "../db/database";

const dark = {
  background: "#0F172A",
  card: "#1E293B",
  cardAlt: "#263348",
  border: "#334155",
  borderLight: "#475569",
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  textTertiary: "#CBD5E1",
  textMuted: "#64748B",
  accent: "#FB923C",
  accentBright: "#F97316",
  green: "#16A34A",
  greenDark: "#15803D",
  red: "#DC2626",
  redDark: "#7F1D1D",
  yellow: "#CA8A04",
  yellowDark: "#78350F",
  blue: "#3B82F6",
  overlay: "rgba(0,0,0,0.7)",
  chipActive: "rgba(249,115,22,0.15)",
  chipActiveBorder: "rgba(249,115,22,0.4)",
  chipDone: "rgba(21,128,61,0.15)",
  chipDoneBorder: "rgba(21,128,61,0.3)",
  chipHighlight: "rgba(59,130,246,0.2)",
  chipRemove: "rgba(220,38,38,0.25)",
  selectedRow: "rgba(59,130,246,0.1)",
};

const light = {
  background: "#F1F5F9",
  card: "#FFFFFF",
  cardAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderLight: "#CBD5E1",
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#334155",
  textMuted: "#94A3B8",
  accent: "#EA580C",
  accentBright: "#C2410C",
  green: "#16A34A",
  greenDark: "#15803D",
  red: "#DC2626",
  redDark: "#FEE2E2",
  yellow: "#CA8A04",
  yellowDark: "#FEF3C7",
  blue: "#3B82F6",
  overlay: "rgba(0,0,0,0.5)",
  chipActive: "rgba(249,115,22,0.12)",
  chipActiveBorder: "rgba(249,115,22,0.35)",
  chipDone: "rgba(21,128,61,0.12)",
  chipDoneBorder: "rgba(21,128,61,0.25)",
  chipHighlight: "rgba(59,130,246,0.15)",
  chipRemove: "rgba(220,38,38,0.15)",
  selectedRow: "rgba(59,130,246,0.08)",
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.theme === "light") setIsDark(false);
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    saveSetting("theme", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
