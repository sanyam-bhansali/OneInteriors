import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { color, font, radius, space } from '../lib/theme';

/**
 * The app's parts, to the owner's v1 screens: a warm grey ground, headlines
 * set tight, typewriter labels, terracotta pill actions, dark cards. Motion
 * follows the design file: headlines rise in, lists arrive one by one, a
 * press squashes and springs back with a tap of haptics.
 */

const GLIDE = Easing.bezier(0.22, 1, 0.36, 1);

/** Rises 18 px and fades in, `delay` ms after it mounts. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: GLIDE, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** A pressable that squashes to 96.5% and springs back, with a light haptic. */
export function Press({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  haptic = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: boolean;
}) {
  const [s] = useState(() => new Animated.Value(1));
  const to = (value: number) => Animated.spring(s, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => to(0.965)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }, disabled ? { opacity: 0.4 } : null]}>{children}</Animated.View>
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
}: {
  children: ReactNode;
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  dark?: boolean;
  header?: ReactNode;
}) {
  const bg = dark ? color.dark : color.bg;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
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

export function Meta({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.meta, style]}>{children}</Text>;
}

/** The design's mono label, for every fact. Kept as `Eyebrow` for the screens that already use it. */
export const Eyebrow = Meta;

export function Title({ children, style, size = 36 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  return (
    <Rise>
      <Text style={[styles.title, { fontSize: size, lineHeight: size * 0.98 }, style]}>{children}</Text>
    </Rise>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body15, muted && { color: color.ink2 }, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={[styles.body15, { color: color.accentInk }]}>{children}</Text>;
}

/** The terracotta pill; `dark` for black, `ghost` for an outline. */
export function Button({
  label,
  onPress,
  busy,
  disabled,
  variant = 'accent',
}: {
  label: string;
  onPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'accent' | 'dark' | 'ghost' | 'quiet';
}) {
  const bg = variant === 'accent' ? color.accent : variant === 'dark' ? color.ink : 'transparent';
  const fg = variant === 'accent' || variant === 'dark' ? color.white : color.ink;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        styles.button,
        { backgroundColor: bg },
        variant === 'ghost' && { borderWidth: 1, borderColor: color.line },
        variant === 'accent' && styles.accentShadow,
        variant === 'quiet' && { minHeight: 44 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }, variant === 'quiet' && { fontFamily: font.sansMedium, fontSize: 15 }]}>{label}</Text>}
    </Press>
  );
}

export function Field({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Meta>{label}</Meta>
      <TextInput placeholderTextColor={color.ink3} style={styles.input} {...rest} />
      {hint ? <Text style={[styles.body15, { fontSize: 13, color: color.ink2 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={[styles.chip, on && { backgroundColor: color.ink, borderColor: color.ink }]}>
      <Text style={[styles.chipText, on && { color: color.onDark }]}>{label}</Text>
    </Press>
  );
}

/** The dark card: a headline in mono accent, then the words. */
export function DarkCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.dark, style]}>{children}</View>;
}

export function Rule() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.line }} />;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg }}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: 18, paddingBottom: space.xl, gap: 18 },
  footer: { paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 28, gap: 8 },
  meta: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: color.ink2 },
  title: { fontFamily: font.sansSemi, color: color.ink, letterSpacing: -1.6 },
  body15: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink },
  button: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  accentShadow: { shadowColor: color.accent, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  buttonText: { fontFamily: font.sansSemi, fontSize: 16.5, letterSpacing: -0.2 },
  input: {
    minHeight: 52,
    borderBottomWidth: 1.5,
    borderBottomColor: color.ink,
    fontFamily: font.sansMedium,
    fontSize: 22,
    color: color.ink,
    letterSpacing: -0.4,
  },
  chip: { minHeight: 40, paddingHorizontal: 15, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  chipText: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  dark: {
    backgroundColor: color.dark,
    borderRadius: radius.lg,
    padding: 20,
    gap: 10,
    shadowColor: color.dark,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
});
