import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, Rect, RadialGradient, Stop } from 'react-native-svg';
import { useT } from '../../lib/i18n';
import { useReducedMotion } from '../../lib/motion';
import { color, font, motion, radius } from '../../lib/theme';
import type { GeioReply } from '../../lib/types';
import { ArrowIcon } from '../icons';
import { Eyebrow, Press, Rise } from '../ui';

/**
 * GEIO's parts (designs #30, #31, #33): the warm aura behind the screen,
 * the shimmering "Reading…" line, an answer that arrives word by word, the
 * cards under it, and the composer. Every animation lands at once with
 * "reduce motion" on.
 */

/** The design's terracotta for GEIO's send button. */
export const SEND = '#BA5329';

/** The warm, slowly drifting glow at the top of the GEIO screens. `quiet` once a conversation starts. */
export function Aura({ quiet }: { quiet: boolean }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return v.setValue(0.5);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 11000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[
        styles.aura,
        {
          opacity: quiet ? 0.55 : 1,
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
          ],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 600 470" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="ga1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#E07A4E" stopOpacity={0.36} />
            <Stop offset="1" stopColor="#E07A4E" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ga2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F2C98A" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#F2C98A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ga3" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#BA5329" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#BA5329" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="200" cy="240" rx="220" ry="200" fill="url(#ga1)" />
        <Ellipse cx="420" cy="200" rx="200" ry="190" fill="url(#ga2)" />
        <Ellipse cx="312" cy="330" rx="160" ry="130" fill="url(#ga3)" />
      </Svg>
    </Animated.View>
  );
}

/** "Reading your project…", its colour sweeping grey to terracotta and back while GEIO thinks. */
export function Thinking({ label }: { label: string }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return v.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Animated.Text
      style={[styles.think, { color: v.interpolate({ inputRange: [0, 1], outputRange: [color.ink2, color.accentWarm] }) }]}
    >
      {label}
    </Animated.Text>
  );
}

/** The terracotta block cursor that blinks while words arrive. */
function Caret() {
  const still = useReducedMotion();
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setOn((x) => !x), 450);
    return () => clearInterval(id);
  }, [still]);
  return <View aria-hidden style={[styles.caret, { opacity: on ? 1 : 0 }]} />;
}

const WORD_MS = 40;

/**
 * An answer's paragraphs, arriving a word at a time (`stream`), then
 * `after` (its cards) rising in under them. With "reduce motion" on, or for
 * an older answer, everything is there at once.
 */
export function Streamed({
  paragraphs,
  stream,
  onGrow,
  onDone,
  after,
}: {
  paragraphs: string[];
  stream: boolean;
  onGrow?: () => void;
  onDone?: () => void;
  after?: ReactNode;
}) {
  const still = useReducedMotion();
  const words = useMemo(() => paragraphs.map((p) => p.split(/\s+/).filter(Boolean)), [paragraphs]);
  const total = words.reduce((n, w) => n + w.length, 0);
  const instant = !stream || still;
  const [count, setN] = useState(0);
  const n = instant ? total : count;

  useEffect(() => {
    if (instant) return;
    const id = setInterval(() => setN((k) => (k >= total ? k : k + 1)), WORD_MS);
    return () => clearInterval(id);
  }, [instant, total]);

  const done = n >= total;
  useEffect(() => {
    onGrow?.();
    // Only the count matters; the callbacks are fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const starts = words.map((_, i) => words.slice(0, i).reduce((k, w) => k + w.length, 0));
  return (
    <>
      {words.map((w, i) => {
        const shown = w.slice(0, Math.max(0, n - starts[i]!));
        if (!shown.length) return null;
        return (
          <Text key={i} style={styles.para}>
            {shown.join(' ')}
          </Text>
        );
      })}
      {done ? after : <Caret />}
    </>
  );
}

/** What GEIO saw in a photo, and the quote lines it read: soft cards under the answer. */
export function ReplyCards({ reply }: { reply: GeioReply }) {
  const t = useT();
  return (
    <>
      {reply.see.length ? (
        <Rise style={styles.soft}>
          <Eyebrow>{t('geioApp.see')}</Eyebrow>
          {reply.see.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: s.watch ? color.accent : color.ok }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>{s.what}</Text>
                <Text style={styles.rowSub}>
                  {s.verdict}
                  {s.watch ? ` · ${t('geioApp.watch')}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </Rise>
      ) : null}
      {reply.sources.length ? (
        <Rise style={styles.soft} delay={80}>
          <Eyebrow>{t('geioApp.sources')}</Eyebrow>
          {reply.sources.map((s, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={styles.rowTitle}>
                {t('geioApp.source.line', { line: s.line })} · {s.item}
                {s.amount ? ` · ${s.amount}` : ''}
              </Text>
              {s.spec ? <Text style={styles.rowSub}>{s.spec}</Text> : null}
            </View>
          ))}
        </Rise>
      ) : null}
    </>
  );
}

/** The dark "Your next step" card: the most pressing open decision on their project. */
export function NextStep({ id, title, date }: { id: string; title: string; date: string }) {
  const t = useT();
  return (
    <Rise delay={120} style={styles.next}>
      <Text style={styles.nextEyebrow}>{t('geioApp.next.by', { date })}</Text>
      <Text style={styles.nextTitle}>{title}</Text>
      <Press
        onPress={() => router.push({ pathname: '/decision/[id]', params: { id } })}
        accessibilityLabel={`${t('geioApp.next.open')}: ${title}`}
        style={styles.nextBtn}
      >
        <Text style={styles.nextBtnText}>{t('geioApp.next.open')}</Text>
        <ArrowIcon color={color.ink} size={14} />
      </Press>
    </Rise>
  );
}

/** A soft ring that swells and fades around the expert's initial (design #33). */
function Ring() {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  if (still) return null;
  return (
    <Animated.View
      aria-hidden
      style={[
        StyleSheet.absoluteFill,
        styles.ring,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
        },
      ]}
    />
  );
}

/** GEIO handing the question to the expert, with what it passed on (design #33). */
export function Handover({ expert, context }: { expert: string; context: string }) {
  const t = useT();
  return (
    <Rise style={[styles.soft, { padding: 16, gap: 14 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48 }}>
          <Ring />
          <View aria-hidden style={styles.avatar}>
            <Text style={{ fontFamily: font.sansSemi, fontSize: 19, color: color.white }}>{expert.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.sansSemi, fontSize: 16, color: color.ink }}>{t('geioApp.handover.title', { expert })}</Text>
          <Text style={{ fontFamily: font.sansMedium, fontSize: 13, lineHeight: 18, color: color.ok }}>{t('geioApp.handover.payroll')}</Text>
        </View>
      </View>
      <View style={styles.passed}>
        <Eyebrow>{t('geioApp.handover.passed', { expert })}</Eyebrow>
        <Text style={{ fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.ink }}>{context}</Text>
      </View>
    </Rise>
  );
}

/** Their question: an ink bubble on the right. */
export function Mine({ text }: { text: string }) {
  return (
    <Rise style={styles.mineWrap}>
      <View style={styles.mine}>
        <Text style={styles.mineText}>{text}</Text>
      </View>
    </Rise>
  );
}

/** The headset on the expert pill. */
export function Headset({ c = color.onDark, size = 16 }: { c?: string; size?: number }) {
  const s = { fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M4 14v-2a8 8 0 0 1 16 0v2" {...s} />
      <Rect x="2.5" y="13" width="4" height="6" rx="1.5" {...s} />
      <Rect x="17.5" y="13" width="4" height="6" rx="1.5" {...s} />
      <Path d="M19.5 19c0 1.5-2 2.5-5 2.5" {...s} />
    </Svg>
  );
}

function UpArrow() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <Path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke={color.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The pinned bottom of the screen: follow-up chips, the message box with
 * its send disc, and the disclaimer, on a fade to warm grey. Text only in
 * v1: no camera, no microphone.
 */
export function Composer({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  chips,
  onChip,
}: {
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
  chips: string[];
  onChip: (q: string) => void;
}) {
  const t = useT();
  const can = value.trim().length > 0 && !busy;
  return (
    <View style={styles.dock}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', '#F1F0EC']}
        locations={[0, 0.22]}
        style={StyleSheet.absoluteFill}
      />
      {chips.length ? (
        <View role="group" aria-label={t('geioApp.follow')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 10 }}
          >
            {chips.map((c, i) => (
              <Rise key={c} delay={i * motion.stagger}>
                <Press onPress={() => onChip(c)} accessibilityLabel={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </Press>
              </Rise>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.box}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.ink3}
          accessibilityLabel={t('geioApp.input')}
          maxLength={600}
          multiline
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={() => can && onSend()}
          style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
        <Press
          onPress={onSend}
          disabled={!can}
          accessibilityLabel={t('geioApp.send')}
          style={[styles.send, !can && { opacity: 0.45 }]}
        >
          <UpArrow />
        </Press>
      </View>
      <Text style={styles.disclaimer}>{t('geioApp.disclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aura: { position: 'absolute', left: '-35%', right: '-35%', top: -150, height: 470 },
  think: { fontFamily: font.sansMedium, fontSize: 15, paddingTop: 5 },
  caret: { width: 8, height: 17, borderRadius: 2, backgroundColor: color.accentWarm },
  para: { fontFamily: font.sans, fontSize: 16, lineHeight: 25.6, color: color.ink },
  soft: { backgroundColor: color.soft, borderRadius: radius.lg, padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowTitle: { fontFamily: font.sansMedium, fontSize: 14.5, lineHeight: 20, color: color.ink },
  rowSub: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  next: {
    backgroundColor: color.ink,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: color.ink,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  nextEyebrow: { fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: color.accentWarm },
  nextTitle: { fontFamily: font.sansSemi, fontSize: 17, lineHeight: 21, letterSpacing: -0.34, color: color.onDark },
  nextBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: color.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextBtnText: { fontFamily: font.sansMedium, fontSize: 14, color: color.ink },
  ring: { borderRadius: 24, borderWidth: 2, borderColor: color.accentWarm },
  avatar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, backgroundColor: color.ok, alignItems: 'center', justifyContent: 'center' },
  passed: { backgroundColor: color.paper, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  mineWrap: { alignSelf: 'flex-end', maxWidth: '82%' },
  mine: { backgroundColor: color.ink, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6, paddingVertical: 12, paddingHorizontal: 16 },
  mineText: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 22.5, color: color.onDark },
  // 26 below the disclaimer, as the design: the raised GEIO orb in the tab bar sits over the bottom edge.
  dock: { paddingTop: 10, paddingBottom: 26 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.paper,
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.sansMedium, fontSize: 14, color: color.ink },
  box: {
    marginHorizontal: 16,
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: color.paper,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingVertical: 7,
    paddingLeft: 18,
    paddingRight: 7,
    shadowColor: color.ink,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: font.sans,
    fontSize: 16,
    color: color.ink,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: SEND, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { marginTop: 8, marginHorizontal: 24, textAlign: 'center', fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.ink2 },
});
