import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hasOpened, Opening } from '../components/Opening';
import { Button, ErrorText, Screen, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { VERIFIED_STUDIOS } from '../lib/claims';
import { LANGS, useHeadline, useLang, useT, type Key, type Lang } from '../lib/i18n';
import { useReducedMotion } from '../lib/motion';
import { color, font, motion } from '../lib/theme';

/**
 * The front door. First launch plays the opening (screen #0); after that a
 * short logo, then straight to the project when signed in, or Welcome
 * (Start.dc.html, #1): the language switch, the logo, the verified-studios
 * pill, the promise, the two ways in, and a tilted table of style prints.
 */
export default function Index() {
  const { state, retry } = useAuth();
  const t = useT();
  const [opened, setOpened] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void hasOpened().then((v) => live && setOpened(v));
    return () => {
      live = false;
    };
  }, []);

  if (opened === null) return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  if (!opened) return <Opening onDone={() => setOpened(true)} />;
  if (state.status === 'loading') return <ShortLogo />;
  if (state.status === 'signed-in') return <Redirect href="/home" />;
  if (state.status === 'offline') {
    return (
      <Screen footer={<Button label={t('welcomeApp.retry')} onPress={() => void retry()} />}>
        <Title>{t('welcomeApp.offline.h1')}</Title>
        <ErrorText>{state.error}</ErrorText>
      </Screen>
    );
  }
  return <Welcome />;
}

/** A returning customer's brief logo while the session is checked. */
function ShortLogo() {
  return (
    <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('../../assets/brand/logo-ink.png')} style={{ width: 200, height: 105 }} contentFit="contain" tintColor={color.ink} />
    </View>
  );
}

function Welcome() {
  const t = useT();
  const h1 = useHeadline(40);
  const tall = useLang().lang !== 'en';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 10, paddingHorizontal: 16 }}>
        <LangSwitch />
      </View>
      <View style={{ paddingHorizontal: 22, paddingTop: 14, alignItems: 'center' }}>
        <LogoIn />
        <Rise delay={120}>
          <View style={styles.kicker}>
            <View style={styles.dot} />
            <Text style={styles.kickerText}>{t('welcome.kicker', { n: VERIFIED_STUDIOS })}</Text>
          </View>
        </Rise>
        <Rise delay={200}>
          <Text role="heading" style={[styles.h1, { fontSize: h1, lineHeight: tall ? h1 * 1.3 : h1, letterSpacing: tall ? 0 : h1 * -0.04 }]}>
            {t('welcome.h1')}
          </Text>
        </Rise>
        <Rise delay={320}>
          <Text style={styles.sub}>{t('welcome.sub')}</Text>
        </Rise>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 24 }}>
          <Button label={t('welcome.cta')} onPress={() => router.push({ pathname: '/web', params: { path: '/app/name', title: t('welcome.cta') } })} />
          <Button label={t('welcome.have')} variant="ghost" arrow={false} onPress={() => router.push('/sign-in')} />
        </View>
      </View>
      <Collage />
    </SafeAreaView>
  );
}

/** EN · हिं · मरा, a radio group in a soft pill; the choice sticks for the whole app. */
function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <View role="radiogroup" aria-label={t('lang.label')} style={styles.langs}>
      {(LANGS.map((l) => l.id) as Lang[]).map((id) => {
        const on = id === lang;
        return (
          <Pressable
            key={id}
            role="radio"
            aria-checked={on}
            aria-label={LANGS.find((l) => l.id === id)!.label}
            onPress={() => setLang(id)}
            style={[styles.lang, on && { backgroundColor: color.ink }]}
          >
            <Text style={[styles.langText, on && { color: color.white }]}>{t(`welcomeApp.langShort.${id}` as Key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The logo settles into place: fades in, grows from 86% and drops 10 pt. */
function LogoIn() {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 900, delay: 100, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
  }, [v, still]);
  return (
    <Animated.View
      role="img"
      aria-label="One Interiors"
      style={{
        width: 240,
        height: 125,
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
      }}
    >
      <Image source={require('../../assets/brand/logo-ink.png')} style={StyleSheet.absoluteFill} contentFit="contain" tintColor={color.ink} />
    </Animated.View>
  );
}

function Rise({ children, delay }: { children: ReactNode; delay: number }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.rise, delay, easing: motion.glide, useNativeDriver: true }).start();
  }, [v, delay, still]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>{children}</Animated.View>
  );
}

/*
 * The website's tilted table of prints: a 3-column grid of style photos,
 * the middle one twice as tall, laid back 22° and turned 6°. Free Unsplash
 * photographs, the same ones the website's style picker uses
 * (src/data/style-photos.ts); style names stay in English everywhere.
 */
const U = (id: string) => `https://images.unsplash.com/${id}?w=480&q=70&auto=format&fit=crop`;
const PRINTS = {
  scandinavian: { src: U('photo-1776673687936-65e63a5a3e05'), label: 'Scandinavian' },
  warm: { src: U('photo-1720247520862-7e4b14176fa8'), label: 'Warm modern' },
  indian: { src: U('photo-1713192706971-03900dcf5706'), label: 'Indian contemporary' },
  minimal: { src: U('photo-1724582586529-62622e50c0b3') },
  industrial: { src: U('photo-1650091009622-4cbe6def4d2e') },
  extra: { src: U('photo-1541085929911-dea736e9287b') },
};

function Collage() {
  const still = useReducedMotion();
  const { width } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 1100, delay: 350, easing: motion.glide, useNativeDriver: true }).start();
  }, [v, still]);
  const W = 560;
  const col = (W - 20) / 3;
  return (
    <View aria-hidden style={{ flex: 1, minHeight: 150, marginTop: 22, overflow: 'hidden' }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 6,
          left: (width - W) / 2,
          width: W,
          flexDirection: 'row',
          gap: 10,
          opacity: v,
          transform: [
            { perspective: 1200 },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { rotateX: '22deg' },
          ],
          transformOrigin: 'top',
        }}
      >
        <View style={{ width: col, gap: 10 }}>
          <Print {...PRINTS.scandinavian} h={120} />
          <Print {...PRINTS.minimal} h={120} />
          <Print {...PRINTS.extra} h={120} />
        </View>
        <View style={{ width: col, gap: 10 }}>
          <Print {...PRINTS.warm} h={250} />
        </View>
        <View style={{ width: col, gap: 10 }}>
          <Print {...PRINTS.indian} h={120} />
          <Print {...PRINTS.industrial} h={120} />
        </View>
      </Animated.View>
    </View>
  );
}

function Print({ src, label, h }: { src: string; label?: string; h: number }) {
  return (
    <View style={[styles.print, { height: h }]}>
      <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      {label ? (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  langs: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 999, backgroundColor: color.soft },
  lang: { minWidth: 44, minHeight: 36, paddingHorizontal: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  langText: { fontFamily: font.sansMedium, fontSize: 14, color: color.ink2 },
  kicker: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: color.soft,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent, boxShadow: '0 0 0 4px rgba(193,88,46,.18)' },
  kickerText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink2 },
  h1: { marginTop: 20, textAlign: 'center', fontFamily: font.sansMedium, color: color.ink },
  sub: { marginTop: 16, textAlign: 'center', fontFamily: font.sans, fontSize: 16, lineHeight: 24, color: color.ink2, maxWidth: 320 },
  print: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: color.soft,
    transform: [{ rotate: '-6deg' }],
  },
  caption: { position: 'absolute', left: 10, bottom: 10, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.86)' },
  captionText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink },
});
