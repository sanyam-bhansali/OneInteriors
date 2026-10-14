import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLang } from '../lib/i18n';
import { useReducedMotion } from '../lib/motion';
import { color, font, motion, radius, space, type, type Tint } from '../lib/theme';
import { ArrowIcon, BackIcon } from './icons';

/**
 * The app's parts, to the 10 Oct restyle (docs/app-handover/DESIGN-SPEC.md):
 * a white canvas, one sans face set large and tight, black pill buttons
 * ending in an arrow disc, soft rounded cards, ink for whatever is chosen.
 * Headlines rise in, lists arrive 60 ms apart, a press springs to 96.5%.
 * With "reduce motion" on, all of it lands at once.
 */

/** Rises 18 px and fades in, `delay` ms after it mounts. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReducedMotion();
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.rise, delay, easing: motion.glide, useNativeDriver: true }).start();
  }, [v, delay, still]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** The nth item of a list: rises `motion.stagger` ms after the one before. */
export function Stagger({ i, children, start = 0, style }: { i: number; children: ReactNode; start?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Rise delay={start + i * motion.stagger} style={style}>
      {children}
    </Rise>
  );
}

type A11y = {
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'checkbox' | 'tab' | 'switch' | 'link';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
};

/** A pressable that springs to 96.5% and back, with a light haptic. */
export function Press({
  children,
  onPress,
  disabled,
  style,
  haptic = true,
  onPressChange,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  /** Told when a finger goes down and comes up, for a press fill. */
  onPressChange?: (down: boolean) => void;
} & A11y) {
  const still = useReducedMotion();
  const [s] = useState(() => new Animated.Value(1));
  const to = (value: number) => {
    if (!still) Animated.spring(s, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  };
  return (
    <Pressable
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-disabled={!!disabled}
      aria-selected={accessibilityState?.selected}
      aria-checked={accessibilityState?.checked}
      disabled={disabled}
      onPressIn={() => {
        to(motion.press);
        onPressChange?.(true);
      }}
      onPressOut={() => {
        to(1);
        onPressChange?.(false);
      }}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A screen: safe area, scrolling body with pull to refresh, and a pinned footer. */
export function Screen({
  children,
  footer,
  onRefresh,
  refreshing = false,
  dark = false,
  header,
  back = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  dark?: boolean;
  header?: ReactNode;
  /** A back arrow above the screen, for screens opened from a tab rather than in the tab bar. */
  back?: boolean;
}) {
  const bg = dark ? color.ink : color.paper;
  const t = useLang().t;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
      {back ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={styles.back} accessibilityLabel={t('kit.back')}>
            <BackIcon color={dark ? color.white : color.ink} />
          </Press>
        </View>
      ) : null}
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { backgroundColor: bg }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Secondary text at the 13 px floor. */
export function Meta({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.meta, style]}>{children}</Text>;
}

/** The line above a heading, and row labels in tables: 13 px, uppercase, tracked out. */
export function Eyebrow({ children, style, onDark }: { children: ReactNode; style?: StyleProp<TextStyle>; onDark?: boolean }) {
  return <Text style={[type.eyebrow, onDark && { color: color.accentWarm }, style]}>{children}</Text>;
}

/** The headline: 40 px, weight 500, set tight. Hindi and Marathi pass 34. */
export function Title({ children, style, size = 40 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  // Devanagari's marks above the line need room a tight Latin headline does not.
  const tall = useLang().lang !== 'en';
  return (
    <Rise>
      <Text role="heading" style={[type.headline, { fontSize: size, lineHeight: tall ? size * 1.3 : size, letterSpacing: tall ? 0 : size * -0.045 }, style]}>
        {children}
      </Text>
    </Rise>
  );
}

/** A section heading: 21 px, weight 500. */
export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text role="heading" style={[type.section, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.body, muted && { color: color.ink2 }, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={[type.body, { color: color.accentInk }]}>{children}</Text>;
}

/**
 * The pill. `primary` is black and ends in a white disc holding a black
 * arrow; on a press a terracotta fill rises from the bottom. `light` is the
 * same pill inverted, for dark cards. `ghost` is a ring, `quiet` just words.
 * A disabled pill goes soft and says why (`reason`).
 */
export function Button({
  label,
  onPress,
  busy,
  disabled,
  reason,
  variant = 'primary',
  arrow,
}: {
  label: string;
  onPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Shown under a disabled pill: "Rank 2 more to continue". */
  reason?: string;
  variant?: 'primary' | 'light' | 'ghost' | 'quiet' | 'dark';
  /** The arrow disc; on by default for primary and light. */
  arrow?: boolean;
}) {
  const still = useReducedMotion();
  const [fill] = useState(() => new Animated.Value(0));
  const [h, setH] = useState(56);
  const off = disabled || busy;
  const solid = variant === 'primary' || variant === 'dark' || variant === 'light';
  const light = variant === 'light';
  const bg = disabled ? color.soft2 : solid ? (light ? color.white : color.ink) : 'transparent';
  const fg = disabled ? color.ink3 : solid ? (light ? color.ink : color.white) : color.ink;
  const withArrow = (arrow ?? solid) && !disabled;
  const press = (down: boolean) => {
    if (!solid || off) return;
    if (still) return fill.setValue(down ? 1 : 0);
    Animated.timing(fill, { toValue: down ? 1 : 0, duration: down ? 260 : 380, easing: motion.glide, useNativeDriver: true }).start();
  };
  return (
    <View style={{ gap: 8 }}>
      <Press
        onPress={onPress}
        disabled={off}
        onPressChange={press}
        accessibilityLabel={disabled && reason ? `${label}. ${reason}` : label}
        style={[
          styles.button,
          { backgroundColor: bg },
          variant === 'ghost' && { borderWidth: 1, borderColor: color.ring },
          variant === 'quiet' && { minHeight: 44 },
          withArrow && { paddingLeft: 26, paddingRight: 14, justifyContent: 'space-between' },
        ]}
      >
        <View style={StyleSheet.absoluteFill} onLayout={(e) => setH(e.nativeEvent.layout.height)} pointerEvents="none">
          {solid && !disabled ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: color.accent, transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [h, 0] }) }] },
              ]}
            />
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator color={fg} style={{ flex: withArrow ? 1 : undefined }} />
        ) : (
          <Text style={[styles.buttonText, { color: fg }, variant === 'quiet' && { fontSize: 15 }]}>{label}</Text>
        )}
        {withArrow ? (
          <View style={[styles.disc, { backgroundColor: light ? color.ink : color.white }]}>
            <ArrowIcon color={light ? color.white : color.ink} size={16} />
          </View>
        ) : null}
      </Press>
      {disabled && reason ? <Meta style={{ textAlign: 'center' }}>{reason}</Meta> : null}
    </View>
  );
}

export function Field({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput placeholderTextColor={color.ink3} accessibilityLabel={label} style={styles.input} {...rest} />
      {hint ? <Text style={[type.body, { fontSize: 14, color: color.ink2 }]}>{hint}</Text> : null}
    </View>
  );
}

/** Quiz chips, filters, time slots: white with a line ring; chosen, it fills with ink. */
export function OptionPill({
  label,
  on,
  onPress,
  role = 'radio',
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  /** `radio` in a pick-one group, `checkbox` in a pick-many one. */
  role?: 'radio' | 'checkbox' | 'button';
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'button' ? { selected: !!on } : { checked: !!on }}
      style={[styles.pill, on && { backgroundColor: color.ink, borderColor: color.ink }]}
    >
      <Text style={[styles.pillText, on && { color: color.onDark }]}>{label}</Text>
    </Press>
  );
}

/** The older name for an option pill. */
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return <OptionPill label={label} on={on} onPress={onPress} role="button" />;
}

/**
 * A 104 px soft circle with a line icon over a 13.5 px label (Q6
 * priorities, home types). Tapping one moves it into a `RankedRow`.
 */
export function CircleOption({ label, icon, onPress }: { label: string; icon?: ReactNode; onPress?: () => void }) {
  const t = useLang().t;
  return (
    <Press onPress={onPress} accessibilityLabel={t('kit.rank', { label })} style={styles.circle}>
      {icon}
      <Text style={styles.circleText}>{label}</Text>
    </Press>
  );
}

/** A ranked choice: a black row with its terracotta number, and "Remove". */
export function RankedRow({ n, label, icon, onRemove }: { n: number; label: string; icon?: ReactNode; onRemove?: () => void }) {
  const still = useReducedMotion();
  const t = useLang().t;
  const [v] = useState(() => new Animated.Value(still ? 1 : 0.6));
  useEffect(() => {
    if (!still) Animated.timing(v, { toValue: 1, duration: 450, easing: motion.spring, useNativeDriver: true }).start();
  }, [v, still]);
  return (
    <Animated.View style={{ transform: [{ scale: v }], opacity: v.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1] }) }}>
      <Press onPress={onRemove} accessibilityLabel={`${n}. ${label}. ${t('kit.remove')}`} style={styles.ranked}>
        <View style={styles.rankNum}>
          <Text style={{ fontFamily: font.sansSemi, fontSize: 15, color: color.white }}>{n}</Text>
        </View>
        {icon}
        <Text style={{ flex: 1, fontFamily: font.sansMedium, fontSize: 16, color: color.white }}>{label}</Text>
        <Text style={[type.eyebrow, { color: 'rgba(255,255,255,.6)' }]}>{t('kit.remove')}</Text>
      </Press>
    </Animated.View>
  );
}

/** A soft-2 track; the chosen segment is an ink pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; sub?: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <View role="tablist" aria-label={label} style={styles.segTrack}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            role="tab"
            aria-selected={on}
            aria-label={o.sub ? `${o.label}, ${o.sub}` : o.label}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.id);
            }}
            style={[styles.seg, on && { backgroundColor: color.ink }]}
          >
            <Text style={[styles.segText, on && { color: color.onDark }]}>{o.label}</Text>
            {o.sub ? <Text style={[styles.segSub, on && { color: color.onDark }]}>{o.sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A soft card: radius 24, no border. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The dark card: ink, radius 20, an accent eyebrow (`Eyebrow onDark`), then the words. */
export function DarkCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.dark, style]}>{children}</View>;
}

/** The ink panel at the top of Compare and Expert, its bottom corners rounded 32. */
export function DarkPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** A tinted stat tile: the label at the top, a big figure at the bottom. */
export function Tile({
  tint,
  label,
  value,
  sub,
  valueColor,
  style,
}: {
  tint: Tint;
  label: string;
  value: ReactNode;
  /** Small words after the figure: "of 18.4". */
  sub?: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessible accessibilityLabel={`${label}: ${typeof value === 'string' ? value : ''}${sub ? ` ${sub}` : ''}`} style={[styles.tile, { backgroundColor: color[tint] }, style]}>
      <Text style={type.eyebrow}>{label}</Text>
      <Text style={[styles.tileValue, valueColor ? { color: valueColor } : null]}>
        {value}
        {sub ? <Text style={{ fontFamily: font.sansMedium, fontSize: 13, color: color.ink2 }}> {sub}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * Stage status and overall status, always shown as a pair:
 * green "Carpentry · on track", amber "Overall · 4 days late".
 */
export function StatusChip({ tone, label }: { tone: 'ok' | 'late'; label: string }) {
  return (
    <View style={[styles.status, { backgroundColor: tone === 'ok' ? 'rgba(47,107,66,.85)' : 'rgba(201,138,43,.9)' }]}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

/**
 * Progress in segments, 3 px tall, ink for done and line for to do; each
 * done segment grows in from the left. The quiz has 7, Choose & sign 4.
 */
export function Progress({ total, done, label }: { total: number; done: number; label?: string }) {
  const still = useReducedMotion();
  const [vals] = useState(() => Array.from({ length: total }, () => new Animated.Value(still ? 1 : 0)));
  useEffect(() => {
    if (still) return vals.forEach((v) => v.setValue(1));
    Animated.stagger(50, vals.map((v) => Animated.timing(v, { toValue: 1, duration: 900, easing: motion.glide, useNativeDriver: true }))).start();
  }, [vals, still]);
  return (
    <View style={{ gap: 10 }}>
      <View
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        style={{ flexDirection: 'row', gap: 4 }}
      >
        {vals.map((v, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: color.line, overflow: 'hidden' }}>
            {i < done ? (
              <Animated.View
                style={{ flex: 1, backgroundColor: color.ink, transform: [{ scaleX: v }], transformOrigin: 'left' }}
              />
            ) : null}
          </View>
        ))}
      </View>
      {label ? <Meta>{label}</Meta> : null}
    </View>
  );
}

/** A number that counts up to `value` (match scores, the quote total, the coin balance). */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('en-IN'),
  duration = 1100,
  style,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) return;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: n }) => setShown(n));
    Animated.timing(v, { toValue: value, duration, easing: motion.glide, useNativeDriver: false }).start();
    return () => {
      v.removeListener(id);
      v.stopAnimation();
    };
  }, [value, duration, still]);
  return (
    <Text style={style} accessibilityLabel={format(value)}>
      {format(still ? value : shown)}
    </Text>
  );
}

export function Rule() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.line }} />;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper }}>
      <ActivityIndicator color={color.ink} />
    </View>
  );
}

export const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, paddingTop: 18, paddingBottom: space.xl, gap: 18 },
  footer: { paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 28, gap: 8 },
  meta: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink2 },
  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  buttonText: { fontFamily: font.sansMedium, fontSize: 16, letterSpacing: -0.16 },
  disc: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 60,
    borderBottomWidth: 2,
    borderBottomColor: color.ink,
    fontFamily: font.sansMedium,
    fontSize: 30,
    color: color.ink,
    letterSpacing: -0.9,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.paper,
    justifyContent: 'center',
  },
  pillText: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  circleText: { fontFamily: font.sansMedium, fontSize: 13.5, lineHeight: 15.5, color: color.ink, textAlign: 'center' },
  ranked: {
    minHeight: 58,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
    paddingLeft: 9,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankNum: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  segTrack: { flexDirection: 'row', backgroundColor: color.soft2, borderRadius: radius.pill, padding: 4, gap: 4 },
  seg: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  segText: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink2 },
  segSub: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink2, opacity: 0.8 },
  card: { backgroundColor: color.soft, borderRadius: radius.lg, padding: 16, gap: 10 },
  dark: { backgroundColor: color.ink, borderRadius: radius.md, padding: 20, gap: 10 },
  panel: {
    backgroundColor: color.ink,
    borderBottomLeftRadius: radius.panel,
    borderBottomRightRadius: radius.panel,
    paddingHorizontal: space.lg,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  tile: { flex: 1, minHeight: 92, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 12, justifyContent: 'space-between', gap: 6 },
  tileValue: { fontFamily: font.sansMedium, fontSize: 20, letterSpacing: -0.6, color: color.ink },
  status: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  statusText: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
});
