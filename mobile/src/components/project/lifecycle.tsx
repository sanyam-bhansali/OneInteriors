import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, ErrorText, Meta, Press } from '../ui';
import { api } from '../../lib/api';
import { inr, shortDate } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { Lifecycle, LifecycleStep } from '../../lib/types';

/**
 * Where your project is (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * the current step, the next, and the one thing you must do to unlock it —
 * or "Nothing needed from you" with what the studio is doing. Once every
 * snag is closed, the owner signs off the handover here, which starts the
 * warranty. The server's projection works everything out
 * (portal/lifecycle-view.ts); this only says it.
 */
export function LifecycleCard({ projectId, life, studio, onChanged, t }: { projectId: string; life: Lifecycle; studio: string; onChanged: () => void; t: T }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

  const step = (s: LifecycleStep): string => {
    if ((s.kind === 'design' || s.kind === 'stage') && s.label) return s.label;
    if (s.kind === 'design') return t('life.phase.design');
    return t(`life.step.${s.kind}` as Parameters<T>[0]);
  };
  const b = life.blocker;
  let blocker: string | null = null;
  if (b) {
    const amount = b.amountPaise !== null ? inr(b.amountPaise) : '';
    if (b.kind === 'pay') blocker = ['snags', 'warranty'].includes(life.phase) ? t('life.block.payFinal', { amount }) : t('life.block.pay', { label: b.label ?? '', amount });
    else if (b.kind === 'confirm_snag') blocker = (b.count ?? 1) > 1 ? t('life.block.confirm_snags', { n: b.count ?? 1 }) : t('life.block.confirm_snag');
    else blocker = t(`life.block.${b.kind}` as Parameters<T>[0], { label: b.label ?? '' });
  }
  const warranty = life.warrantyEndsOn ? t(life.warrantyEndsOn >= today ? 'life.warrantyUntil' : 'life.warrantyEnded', { date: shortDate(life.warrantyEndsOn) }) : null;

  const signOff = async () => {
    setBusy(true);
    setError(null);
    const res = await api.signOffHandover(projectId);
    setBusy(false);
    if (!res.ok) return setError(res.error || t('life.signoff.failed'));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(t('life.signoff.done', { date: shortDate(res.data.warrantyEndsOn) }));
    onChanged();
  };

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>{t('life.title')}</Text>
        <Meta>{t(`life.phase.${life.phase}` as Parameters<T>[0])}</Meta>
      </View>
      <View style={styles.row}>
        <Text style={styles.eyebrow}>{t('life.now')}</Text>
        <Text style={styles.big}>{step(life.current)}</Text>
      </View>
      {life.next ? (
        <View style={styles.row}>
          <Text style={styles.eyebrow}>{t('life.next')}</Text>
          <Text style={styles.text}>{step(life.next)}</Text>
        </View>
      ) : null}
      {blocker ? (
        <View style={styles.ask}>
          <Text style={[styles.eyebrow, { color: color.accentInk }]}>{t('life.yourTurn')}</Text>
          <Text style={styles.big}>{blocker}</Text>
          {b?.kind === 'confirm_snag' ? (
            <Press onPress={() => router.push('/snags')} haptic={false} accessibilityRole="link">
              <Text style={styles.link}>{t('life.phase.snags')} →</Text>
            </Press>
          ) : null}
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.big}>{t('life.nothing')}</Text>
          <Text style={styles.note}>{t(`life.doing.${life.studioDoing}` as Parameters<T>[0], { studio })}</Text>
        </View>
      )}
      {warranty ? <Text style={[styles.text, { color: color.ok, fontFamily: font.sansSemi }]}>{warranty}</Text> : null}
      {life.canSignOff && !done ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.note}>{t('life.signoff.body')}</Text>
          <Press onPress={() => void signOff()} disabled={busy} accessibilityLabel={t('life.signoff.button')} style={styles.btn}>
            <Text style={styles.btnText}>{busy ? '…' : t('life.signoff.button')}</Text>
          </Press>
        </View>
      ) : null}
      {done ? <Text style={[styles.text, { color: color.ok }]}>{done}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  eyebrow: { fontFamily: font.sansMedium, fontSize: 12.5, letterSpacing: 12.5 * 0.07, textTransform: 'uppercase', color: color.ink2 },
  row: { gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  ask: { gap: 4, padding: 12, borderRadius: 14, backgroundColor: color.paper, borderWidth: 1, borderColor: color.accentInk },
  big: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  text: { fontFamily: font.sans, fontSize: 14.5, color: color.ink },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  link: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.accentInk, paddingVertical: 6 },
  btn: { minHeight: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.ink },
  btnText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.white },
});
