import { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PARTICLE_COUNT = 50;
const DURATION = 3000;
const COLORS = ["#F97316", "#3B82F6", "#16A34A", "#EF4444", "#EAB308", "#8B5CF6", "#EC4899", "#06B6D4"];

function Particle({ config }) {
  const translateY = useSharedValue(config.startY);
  const translateX = useSharedValue(config.startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(config.delay, withTiming(SCREEN_H + 50, { duration: DURATION - config.delay, easing: Easing.in(Easing.quad) }));
    translateX.value = withDelay(config.delay, withTiming(config.startX + config.drift, { duration: DURATION - config.delay }));
    rotate.value = withDelay(config.delay, withRepeat(withTiming(360, { duration: 800 + Math.random() * 400 }), -1));
    opacity.value = withDelay(config.delay + DURATION - 800, withTiming(0, { duration: 600 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: config.size,
          height: config.size * config.aspect,
          backgroundColor: config.color,
          borderRadius: config.rounded ? config.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

export default function ConfettiAnimation({ visible, onComplete }) {
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_W,
      startY: -20 - Math.random() * 80,
      drift: (Math.random() - 0.5) * 120,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 10,
      aspect: 0.6 + Math.random() * 0.8,
      rounded: Math.random() > 0.5,
      delay: Math.random() * 600,
    }));
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, DURATION + 500);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} config={p} />
      ))}
    </Animated.View>
  );
}
