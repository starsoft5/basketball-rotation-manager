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
// rolls the digit like an odometer/flip clock. Width is fixed so columns line
// up regardless of per-glyph metrics, and font scaling is disabled so the OS
// accessibility/display-zoom setting on other devices can't desync the glyph
// size from the `height`-based roll math (which would overlap the digits).
function Digit({ digit, fontSize, color, height, width }) {
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
    <View style={{ height, width, overflow: "hidden" }}>
      <Animated.View style={style}>
        {DIGITS.map((n) => (
          <Text
            key={n}
            allowFontScaling={false}
            style={{
              fontSize,
              lineHeight: height,
              color,
              fontWeight: "bold",
              width,
              height,
              textAlign: "center",
              textAlignVertical: "center",
              includeFontPadding: false,
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
  const digitWidth = Math.round(fontSize * 0.62);

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
              width={digitWidth}
            />
          );
        }
        return (
          <Text
            key={i}
            allowFontScaling={false}
            style={{
              fontSize,
              lineHeight: height,
              height,
              color,
              fontWeight: "bold",
              textAlign: "center",
              textAlignVertical: "center",
              includeFontPadding: false,
              paddingHorizontal: Math.round(fontSize * 0.04),
            }}
          >
            {ch}
          </Text>
        );
      })}
    </View>
  );
}
