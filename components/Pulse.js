import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// #7 — wraps children in a continuous opacity pulse, for "needs attention"
// elements like the overtime banner or a transition countdown.
export default function Pulse({ children, style, min = 0.4, max = 1, duration = 650 }) {
  const v = useSharedValue(max);

  useEffect(() => {
    v.value = withRepeat(
      withTiming(min, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(v);
  }, []);

  const aStyle = useAnimatedStyle(() => ({ opacity: v.value }));

  return <Animated.View style={[style, aStyle]}>{children}</Animated.View>;
}
