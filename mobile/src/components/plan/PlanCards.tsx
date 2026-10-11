import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useT, type Key } from '../../lib/i18n';
import { color, font, radius } from '../../lib/theme';

/**
 * Basic and Assured side by side (owner decision, 11 Oct 2026), as a radio
 * group. The Sign step uses it to choose; the upgrade screen shows it with
 * Assured picked. Basic says plainly that One Interiors does not check the
 * tracker; Assured lists exactly what we do, nothing more.
 */
export type PlanId = 'basic' | 'assured';

const FEATURES: Record<PlanId, Key[]> = {
  basic: ['plan.f.tracker', 'plan.f.payments', 'plan.f.decisions', 'plan.f.agree'],
  assured: ['plan.f.everything', 'plan.f.daily', 'plan.f.chase', 'plan.f.geio', 'plan.f.calls'],
};

export function PlanCards({ value, onChange }: { value: PlanId; onChange?: (plan: PlanId) => void }) {
  const t = useT();
  return (
    <View role="radiogroup" aria-label={t('plan.choose')} style={{ gap: 12 }}>
      {(['basic', 'assured'] as PlanId[]).map((id) => {
        const on = value === id;
        const dark = id === 'assured';
        const fg = dark ? color.onDark : color.ink;
        const fg2 = dark ? color.onDark2 : color.ink2;
        return (
          <Pressable
            key={id}
            role="radio"
            aria-checked={on}
            aria-label={`${t(`plan.${id}`)}, ${t(`plan.${id}.price`)}`}
            disabled={!onChange}
            onPress={() => onChange?.(id)}
            style={[styles.card, dark ? styles.dark : styles.soft, on && (dark ? styles.onDark : styles.onSoft)]}
          >
            <View style={styles.head}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.name, { color: fg }]}>{t(`plan.${id}`)}</Text>
                <Text style={[styles.line, { color: fg2 }]}>{t(`plan.${id}.line`)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Text style={[styles.price, { color: dark ? color.gold : color.ink }]}>{t(`plan.${id}.price`)}</Text>
                {onChange ? (
                  <View style={[styles.radio, { borderColor: dark ? color.onDark2 : color.ring }, on && { borderColor: color.accent, backgroundColor: color.accent }]}>
                    {on ? <View style={styles.dot} /> : null}
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {FEATURES[id].map((k) => (
                <View key={k} style={styles.row}>
                  <Tick color={k === 'plan.f.agree' ? fg2 : dark ? color.accentWarm : color.ok} muted={k === 'plan.f.agree'} />
                  <Text style={[styles.feature, { color: k === 'plan.f.agree' ? fg2 : fg }]}>{t(k)}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tick({ color: c, muted }: { color: string; muted?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" style={{ marginTop: 2 }}>
      {muted ? (
        <Path d="M9 5v5M9 13h.01" stroke={c} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      ) : (
        <Path d="m4 9.5 3 3 7-7" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, gap: 14, borderWidth: 2, borderColor: 'transparent' },
  soft: { backgroundColor: color.soft },
  dark: { backgroundColor: color.ink },
  onSoft: { borderColor: color.ink },
  onDark: { borderColor: color.accent },
  head: { flexDirection: 'row', gap: 12 },
  name: { fontFamily: font.sansMedium, fontSize: 22, letterSpacing: -0.4 },
  line: { fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
  price: { fontFamily: font.sansSemi, fontSize: 14, textAlign: 'right', maxWidth: 120 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.white },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feature: { flex: 1, fontFamily: font.sans, fontSize: 15, lineHeight: 21 },
});
