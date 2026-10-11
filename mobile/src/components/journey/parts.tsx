import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useT } from '../../lib/i18n';
import { color, font, type } from '../../lib/theme';
import { BackIcon } from '../icons';
import { Press, Progress, Screen, Stagger } from '../ui';

/**
 * The quiz's frame (designs Name, Q1–Q7, StyleDNA): a back chevron with the
 * step's eyebrow on the right, the 7-segment progress under it on the
 * questions, the question scrolling, and the pinned black pill.
 */

/** Back to the screen before; straight to `fallback` when there is no history (a reload on web). */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

export function QuizScreen({
  back,
  meta,
  step,
  footer,
  footerRule = false,
  children,
}: {
  back: Href;
  meta?: string;
  /** 1–7 on a question: draws the progress. */
  step?: number;
  footer: ReactNode;
  /** The 1px line above the footer some designs draw. */
  footerRule?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const header = (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <Press onPress={() => goBack(back)} accessibilityLabel={t('kit.back')} style={styles.back}>
          <BackIcon color={color.ink} />
        </Press>
        {meta ? <Text style={type.eyebrow}>{meta}</Text> : null}
      </View>
      {step ? (
        <View style={{ paddingLeft: 8 }}>
          <Progress total={7} done={step} />
        </View>
      ) : null}
    </View>
  );
  return (
    <Screen header={header} footer={<View style={footerRule ? styles.rule : null}>{footer}</View>}>
      <View style={{ gap: 24, paddingTop: 6 }}>{children}</View>
    </Screen>
  );
}

/** A row in a pick-one list (Q2 scope, Q7 involvement): title, hint, and a radio dot on the right. */
export function RadioRow({ title, hint, on, onPress, i }: { title: string; hint: string; on: boolean; onPress: () => void; i: number }) {
  return (
    <Stagger i={i} start={220}>
      <Press
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={`${title}. ${hint}`}
        accessibilityState={{ checked: on }}
        style={styles.row}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowHint}>{hint}</Text>
        </View>
        <View style={[styles.radio, on ? styles.radioOn : null]}>
          <View style={styles.radioDot} />
        </View>
      </Press>
    </Stagger>
  );
}

/** The uppercase label above a group of options. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <Text style={[type.eyebrow, { marginBottom: 10 }]}>{children}</Text>;
}

/** The four priority icons of Q6, drawn as the design draws them. */
const PRIORITY_PATHS = {
  SPEED: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  DESIGN_AMBITION: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  BUDGET: 'M7 5h10M7 9h10M13 9a4 4 0 0 1-4 4H7l7 7M9 5a4 4 0 0 1 4 4',
  MATERIAL_QUALITY: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
} as const;

export function PriorityIcon({ id, tint, size = 24 }: { id: keyof typeof PRIORITY_PATHS; tint: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={PRIORITY_PATHS[id]} fill="none" stroke={tint} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const styles = StyleSheet.create({
  head: { paddingTop: 8, paddingLeft: 12, paddingRight: 20, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rule: { borderTopWidth: 1, borderTopColor: color.line, marginHorizontal: -20, marginTop: -12, paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  row: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingVertical: 16,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowTitle: { fontFamily: font.sansMedium, fontSize: 20, letterSpacing: -0.5, color: color.ink },
  rowHint: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(11,11,11,.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: color.ink, borderColor: color.ink },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.white },
});
