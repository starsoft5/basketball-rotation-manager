import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SIZE = 180;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

export default function CircularTimer({ timeRemaining, totalDuration, formattedTime, subtitle, blink }) {
  const progress = totalDuration > 0 ? Math.max(0, Math.min(1, timeRemaining / totalDuration)) : 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const urgent = timeRemaining <= 10 && timeRemaining > 0;
  const strokeColor = urgent ? "#EF4444" : "#F97316";
  const blinkHidden = urgent && blink;

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
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={blinkHidden ? "#EF444466" : strokeColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={s.textWrap}>
        <Text style={[
          s.timer,
          urgent && { color: "#EF4444" },
          blinkHidden && { opacity: 0.2 },
        ]}>
          {formattedTime}
        </Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
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
  timer: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#FFF",
    letterSpacing: 2,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
});
