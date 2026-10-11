import { StatusBar } from 'expo-status-bar';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { color, space, type } from '../../lib/theme';
import { BackIcon } from '../icons';
import { goBack } from '../journey/parts';
import { Press } from '../ui';

/**
 * The frame of Compare and the expert call (designs Compare, Expert): the
 * body scrolls from the very top so the ink panel runs under a light status
 * bar, and the footer stays pinned with a 1px line above it. `dark` makes
 * the whole page ink (the booked state).
 */
export function PanelPage({ footer, children, dark = false }: { footer: ReactNode; children: ReactNode; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  const bg = dark ? color.ink : color.paper;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}>{children}</ScrollView>
      <View
        style={[
          styles.footer,
          { backgroundColor: bg, paddingBottom: Math.max(insets.bottom, 16) + 14 },
          dark ? null : { borderTopWidth: 1, borderTopColor: color.line },
        ]}
      >
        {footer}
      </View>
    </View>
  );
}

/** The panel's top row: a back chevron on ink and the eyebrow on the right. */
export function PanelHead({ back, meta }: { back: Href; meta: string }) {
  const t = useT();
  return (
    <View style={styles.head}>
      <Press onPress={() => goBack(back)} accessibilityLabel={t('kit.back')} style={styles.back}>
        <BackIcon color={color.onDark} />
      </Press>
      <Text style={[type.eyebrow, { color: color.ink3 }]}>{meta}</Text>
    </View>
  );
}

/** The space the panel leaves for the status bar. */
export function useTopInset(): number {
  return useSafeAreaInsets().top;
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: space.lg, paddingTop: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
