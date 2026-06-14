import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// A pulsing red border drawn over the whole screen in the final seconds of a
// rotation, so the countdown is visible from across the gym even when the phone
// is propped on a bench. Non-interactive so it never blocks the controls.
export default function UrgentEdge({ active }) {
  const v = useSharedValue(0);

  useEffect(() => {
    if (active) {
      v.value = withRepeat(
        withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      cancelAnimation(v);
      v.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(v);
  }, [active]);

  const style = useAnimatedStyle(() => ({ opacity: v.value }));

  return <Animated.View pointerEvents="none" style={[s.edge, style]} />;
}

const s = StyleSheet.create({
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 6,
    borderColor: "#EF4444",
    zIndex: 50,
  },
});
