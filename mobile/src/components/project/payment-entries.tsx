import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorText, Press } from '../ui';
import { api } from '../../lib/api';
import { inr, shortDate } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { PaymentEntry, Payments } from '../../lib/types';
import { TickIcon } from './parts';

/**
 * The payments the studio marked received, on the Project screen's payments
 * card (studio workspace Phase 5). Each waiting one asks "Did you pay this?"
 * with two one-tap answers: "Yes, I paid" (it then counts as paid) and "I
 * didn't pay this" (it goes to One Interiors' team, who call; the studio sees
 * only that we are checking). Family see the entries but cannot answer.
 */
export function PaymentEntries({ payments, onChanged, t }: { payments: Payments; onChanged: () => void; t: T }) {
  // Anything waiting on an answer first, then the latest few: the history stays a tap away in the locker's receipts.
  const shown = [...payments.entries.filter((e) => e.status !== 'confirmed'), ...payments.entries.filter((e) => e.status === 'confirmed').slice(0, 2)].slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {shown.map((e) => (
        <Entry key={e.id} entry={e} onChanged={onChanged} t={t} />
      ))}
    </View>
  );
}

function Entry({ entry: e, onChanged, t }: { entry: PaymentEntry; onChanged: () => void; t: T }) {
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null);
  const [answer, setAnswer] = useState<'confirmed' | 'disputed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = answer ?? e.status;
  const mode = e.mode ? t(`pay.mode.${e.mode}`) : '';

  const send = async (kind: 'confirm' | 'dispute') => {
    setBusy(kind);
    setError(null);
    const res = kind === 'confirm' ? await api.confirmPayment(e.id) : await api.disputePayment(e.id, '');
    setBusy(null);
    if (!res.ok) return setError(res.error);
    void Haptics.notificationAsync(kind === 'confirm' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setAnswer(kind === 'confirm' ? 'confirmed' : 'disputed');
    onChanged();
  };

  const asking = e.canAnswer && (status === 'waiting' || status === 'earlier');
  return (
    <View style={[styles.box, status === 'waiting' && styles.asking, status === 'disputed' && styles.disputed]}>
      {status === 'waiting' && e.canAnswer ? <Text style={styles.eyebrow}>{t('pay.toConfirm')}</Text> : null}
      <Text style={styles.title}>{t('pay.entry', { amount: inr(e.amountPaise), stage: e.stage })}</Text>
      <Text style={styles.meta}>{t('pay.entryMeta', { date: shortDate(`${e.receivedOn}T12:00:00Z`), mode })}</Text>
      {status === 'confirmed' ? (
        <View style={styles.row}>
          <TickIcon color={color.ok} size={16} />
          <Text style={[styles.meta, { color: color.ok }]}>{t('pay.confirmed')}</Text>
        </View>
      ) : status === 'disputed' ? (
        <Text style={[styles.note, { color: color.accentInk }]}>{answer === 'disputed' ? t('pay.sentToTeam') : t('pay.disputed')}</Text>
      ) : status === 'earlier' ? (
        <Text style={styles.note}>{t('pay.earlier')}</Text>
      ) : (
        <Text style={styles.note}>{t('pay.waitingNote')}</Text>
      )}
      {asking ? (
        <View style={styles.buttons}>
          <Press
            onPress={() => void send('confirm')}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`${t('pay.confirm')}: ${inr(e.amountPaise)}, ${e.stage}`}
            style={[styles.btn, styles.yes]}
          >
            <Text style={[styles.btnText, { color: color.white }]}>{busy === 'confirm' ? '…' : t('pay.confirm')}</Text>
          </Press>
          <Press
            onPress={() => void send('dispute')}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`${t('pay.dispute')}: ${inr(e.amountPaise)}, ${e.stage}`}
            style={[styles.btn, styles.no]}
          >
            <Text style={styles.btnText}>{busy === 'dispute' ? '…' : t('pay.dispute')}</Text>
          </Press>
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

/* The design's warm tint for something waiting on the customer (Tracker.dc.html), not a theme token. */
const ASK_BG = '#F5E2D8';

const styles = StyleSheet.create({
  box: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 4, backgroundColor: color.paper, borderWidth: 1, borderColor: color.line },
  asking: { backgroundColor: ASK_BG, borderColor: ASK_BG },
  disputed: { borderColor: color.accentInk },
  eyebrow: { fontFamily: font.sansMedium, fontSize: 12.5, letterSpacing: 12.5 * 0.07, textTransform: 'uppercase', color: color.accentInk },
  title: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  meta: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2 },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  btn: { minHeight: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  yes: { backgroundColor: color.ink },
  no: { borderWidth: 1, borderColor: color.ink },
  btnText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink },
});
