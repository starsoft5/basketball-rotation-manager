import { useState, useRef, useEffect } from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, BackHandler } from "react-native";
import AnimatedButton from "../components/AnimatedButton";
import { checkLicense } from "../utils/license";

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

  useEffect(() => {
    if (!isGame) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, [isGame]);

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

  const backLabel = isGame
    ? (confirmBack ? "Click Again To Exit Current Game" : "← Back")
    : pathname === "/setup" || pathname.startsWith("/players")
      ? "← Back to Basketball Rotation Manager"
      : "← Back";

  const titles = {
    "/": "Basketball Rotation Manager",
    "/history": "Game History",
    "/share": "Share App",
  };

  const title = titles[pathname] || null;

  return (
    <View style={s.header}>
      {!isHome && (
        <AnimatedButton onPress={handleBack} style={s.backBtn}>
          <Text style={s.backText}>
            {backLabel}
          </Text>
        </AnimatedButton>
      )}
      {title && (
        <Text style={[s.headerTitle, isHome && s.headerTitleCenter]}>
          {title}
        </Text>
      )}
    </View>
  );
}

function ExpiredScreen() {
  return (
    <View style={s.expiredContainer}>
      <Text style={s.expiredEmoji}>⏰</Text>
      <Text style={s.expiredTitle}>Trial Expired</Text>
      <Text style={s.expiredText}>
        Your 14-day trial has ended.{"\n"}Thank you for trying Basketball Rotation!
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [licenseState, setLicenseState] = useState({ checking: true, valid: false });

  useEffect(() => {
    let interval;
    const check = async () => {
      const result = await checkLicense();
      setLicenseState({ checking: false, valid: result.valid, remaining: result.remaining });
      if (result.valid && result.remaining > 0) {
        const next = Math.min(result.remaining, 60000);
        interval = setTimeout(check, next);
      }
    };
    check();
    return () => { if (interval) clearTimeout(interval); };
  }, []);

  if (licenseState.checking) {
    return (
      <View style={s.container}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!licenseState.valid) {
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <ExpiredScreen />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <Header />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "#0F172A" },
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    backgroundColor: "#1E293B",
    paddingTop: 36,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  backBtn: { marginBottom: 2 },
  backText: { color: "#FB923C", fontSize: 14, fontWeight: "600" },
  headerTitle: {
    color: "#FB923C",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitleCenter: { textAlign: "center" },
  expiredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#0F172A",
  },
  expiredEmoji: { fontSize: 64, marginBottom: 16 },
  expiredTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#EF4444",
    marginBottom: 12,
  },
  expiredText: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
