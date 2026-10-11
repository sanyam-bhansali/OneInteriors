import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useT } from '../lib/i18n';
import { useReducedMotion } from '../lib/motion';
import { font } from '../lib/theme';

/**
 * The opening (Intro.dc.html, screen #0), first launch only: a second of
 * black, the bulb clip, then the logo settling out of a blur with a gold
 * sheen and "Tap anywhere to continue". Every later launch skips it
 * (`hasOpened`). With reduce motion on, the clip is skipped and the logo is
 * simply there.
 */

const KEY = 'oi.opened.v1';

export async function hasOpened(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY).catch(() => null)) === '1';
}

export function Opening({ onDone }: { onDone: () => void }) {
  const t = useT();
  const still = useReducedMotion();
  const [phase, setPhase] = useState<'dark' | 'clip' | 'logo'>(still ? 'logo' : 'dark');
  const player = useVideoPlayer(require('../../assets/app/opening.mp4'), (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    if (still) return;
    const toClip = setTimeout(() => {
      setPhase('clip');
      player.play();
    }, 1000);
    // The clip runs about four seconds; never wait on it longer than that.
    const toLogo = setTimeout(() => setPhase('logo'), 1000 + 4200);
    return () => {
      clearTimeout(toClip);
      clearTimeout(toLogo);
    };
  }, [player, still]);

  useEventListener(player, 'playToEnd', () => setPhase('logo'));

  const finish = () => {
    void AsyncStorage.setItem(KEY, '1').catch(() => {});
    onDone();
  };

  return (
    <View style={styles.root}>
      {phase === 'clip' ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} accessibilityLabel={t('open.video')} />
      ) : null}
      {phase === 'logo' ? <Logo still={still} /> : null}
      {phase === 'logo' ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={finish} role="button" aria-label={t('open.tap')}>
          <Hint still={still} label={t('open.tap')} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The logo comes in from 107% and blurred, then a warm gold sheen crosses it. */
function Logo({ still }: { still: boolean }) {
  const [inV] = useState(() => new Animated.Value(still ? 1 : 0));
  const [sheen] = useState(() => new Animated.Value(0));
  const [halo] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return;
    Animated.parallel([
      Animated.timing(inV, { toValue: 1, duration: 1600, delay: 150, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 1, duration: 2200, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1050),
        Animated.timing(sheen, { toValue: 1, duration: 850, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(sheen, { toValue: 0, duration: 850, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true }),
      ]),
    ]).start();
  }, [inV, sheen, halo, still]);

  const mark = require('../../assets/brand/logo-ink.png');
  return (
    <View style={styles.center} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', opacity: halo, transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
        <Svg width={620} height={390}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#F2C98A" stopOpacity={0.18} />
              <Stop offset="0.45" stopColor="#F2C98A" stopOpacity={0.05} />
              <Stop offset="0.7" stopColor="#F2C98A" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={310} cy={195} rx={310} ry={195} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View
        role="img"
        aria-label="One Interiors"
        style={{ width: 300, height: 157, opacity: inV, transform: [{ scale: inV.interpolate({ inputRange: [0, 1], outputRange: [1.07, 1] }) }] }}
      >
        <Image source={mark} style={StyleSheet.absoluteFill} contentFit="contain" tintColor="#F4F1E9" />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: sheen }]}>
          <Image source={mark} style={StyleSheet.absoluteFill} contentFit="contain" tintColor="#F6D9A6" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Hint({ still, label }: { still: boolean; label: string }) {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return;
    const run = Animated.sequence([
      Animated.delay(2400),
      Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.35, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ]);
    run.start();
    return () => run.stop();
  }, [v, still]);
  return <Animated.Text style={[styles.hint, { opacity: v }]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    textAlign: 'center',
    fontFamily: font.monoMedium,
    fontSize: 13,
    letterSpacing: 13 * 0.2,
    textTransform: 'uppercase',
    color: 'rgba(244,241,233,.72)',
  },
});
