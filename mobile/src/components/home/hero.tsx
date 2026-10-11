import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../../lib/motion';
import { color, font, motion } from '../../lib/theme';
import { Press } from '../ui';
import { ArrowMark, HouseMark } from './marks';

/**
 * Parts of Home's photo hero and cards (Main.dc.html, screen 21): the slow
 * Ken Burns photo, the "Updated from site" chip that drops in and goes, the
 * stage track with its pulsing "now" dot, and the white pill of a dark card.
 * With "reduce motion" on, each lands at once.
 */

/** The hero photo, drifting between 112% and 100% over 18 s. */
export function KenBurns({ source, label }: { source: ImageSource | number; label?: string }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 18_000, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 18_000, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }] }]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} accessibilityLabel={label} accessible={!!label} />
    </Animated.View>
  );
}

/**
 * "Updated from site just now": drops in, holds, lifts away (3.8 s, after
 * 0.4 s), while its house lights up gold. Remount with a new `key` to replay.
 */
export function RefreshChip({ text, top }: { text: string; top: number }) {
  const still = useReducedMotion();
  const [p] = useState(() => new Animated.Value(still ? 0.5 : 0));
  const [bulb] = useState(() => new Animated.Value(still ? 1 : 0));
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (still) {
      p.setValue(0.5);
      bulb.setValue(1);
      const id = setTimeout(() => setGone(true), 3800);
      return () => clearTimeout(id);
    }
    const run = Animated.parallel([
      Animated.timing(p, { toValue: 1, duration: 3800, delay: 400, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(bulb, { toValue: 1, duration: 1400, delay: 800, easing: Easing.ease, useNativeDriver: true }),
    ]);
    run.start(({ finished }) => finished && setGone(true));
    return () => run.stop();
  }, [p, bulb, still]);
  if (gone) return null;
  const at = [0, 0.14, 0.82, 1];
  return (
    <View pointerEvents="none" style={[styles.chipWrap, { top }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.chip,
          {
            opacity: p.interpolate({ inputRange: at, outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: p.interpolate({ inputRange: at, outputRange: [-26, 0, 0, -12] }) }],
          },
        ]}
      >
        <View style={{ width: 16, height: 16 }}>
          <HouseMark color={color.onDark} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: bulb.interpolate({ inputRange: [0, 0.3, 0.55, 1], outputRange: [0, 0, 1, 1] }) }]}>
            <HouseMark color={color.gold} fill={color.gold} />
          </Animated.View>
        </View>
        <Text style={styles.chipText}>{text}</Text>
      </Animated.View>
    </View>
  );
}

/** The terracotta dot inside the stage that is happening now, pulsing every 1.6 s. */
function NowDot() {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return v.setValue(0);
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Animated.View
      style={[
        styles.nowDot,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] },
      ]}
    />
  );
}

export type TrackStage = { key: string; name: string; state: 'done' | 'now' | 'next' | 'later' };

/**
 * Design · Civil · Carpentry · Finish · Handover as dots on a line: done
 * stages filled terracotta, the current one ringed with a pulsing dot, the
 * rest ringed white. The filled line grows in from the left.
 */
export function StageTrack({ stages, onPress, label }: { stages: TrackStage[]; onPress: () => void; label: string }) {
  const still = useReducedMotion();
  const [grow] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return grow.setValue(1);
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 300, easing: motion.glide, useNativeDriver: true }).start();
  }, [grow, still]);
  const now = stages.findIndex((s) => s.state === 'now');
  const lastDone = stages.reduce((at, s, i) => (s.state === 'done' ? i : at), -1);
  const reached = now >= 0 ? now : lastDone;
  const share = stages.length > 1 && reached > 0 ? reached / (stages.length - 1) : 0;
  return (
    <Press onPress={onPress} haptic={false} accessibilityRole="link" accessibilityLabel={label} style={{ gap: 8 }}>
      <View style={{ height: 18 }}>
        <View style={styles.line}>
          <Animated.View style={{ width: `${share * 100}%`, height: 2, backgroundColor: color.accentWarm, transform: [{ scaleX: grow }], transformOrigin: 'left' }} />
        </View>
        <View style={styles.dots}>
          {stages.map((s) => (
            <View key={s.key} style={[styles.dot, s.state === 'done' ? styles.dotDone : s.state === 'now' ? styles.dotNow : styles.dotLater]}>
              {s.state === 'now' ? <NowDot /> : null}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.names}>
        {stages.map((s) => (
          <Text key={s.key} numberOfLines={1} style={[styles.name, s.state === 'now' && { color: color.white }]}>
            {s.name}
          </Text>
        ))}
      </View>
    </Press>
  );
}

/** The white pill on a dark card, ending in a black disc with a white arrow; terracotta rises on a press. */
export function LightPill({ label, onPress }: { label: string; onPress: () => void }) {
  const still = useReducedMotion();
  const [fill] = useState(() => new Animated.Value(0));
  const [h, setH] = useState(46);
  const [down, setDown] = useState(false);
  const press = (on: boolean) => {
    setDown(on);
    if (still) return fill.setValue(on ? 1 : 0);
    Animated.timing(fill, { toValue: on ? 1 : 0, duration: on ? 260 : 380, easing: motion.glide, useNativeDriver: true }).start();
  };
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Press onPress={onPress} onPressChange={press} accessibilityLabel={label} style={styles.pill}>
        <View style={StyleSheet.absoluteFill} onLayout={(e) => setH(e.nativeEvent.layout.height)} pointerEvents="none">
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: color.accent, transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [h, 0] }) }] }]}
          />
        </View>
        <Text style={[styles.pillText, down && { color: color.white }]}>{label}</Text>
        <View style={styles.disc}>
          <ArrowMark color={color.white} />
        </View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { position: 'absolute', left: 0, right: 0, zIndex: 3, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(11,11,11,.72)',
  },
  chipText: { fontFamily: font.mono, fontSize: 13, color: color.onDark },
  line: { position: 'absolute', left: 9, right: 9, top: 8, height: 2, backgroundColor: 'rgba(255,255,255,.25)' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: color.accentWarm },
  dotNow: { backgroundColor: color.ink, borderWidth: 2, borderColor: color.accentWarm },
  dotLater: { backgroundColor: color.ink, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.4)' },
  nowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.accentWarm },
  names: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  name: { fontFamily: font.sansMedium, fontSize: 13, color: 'rgba(255,255,255,.7)', flexShrink: 1 },
  pill: {
    minHeight: 46,
    paddingLeft: 22,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: color.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  pillText: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  disc: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
});
