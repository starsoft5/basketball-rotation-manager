import { useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

// #3 — a Text that does a quick scale-bump whenever its value changes, drawing
// the eye to a stat that just advanced (e.g. rotation count).
export default function BumpText({ value, style }) {
  const scale = useSharedValue(1);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      scale.value = withSequence(
        withTiming(1.3, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) })
      );
    }
  }, [value]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.Text style={[style, aStyle]}>{value}</Animated.Text>;
}
