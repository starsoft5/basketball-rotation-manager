import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

// #3 — full-screen buzzer flash. Bump `trigger` (any changing value) to fire a
// quick color flash. trigger === 0 is treated as the initial mount and skipped.
export default function RotationFlash({ trigger, color = "#F97316" }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    opacity.value = withSequence(
      withTiming(0.55, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })
    );
  }, [trigger]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]}
    />
  );
}
