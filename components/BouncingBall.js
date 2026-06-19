import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// A 🏀 that either bounces + spins (loading) or gently bobs (idle empty state).
// All on the UI thread; no Date.now/Math.random.
export default function BouncingBall({ size = 56, mode = "bounce", style }) {
  const y = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    if (mode === "bounce") {
      y.value = withRepeat(
        withSequence(
          withTiming(-size * 0.4, { duration: 380, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.bounce })
        ),
        -1,
        false
      );
      rot.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      // gentle idle bob for empty states
      y.value = withRepeat(
        withTiming(-7, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    }
    return () => {
      cancelAnimation(y);
      cancelAnimation(rot);
    };
  }, [mode, size]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
  }));

  return <Animated.Text style={[{ fontSize: size }, animStyle, style]}>🏀</Animated.Text>;
}
