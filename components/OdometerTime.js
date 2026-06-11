import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// #2 — a single rolling digit. The 0-9 column slides vertically so each tick
// rolls the digit like an odometer/flip clock.
function Digit({ digit, fontSize, color, height }) {
  const offset = useSharedValue(-digit * height);

  useEffect(() => {
    offset.value = withTiming(-digit * height, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [digit]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View style={{ height, overflow: "hidden" }}>
      <Animated.View style={style}>
        {DIGITS.map((n) => (
          <Text
            key={n}
            style={{
              fontSize,
              lineHeight: height,
              color,
              fontWeight: "bold",
              letterSpacing: 2,
              textAlign: "center",
            }}
          >
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

// Renders a "MM:SS" string with each digit on a rolling column and the colon
// static. Assumes constant-width padded time (e.g. "09:59").
export default function OdometerTime({ time, fontSize = 44, color = "#FFF" }) {
  const height = Math.round(fontSize * 1.15);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {time.split("").map((ch, i) => {
        if (ch >= "0" && ch <= "9") {
          return (
            <Digit
              key={i}
              digit={Number(ch)}
              fontSize={fontSize}
              color={color}
              height={height}
            />
          );
        }
        return (
          <Text
            key={i}
            style={{
              fontSize,
              lineHeight: height,
              color,
              fontWeight: "bold",
              letterSpacing: 2,
            }}
          >
            {ch}
          </Text>
        );
      })}
    </View>
  );
}
