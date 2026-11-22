import { StyleSheet, Text, View } from 'react-native';
import { inr, shortDate } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { PaymentEntry, Payments } from '../../lib/types';
import { TickIcon } from './parts';

/**
 * The payments the studio marked received, on the Project screen's payments
 * card. Nothing to answer: "Remove the client confirms in app for payments —
 * it is marked by our team." (owner, 22 Nov 2026). A payment the client said
 * they did not make, back when they could, still says our team is checking.
 */
export function PaymentEntries({ payments, t }: { payments: Payments; t: T }) {
  // Anything our team is checking first, then the latest three: the history stays a tap away in the locker's receipts.
  const shown = [...payments.entries.filter((e) => e.status === 'disputed'), ...payments.entries.filter((e) => e.status === 'paid').slice(0, 3)].slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {shown.map((e) => (
        <Entry key={e.id} entry={e} t={t} />
      ))}
    </View>
  );
}

function Entry({ entry: e, t }: { entry: PaymentEntry; t: T }) {
  const mode = e.mode ? t(`pay.mode.${e.mode}`) : '';
  return (
    <View style={[styles.box, e.status === 'disputed' && styles.disputed]}>
      <Text style={styles.title}>{t('pay.entry', { amount: inr(e.amountPaise), stage: e.stage })}</Text>
      <Text style={styles.meta}>{t('pay.entryMeta', { date: shortDate(`${e.receivedOn}T12:00:00Z`), mode })}</Text>
      {e.status === 'disputed' ? (
        <Text style={[styles.note, { color: color.accentInk }]}>{t('pay.disputed')}</Text>
      ) : (
        <View style={styles.row}>
          <TickIcon color={color.ok} size={16} />
          <Text style={[styles.meta, { color: color.ok }]}>{t('pay.paid')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 4, backgroundColor: color.paper, borderWidth: 1, borderColor: color.line },
  disputed: { borderColor: color.accentInk },
  title: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  meta: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2 },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
