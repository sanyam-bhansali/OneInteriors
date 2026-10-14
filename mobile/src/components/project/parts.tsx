import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from '../../lib/motion';
import { motion } from '../../lib/theme';

/**
 * Parts only Project, Decision and Snags use: their icons (the design's
 * 24-grid line icons, stroke 1.8) and the motion the tracker adds — a stage
 * line that fills from the top, the pulsing "now" dot, and the pop of a
 * chosen option. With "reduce motion" on, each lands at once.
 */

type P = { color: ColorValue; size?: number };
const s = (c: ColorValue) => ({ fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

/** The snag tile's box with a tick. */
export const SnagIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M9 11l3 3 8-8" {...s(color)} />
    <Path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" {...s(color)} />
  </Svg>
);

export const CalendarIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="3" y="5" width="18" height="16" rx="2" {...s(color)} />
    <Path d="M3 10h18M8 3v4M16 3v4" {...s(color)} />
  </Svg>
);

export const TickIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M20 6 9 17l-5-5" {...s(color)} strokeWidth={2.5} />
  </Svg>
);

export const ChevronBack = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="m15 18-6-6 6-6" {...s(color)} />
  </Svg>
);

/** The camera of "Photograph a problem". */
export const SnapIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" {...s(color)} />
    <Circle cx="12" cy="13" r="3.5" {...s(color)} />
  </Svg>
);

/** A 2 px stage line that fills from the top, `delay` ms after it mounts. */
export function GrowLine({ color, delay }: { color: string; delay: number }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 900, delay, easing: motion.glide, useNativeDriver: true }).start();
  }, [v, delay, still]);
  return <Animated.View style={{ flex: 1, width: 2, backgroundColor: color, transformOrigin: 'top', transform: [{ scaleY: v }] }} />;
}

/** The 6 px dot inside the current stage's ring: it swells and fades every 1.6 s. */
export function NowDot({ color }: { color: string }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return v.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
      }}
    />
  );
}

/** Pops (0.95 → 1.03 → 1) each time `on` turns true. */
export function Pop({ on, children, style }: { on: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!on || still) return;
    v.setValue(0.95);
    Animated.timing(v, { toValue: 1, duration: 450, easing: motion.spring, useNativeDriver: true }).start();
  }, [on, v, still]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}
