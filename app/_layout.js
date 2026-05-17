import { useState, useRef, useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";

function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isGame = pathname.startsWith("/game");

  const [confirmBack, setConfirmBack] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => {
    setConfirmBack(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, [pathname]);

  const handleBack = () => {
    if (isGame && !confirmBack) {
      setConfirmBack(true);
      confirmTimer.current = setTimeout(() => setConfirmBack(false), 3000);
      return;
    }
    setConfirmBack(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    router.back();
  };

  const titles = {
    "/": "Basketball Rotation Manager",
    "/setup": "New Game Setup",
    "/history": "Game History",
  };

  const title =
    titles[pathname] ||
    (pathname.startsWith("/players") ? "Add Players" :
     pathname.startsWith("/game") ? "Game" : "Basketball");

  return (
    <View style={s.header}>
      {!isHome && (
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Text style={s.backText}>
            {confirmBack ? "Click again to Back Game" : "← Back"}
          </Text>
        </TouchableOpacity>
      )}
      <Text style={[s.headerTitle, isHome && s.headerTitleCenter]}>
        {title}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <Header />
      <Slot />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    backgroundColor: "#1E293B",
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { marginRight: 8 },
  backText: { color: "#FB923C", fontSize: 16, fontWeight: "600" },
  headerTitle: {
    color: "#FB923C",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  headerTitleCenter: { textAlign: "center" },
});
