import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useT } from '../../lib/i18n';
import { color, font, type } from '../../lib/theme';
import { BackIcon } from '../icons';
import { Press, Progress, Screen } from '../ui';
import { goBack, styles as quiz } from './parts';

/**
 * Choose & sign's frame (designs Visits, FinalQuote, Sign): a back chevron,
 * then in the scroll the 4-segment progress with "Step n of 4 · name", the
 * screen, and the pinned footer over a 1px line.
 */
export function ChooseFrame({
  back,
  step,
  footer,
  children,
  onRefresh,
  refreshing,
}: {
  back: Href;
  step: 2 | 3 | 4;
  footer?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useT();
  const header = (
    <View style={quiz.head}>
      <View style={quiz.headRow}>
        <Press onPress={() => goBack(back)} accessibilityLabel={t('kit.back')} style={quiz.back}>
          <BackIcon color={color.ink} />
        </Press>
      </View>
    </View>
  );
  const label = t('choose.step', { n: step, name: t(`choose.step${step}`) });
  return (
    <Screen
      header={header}
      footer={footer ? <View style={quiz.rule}>{footer}</View> : undefined}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <View style={{ gap: 8 }} accessible accessibilityLabel={`${t('choose.progress')}. ${label}`}>
        <Progress total={4} done={step} />
        <Text style={type.eyebrow}>{label}</Text>
      </View>
      {children}
    </Screen>
  );
}

/** A row in a soft card: a white 36 px icon tile, a bold title and a grey line. */
export function InfoRow({
  icon,
  title,
  line,
  right,
  first,
}: {
  icon: ReactNode;
  title: string;
  line: string;
  right?: ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[parts.row, first && { borderTopWidth: 0 }]}>
      <View style={parts.tile}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={parts.title}>{title}</Text>
        <Text style={parts.line}>{line}</Text>
      </View>
      {right}
    </View>
  );
}

const PATHS = {
  calendar: 'M3 10h18M8 3v4M16 3v4',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  tick: 'M20 6 9 17l-5-5',
  chevron: 'm9 18 6-6-6-6',
} as const;

/** The design's line icons, 18 px, 1.8 stroke. */
export function LineIcon({
  name,
  size = 18,
  tint = color.ink,
  stroke = 1.8,
}: {
  name: keyof typeof PATHS;
  size?: number;
  tint?: string;
  stroke?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === 'calendar' ? <Rect x={3} y={5} width={18} height={16} rx={2} fill="none" stroke={tint} strokeWidth={stroke} /> : null}
      {name === 'lock' ? <Rect x={5} y={11} width={14} height={10} rx={2} fill="none" stroke={tint} strokeWidth={stroke} /> : null}
      <Path d={PATHS[name]} fill="none" stroke={tint} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const parts = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDEDEA',
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  line: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    color: color.ink2,
  },
});
