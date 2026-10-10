import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '../lib/motion';
import { color, font, motion } from '../lib/theme';
import { Press } from './ui';

/**
 * The two drawn marks of the app (DESIGN-SPEC.md, Components): the Home
 * Coin, a gold disc with an inner ring, and GEIO's orb, a warm radial
 * gradient with a slow shine that breathes, faster while it thinks.
 */

/** A Home Coin, `size` px across. */
export function Coin({ size = 26 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`c${id}`} cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor="#FFF1C9" />
            <Stop offset="0.3" stopColor="#F2C98A" />
            <Stop offset="0.7" stopColor="#D9A23F" />
            <Stop offset="1" stopColor="#A8741E" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="49" fill={`url(#c${id})`} />
        <Circle cx="50" cy="50" r="48" fill="none" stroke="rgba(122,82,20,.45)" strokeWidth="3" />
        <Circle cx="50" cy="50" r="28" fill="none" stroke="rgba(122,82,20,.4)" strokeWidth="3" />
      </Svg>
    </View>
  );
}

/** The balance on Home's header: a coin and the count, on the photo. */
export function CoinChip({ balance, onPress }: { balance: number; onPress?: () => void }) {
  const shown = balance.toLocaleString('en-IN');
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`Home Coins, ${shown}`}
      style={{
        minHeight: 44,
        paddingLeft: 8,
        paddingRight: 14,
        borderRadius: 22,
        backgroundColor: 'rgba(11,11,11,.45)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Coin size={26} />
      <Text style={{ fontFamily: font.sansBold, fontSize: 15, color: color.gold }}>{shown}</Text>
    </Press>
  );
}

/**
 * "+N coins": slides up, holds, and fades. Mount it with a fresh `key` each
 * time coins are earned; `onDone` is called once it has gone.
 */
export function CoinToast({ amount, onDone }: { amount: number; onDone?: () => void }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(v, {
        toValue: 1,
        duration: still ? 0 : 450,
        easing: motion.spring,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(v, {
        toValue: 2,
        duration: still ? 0 : 400,
        easing: motion.glide,
        useNativeDriver: true,
      }),
    ]);
    seq.start(({ finished }) => finished && onDone?.());
    return () => seq.stop();
  }, [v, still, onDone]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${amount} coins earned`}
      pointerEvents="none"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        bottom: 110,
        zIndex: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingLeft: 10,
        paddingRight: 16,
        borderRadius: 999,
        backgroundColor: color.ink,
        opacity: v.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [0, 1, 0],
        }),
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [10, 0, -8],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [0.6, 1, 1],
            }),
          },
        ],
      }}
    >
      <Coin size={22} />
      <Text style={{ fontFamily: font.sansBold, fontSize: 15, color: color.gold }}>+{amount.toLocaleString('en-IN')} coins</Text>
    </Animated.View>
  );
}

/**
 * GEIO's orb. Breathes every 4.2 s, every 1.1 s while `busy` (thinking),
 * with a shine turning over it. `ring` draws the ink ring it wears when it
 * sits raised in the bottom bar.
 */
export function GeioOrb({
  size = 52,
  busy = false,
  ring = false,
  style,
}: {
  size?: number;
  busy?: boolean;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const still = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const [breath] = useState(() => new Animated.Value(0));
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) {
      breath.setValue(0);
      return;
    }
    const half = (busy ? 1100 : 4200) / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, busy, still]);

  useEffect(() => {
    if (still) return;
    turn.setValue(0);
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: busy ? 1400 : 5500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn, busy, still]);

  const r = size / 2;
  // The shine: a soft wedge from 28% to 54% of the way round, as the design's conic gradient.
  const at = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    return `${r + r * Math.cos(a)} ${r + r * Math.sin(a)}`;
  };
  const wedge = `M${r} ${r} L${at(0.28)} A${r} ${r} 0 0 1 ${at(0.54)} Z`;

  return (
    <Animated.View
      aria-hidden
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          shadowColor: color.gold,
          shadowOpacity: 0.75,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
          transform: [
            {
              scale: breath.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.07],
              }),
            },
          ],
        },
        ring && {
          borderWidth: 5,
          borderColor: color.ink,
          width: size + 10,
          height: size + 10,
          borderRadius: r + 5,
        },
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          overflow: 'hidden',
        }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`o${id}`} cx="34%" cy="28%" r="80%">
              <Stop offset="0" stopColor="#FFF6E6" />
              <Stop offset="0.26" stopColor="#F2C98A" />
              <Stop offset="0.56" stopColor="#E07A4E" />
              <Stop offset="0.8" stopColor="#BA5329" />
              <Stop offset="1" stopColor="#6E2A10" />
            </RadialGradient>
          </Defs>
          <Circle cx={r} cy={r} r={r} fill={`url(#o${id})`} />
        </Svg>
        {still ? null : (
          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              transform: [
                {
                  rotate: turn.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <Svg width={size} height={size}>
              <Path d={wedge} fill="#FFF8EC" fillOpacity={0.24} />
            </Svg>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
