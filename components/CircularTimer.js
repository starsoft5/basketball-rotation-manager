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
import OdometerTime from "./OdometerTime";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 180;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;
const COLOR_RAMP_SECONDS = 30;

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

  // #2 — smoothly sweep the ring toward each new per-second target.
  const animatedProgress = useSharedValue(progress);
  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 950, easing: Easing.linear });
  }, [progress]);

  // #1 — gradually shift orange -> red across the final stretch instead of a
  // hard switch. colorT 0 = orange, 1 = red.
  const colorT = useSharedValue(0);
  useEffect(() => {
    let target = 0;
    if (timeRemaining <= 0) target = 1;
    else if (timeRemaining <= COLOR_RAMP_SECONDS) target = (COLOR_RAMP_SECONDS - timeRemaining) / COLOR_RAMP_SECONDS;
    colorT.value = withTiming(target, { duration: 950, easing: Easing.linear });
  }, [timeRemaining]);

  // #6 — blend the ring toward amber while on break. breakT 0 = normal, 1 = break.
  const breakT = useSharedValue(onBreak ? 1 : 0);
  useEffect(() => {
    breakT.value = withTiming(onBreak ? 1 : 0, { duration: 300 });
  }, [onBreak]);

  const ringProps = useAnimatedProps(() => {
    const gradient = interpolateColor(colorT.value, [0, 1], ["#F97316", "#EF4444"]);
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
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [urgent, running, onBreak]);

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
        <OdometerTime time={formattedTime} fontSize={44} color={numberColor} />
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
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
});
