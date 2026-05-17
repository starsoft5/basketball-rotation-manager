/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        court: "#C35817",
        courtDark: "#8B4513",
        basketball: "#FF6B35",
        teamA: "#1E40AF",
        teamB: "#DC2626",
      },
    },
  },
  plugins: [],
};
