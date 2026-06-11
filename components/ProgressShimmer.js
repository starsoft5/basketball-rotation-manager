import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

const STRIP_WIDTH = 36;

// #5 — a soft highlight that sweeps across the progress bar while the game is
// running. Self-measures the track width via onLayout. Render inside a clipped
// (overflow: hidden) fill so it only shows over the completed portion.
export default function ProgressShimmer({ active = true }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(-STRIP_WIDTH);

  useEffect(() => {
    if (!active || w === 0) {
      cancelAnimation(x);
      return;
    }
    x.value = -STRIP_WIDTH;
    x.value = withRepeat(
      withTiming(w + STRIP_WIDTH, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(x);
  }, [active, w]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {active && w > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              width: STRIP_WIDTH,
              backgroundColor: "rgba(255,255,255,0.35)",
            },
            style,
          ]}
        />
      )}
    </View>
  );
}
