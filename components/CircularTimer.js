import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolateColor,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 180;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

export default function CircularTimer({
  timeRemaining,
  totalDuration,
  formattedTime,
  subtitle,
  running,
  onBreak,
}) {
  const progress = totalDuration > 0 ? Math.max(0, Math.min(1, timeRemaining / totalDuration)) : 1;
  const urgent = timeRemaining <= 10 && timeRemaining > 0;
  // #3 — a softer pre-warning beat in the 11-20s window before the urgent heartbeat.
  const warnPulse = timeRemaining <= 20 && timeRemaining > 10;

  // #2 — smoothly sweep the ring toward each new per-second target.
  const animatedProgress = useSharedValue(progress);
  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 950, easing: Easing.linear });
  }, [progress]);

  // #6 — blend the ring toward amber while on break. breakT 0 = normal, 1 = break.
  const breakT = useSharedValue(onBreak ? 1 : 0);
  useEffect(() => {
    breakT.value = withTiming(onBreak ? 1 : 0, { duration: 300 });
  }, [onBreak]);

  const ringProps = useAnimatedProps(() => {
    // #3 — full-journey urgency color: green (plenty of time) -> orange -> red
    // (critical), driven by how much of the ring is left. Sweeps smoothly with
    // the ring because it reads the same animated fill value.
    const gradient = interpolateColor(
      animatedProgress.value,
      [0, 0.15, 0.45],
      ["#EF4444", "#F97316", "#22C55E"]
    );
    const stroke = interpolateColor(breakT.value, [0, 1], [gradient, "#FBBF24"]);
    return {
      strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
      stroke,
    };
  });

  // #1/#6 — heartbeat pulse when time is low and running; a gentle breathe while
  // on break; steady otherwise. All on the UI thread.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (onBreak) {
      pulse.value = withRepeat(
        withTiming(1.05, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else if (urgent && running) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 250, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 250, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else if (warnPulse && running) {
      // #3 — gentler, slower pre-warning beat that escalates into the urgent one.
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [urgent, warnPulse, running, onBreak]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const numberColor = onBreak ? "#FBBF24" : urgent ? "#EF4444" : "#FFF";

  return (
    <View style={s.container}>
      <Svg
        width={SIZE}
        height={SIZE}
        style={[s.svg, { transform: [{ rotate: "-90deg" }] }]}
      >
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#334155"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          animatedProps={ringProps}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View style={[s.textWrap, pulseStyle]}>
        <Text
          allowFontScaling={false}
          style={[s.timeText, { color: numberColor }]}
        >
          {formattedTime}
        </Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  svg: {
    position: "absolute",
  },
  textWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 44,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    textAlign: "center",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
});
