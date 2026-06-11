import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  ZoomIn,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// #9 — expanding ring "whistle burst" shown on GO.
function Ripple() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withTiming(5, { duration: 650, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View pointerEvents="none" style={[s.ripple, style]} />;
}

// #8 — full-screen "3 · 2 · 1 · GO!" kickoff countdown. Drives itself once
// `visible` is set, firing a haptic per beat and calling onDone after GO.
export default function CountdownOverlay({ visible, onDone }) {
  const [step, setStep] = useState(null); // 3,2,1 then 0 = GO

  useEffect(() => {
    setStep(visible ? 3 : null);
  }, [visible]);

  useEffect(() => {
    if (step == null) return;
    if (step < 0) {
      onDone && onDone();
      return;
    }
    if (step === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    const t = setTimeout(() => setStep((prev) => prev - 1), step === 0 ? 650 : 800);
    return () => clearTimeout(t);
  }, [step]);

  if (!visible || step == null || step < 0) return null;

  const isGo = step === 0;

  return (
    <View style={s.overlay}>
      {isGo && <Ripple />}
      <Animated.Text
        key={step}
        entering={ZoomIn.duration(320).springify().damping(11)}
        style={[s.num, isGo && s.go]}
      >
        {isGo ? "GO!" : String(step)}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.82)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  num: {
    color: "#F97316",
    fontSize: 120,
    fontWeight: "bold",
  },
  go: {
    color: "#22C55E",
    fontSize: 96,
  },
  ripple: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#22C55E",
  },
});
