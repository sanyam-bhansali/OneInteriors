import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, ErrorText, Meta, Press } from '../ui';
import { api } from '../../lib/api';
import { inr, shortDate } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { Extra, Signoff } from '../../lib/types';

/**
 * Change orders and digital sign-off on the project tab (owner, 15 Oct 2026;
 * the website's app/app/project/ExtrasCard.tsx says the same):
 *
 * - Extra work the studio added after design sign-off: what, its size, the
 *   price, why, and Approve / Decline (with a reason). Once approved, the
 *   amount due and how to pay (the studio directly; confirm it under
 *   Payments when they record it). Nothing is made until it is paid.
 * - Quotations to sign: opens the website's reading and signing page inside
 *   the app (the quotation in its own format, I agree, typed name, Sign).
 *
 * The owner answers; family see the same and cannot.
 */

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
const day = (d: string) => shortDate(`${d}T12:00:00Z`);

export function SignoffsCard({ signoffs, t }: { signoffs: Signoff[]; t: T }) {
  return (
    <Card>
      <Text style={styles.title}>{t('life.sign.title')}</Text>
      {signoffs.map((s) => (
        <Press
          key={s.id}
          onPress={() => router.push({ pathname: '/web', params: { path: `/app/signoff/${s.id}`, title: t('life.sign.title') } })}
          accessibilityRole="link"
          style={styles.row}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.big}>{t(`life.sign.kind.${s.kind}` as Parameters<T>[0], { number: `${s.quoteNumber} R${s.revision}` })}</Text>
            <Text style={styles.note}>
              {s.state === 'signed' && s.signerName && s.signedOn
                ? `✓ ${t('life.sign.signed', { name: s.signerName, date: day(s.signedOn) })}`
                : s.state === 'superseded'
                  ? t('life.sign.superseded')
                  : `${inr(s.totalPaise)} · ${t('life.sign.read')}`}
            </Text>
          </View>
          <Text style={styles.link}>→</Text>
        </Press>
      ))}
    </Card>
  );
}

export function ExtrasCard({ extras, onChanged, t }: { extras: Extra[]; onChanged: () => void; t: T }) {
  return (
    <Card>
      <Text style={styles.title}>{t('life.extra.title')}</Text>
      <Text style={styles.note}>{t('life.extra.intro')}</Text>
      {extras.map((e) => (
        <ExtraItem key={e.id} e={e} onChanged={onChanged} t={t} />
      ))}
    </Card>
  );
}

function ExtraItem({ e, onChanged, t }: { e: Extra; onChanged: () => void; t: T }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const answer = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const res = await api.answerExtra(e.id, approve, reason);
    setBusy(false);
    if (!res.ok) return setError(res.error || t('life.extra.failed'));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(t('life.extra.done'));
    setDeclining(false);
    onChanged();
  };

  const state = e.state === 'approved' ? t('life.extra.state.approved', { amount: inr(e.duePaise) }) : t(`life.extra.state.${e.state}` as Parameters<T>[0]);
  return (
    <View style={styles.item}>
      <View style={styles.head}>
        <Text style={[styles.big, { flex: 1 }]}>
          {t('life.extra.number', { n: e.number })}: {e.title}
        </Text>
        <Text style={styles.big}>{inr(e.totalPaise)}</Text>
      </View>
      <Meta>{state}</Meta>
      {e.reason ? (
        <Text style={styles.text}>
          <Text style={styles.note}>{t('life.extra.why')}: </Text>
          {e.reason}
        </Text>
      ) : null}
      {e.lines.map((l, i) => (
        <View key={i} style={styles.line}>
          <Text style={[styles.text, { flex: 1 }]}>
            {l.product}
            {l.room ? ` · ${l.room}` : ''}
            {l.size ? ` · ${l.size}` : ''}
          </Text>
          <Text style={styles.text}>{inr(l.amountPaise)}</Text>
        </View>
      ))}
      {e.discountPaise > 0 ? (
        <View style={styles.line}>
          <Text style={[styles.note, { flex: 1 }]}>{t('life.extra.discount')}</Text>
          <Text style={styles.note}>− {inr(e.discountPaise)}</Text>
        </View>
      ) : null}
      {e.gstPaise > 0 ? (
        <View style={styles.line}>
          <Text style={[styles.note, { flex: 1 }]}>{t('life.extra.gst', { pct: pct(e.gstBps) })}</Text>
          <Text style={styles.note}>{inr(e.gstPaise)}</Text>
        </View>
      ) : null}
      {e.photoUrl ? (
        <Press onPress={() => void WebBrowser.openBrowserAsync(e.photoUrl!)} accessibilityRole="link" haptic={false}>
          <Text style={styles.link}>{t('life.extra.photo')} →</Text>
        </Press>
      ) : null}
      {e.state === 'declined' && e.declineReason ? <Text style={styles.note}>“{e.declineReason}”</Text> : null}
      {e.state === 'approved' ? <Text style={styles.note}>{t('life.extra.howToPay')}</Text> : null}
      {e.canAnswer && !done ? (
        declining ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.note}>{t('life.extra.declineReason')}</Text>
            <TextInput value={reason} onChangeText={setReason} multiline maxLength={600} style={styles.input} accessibilityLabel={t('life.extra.declineReason')} />
            <View style={styles.buttons}>
              <Press onPress={() => setDeclining(false)} disabled={busy} style={styles.btnGhost} accessibilityLabel="Close">
                <Text style={styles.btnGhostText}>×</Text>
              </Press>
              <Press onPress={() => void answer(false)} disabled={busy || reason.trim().length < 3} style={styles.btn} accessibilityLabel={t('life.extra.sendDecline')}>
                <Text style={styles.btnText}>{busy ? '…' : t('life.extra.sendDecline')}</Text>
              </Press>
            </View>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Press onPress={() => void answer(true)} disabled={busy} style={styles.btn} accessibilityLabel={t('life.extra.approve')}>
              <Text style={styles.btnText}>{busy ? '…' : t('life.extra.approve')}</Text>
            </Press>
            <Press onPress={() => setDeclining(true)} disabled={busy} style={styles.btnGhost} accessibilityLabel={t('life.extra.decline')}>
              <Text style={styles.btnGhostText}>{t('life.extra.decline')}</Text>
            </Press>
          </View>
        )
      ) : null}
      {done ? <Text style={[styles.text, { color: color.ok }]}>{done}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  item: { gap: 6, paddingTop: 12, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  head: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  line: { flexDirection: 'row', gap: 10 },
  big: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  text: { fontFamily: font.sans, fontSize: 14.5, color: color.ink },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  link: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.accentInk, paddingVertical: 6 },
  input: { minHeight: 72, borderWidth: 1, borderColor: color.line, borderRadius: 12, padding: 10, fontFamily: font.sans, fontSize: 14.5, color: color.ink, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  btn: { minHeight: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.ink },
  btnText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.white },
  btnGhost: { minHeight: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.line },
  btnGhostText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink },
});
