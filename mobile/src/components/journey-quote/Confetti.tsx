import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../lib/motion';
import { color, motion } from '../../lib/theme';

/** A plain tick, `size` px, for consent boxes and the booked badge. */
export function Tick({ size = 16, tint = color.white, width = 2.5 }: { size?: number; tint?: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M20 6 9 17l-5-5" fill="none" stroke={tint} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Where each piece lands and its colour, from designs/Expert.dc.html (`.oi-c`). */
const BURST: [number, number, string, number][] = [
  [70, 0, '#BA5329', 120],
  [81, 34, '#E07A4E', 140],
  [75, 75, '#F2C98A', 150],
  [27, 65, '#FFFFFF', 160],
  [0, 88, '#BA5329', 180],
  [-41, 98, '#E07A4E', 200],
  [-49, 49, '#F2C98A', 210],
  [-81, 34, '#FFFFFF', 220],
  [-106, 0, '#BA5329', 240],
  [-65, -27, '#E07A4E', 260],
  [-62, -62, '#F2C98A', 270],
  [-41, -98, '#FFFFFF', 280],
  [0, -70, '#BA5329', 300],
  [34, -81, '#E07A4E', 320],
  [75, -75, '#F2C98A', 330],
  [65, -27, '#FFFFFF', 340],
];

/**
 * The expert booking's burst (Expert.dc.html): a ring that spreads and
 * fades, sixteen pieces thrown out and spinning, and the terracotta tick
 * popping in. With "reduce motion" on, only the tick, already in place.
 */
export function Confetti() {
  const still = useReducedMotion();
  const [ring] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(still ? 1 : 0));
  const [bits] = useState(() => BURST.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (still) {
      pop.setValue(1);
      return;
    }
    const all = Animated.parallel([
      Animated.timing(ring, { toValue: 1, duration: 1100, delay: 100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 600, easing: motion.spring, useNativeDriver: true }),
      ...bits.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: 1200, delay: BURST[i]![3], easing: Easing.bezier(0.15, 0.8, 0.3, 1), useNativeDriver: true }),
      ),
    ]);
    all.start();
    return () => all.stop();
  }, [still, ring, pop, bits]);

  return (
    <View style={styles.wrap} aria-hidden>
      {still ? null : (
        <>
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 3.2] }) }],
              },
            ]}
          />
          {bits.map((v, i) => {
            const [dx, dy, tint] = BURST[i]!;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.bit,
                  {
                    backgroundColor: tint,
                    opacity: v.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
                    ],
                  },
                ]}
              />
            );
          })}
        </>
      )}
      <Animated.View
        style={[
          styles.check,
          { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
        ]}
      >
        <Tick size={26} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 56, height: 56 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, borderWidth: 2, borderColor: color.accentWarm },
  bit: { position: 'absolute', left: 25, top: 25, width: 7, height: 7, borderRadius: 2 },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#BA5329', alignItems: 'center', justifyContent: 'center' },
});
