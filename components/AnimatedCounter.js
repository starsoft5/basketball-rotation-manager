import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";

// #7 — counts up from 0 to `value` on mount / when value changes. Uses the rAF
// timestamp (no Date.now) and eases out cubic so it decelerates into the target.
export default function AnimatedCounter({ value, duration = 700, style, suffix = "" }) {
  const [display, setDisplay] = useState(value > 0 ? 0 : value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(value);
      return;
    }
    let start = null;
    setDisplay(0);
    const step = (ts) => {
      if (start == null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  );
}
