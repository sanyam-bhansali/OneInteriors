import { useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View, type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Press } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { color, font, motion } from '../../lib/theme';

/** Site's parts (Feed.dc.html): the cube icon and the small black "View in 3D" pill. */

export const CubeIcon = ({ color: c, size = 18 }: { color: ColorValue; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2 3 7v10l9 5 9-5V7z" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** A 44 px black pill with an icon; a terracotta fill rises from the bottom on a press. */
export function SmallPill({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const still = useReducedMotion();
  const [fill] = useState(() => new Animated.Value(0));
  const press = (down: boolean) => {
    if (still) return fill.setValue(down ? 1 : 0);
    Animated.timing(fill, { toValue: down ? 1 : 0, duration: down ? 260 : 380, easing: motion.glide, useNativeDriver: true }).start();
  };
  return (
    <Press onPress={onPress} onPressChange={press} accessibilityLabel={label} style={styles.pill}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: color.accent, transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }] }]}
        />
      </View>
      {icon}
      <Text style={styles.pillText}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: color.ink,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  pillText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.onDark },
});
