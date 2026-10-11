import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Press } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { color, font, motion, radius } from '../../lib/theme';
import { ChevronIcon } from './icons';

/**
 * Me's parts (Me.dc.html): a soft group of rows, each a white 36 px icon
 * tile, a title and a line under it, and a chevron; and the on/off switch.
 */

/** A soft card holding rows, divided by hairlines. */
export function RowGroup({ children }: { children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <View key={i} style={i ? styles.divider : null}>
          {row}
        </View>
      ))}
    </View>
  );
}

export function Row({
  title,
  sub,
  icon,
  onPress,
  tone = 'ink',
  label,
}: {
  title: string;
  sub?: string;
  icon: ReactNode;
  onPress: () => void;
  /** `danger` sets the title in accent ink: log out, delete. */
  tone?: 'ink' | 'danger';
  label?: string;
}) {
  return (
    <Press onPress={onPress} haptic={false} accessibilityRole="link" accessibilityLabel={label ?? (sub ? `${title}. ${sub}` : title)} style={styles.row}>
      <View style={styles.iconTile}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, tone === 'danger' && { color: color.accentInk }]}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <ChevronIcon color="#B9B7B1" />
    </Press>
  );
}

/** A 48 × 28 switch: green when on, the knob springs across. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  const still = useReducedMotion();
  const [x] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    if (still) return x.setValue(on ? 1 : 0);
    Animated.timing(x, { toValue: on ? 1 : 0, duration: 250, easing: motion.spring, useNativeDriver: false }).start();
  }, [on, still, x]);
  return (
    <Pressable
      role="switch"
      aria-checked={on}
      aria-label={label}
      hitSlop={10}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!on);
      }}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: ['#C9C7C1', color.ok], extrapolate: 'clamp' }) },
        ]}
      >
        <Animated.View style={[styles.knob, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
}

/** A row with words on the left and a switch on the right. */
export function SwitchRow({ title, sub, on, onChange }: { title: string; sub: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Toggle on={on} onChange={onChange} label={title} />
    </View>
  );
}

export const styles = StyleSheet.create({
  group: { backgroundColor: color.soft, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 4 },
  divider: { borderTopWidth: 1, borderTopColor: '#EDEDEA' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  iconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  sub: { fontFamily: font.sans, fontSize: 14, lineHeight: 19, color: color.ink2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.white,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
