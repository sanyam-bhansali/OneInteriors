import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { BudgetTier } from '../../lib/brief-types';
import { color, font } from '../../lib/theme';

/**
 * The small parts Matches, All studios and the studio profile share
 * (designs Matches, Studios, Studio): tier names between the API and the
 * brief, rupee ranges in lakh, the green checks chip, and their icons.
 */

export type ApiTier = 'essential' | 'premium' | 'luxury';
export const API_TIERS: ApiTier[] = ['essential', 'premium', 'luxury'];
export const toBriefTier = (t: ApiTier) => t.toUpperCase() as BudgetTier;
export const toApiTier = (t: BudgetTier | null | undefined): ApiTier | null => (t ? (t.toLowerCase() as ApiTier) : null);

/** Lakh with at most one decimal: 1_74_80_000 paise → "17.5". */
const l = (paise: number) => String(Math.round(paise / 1_000_000) / 10);

/** "₹17.5–19.3 L"; a range with no top, "₹24 L+". */
export function lakhRange(lowPaise: number, highPaise: number | null): string {
  return highPaise === null ? `₹${l(lowPaise)} L+` : `₹${l(lowPaise)}–${l(highPaise)} L`;
}

/** The design's row initials, in turn. */
export const INITIAL_BG = ['#BA5329', '#2F6B42', '#0B0B0B', '#8E6A3A', '#5F5F5F'];

/** "15/15 checks" on a pale green chip with a tick. */
export function ChecksChip({ label }: { label: string }) {
  return (
    <View style={styles.okChip}>
      <TickIcon color={color.ok} size={13} />
      <Text style={styles.okText}>{label}</Text>
    </View>
  );
}

/** "Usually 4 days late" on a ringed chip. */
export function RingChip({ label }: { label: string }) {
  return (
    <View style={styles.ringChip}>
      <Text style={styles.ringText}>{label}</Text>
    </View>
  );
}

/** The terracotta-dotted list under "Why they suit you". */
export function Reasons({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.dot} />
          <Text style={styles.reason}>{r}</Text>
        </View>
      ))}
    </View>
  );
}

type P = { color: ColorValue; size?: number };
const stroke = (c: ColorValue, w = 1.8) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const TickIcon = ({ color: c, size = 15 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d="M20 6 9 17l-5-5" {...stroke(c, 2.4)} />
  </Svg>
);
export const ChevronIcon = ({ color: c, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d="m9 6 6 6-6 6" {...stroke(c)} />
  </Svg>
);
export const PencilIcon = ({ color: c, size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" {...stroke(c)} />
  </Svg>
);
export const ShieldIcon = ({ color: c, size = 14 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4" {...stroke(c, 2)} />
  </Svg>
);
export const HeartIcon = ({ color: c, size = 20, filled }: P & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6z" {...stroke(c)} fill={filled ? c : 'none'} />
  </Svg>
);

const styles = StyleSheet.create({
  okChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#E3EDE5',
  },
  okText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ok },
  ringChip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(11,11,11,.18)' },
  ringText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.accent, marginTop: 8 },
  reason: { flex: 1, fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.ink },
});
