import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, ErrorText, Eyebrow, Loading, Meta, Screen, Title } from '../../components/ui';
import { api, type SignoffView } from '../../lib/api';
import { inr } from '../../lib/format';
import { useT, type T } from '../../lib/i18n';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';

/**
 * Read and sign a quotation in the phone app itself (owner, 1 Nov 2026;
 * customer app Phase 2), with the same rules as the website's page
 * (project/signoffs.ts): every line by room, the totals, the payment stages
 * and the terms, then "I have read and agree" and the full name typed as the
 * signature. The signature binds the `hash` of exactly this content, so what
 * the phone shows and what is signed are the same thing.
 */
export default function SignoffScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useProject();
  const [d, setD] = useState<SignoffView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    void api.signoff(String(id)).then((r) => (r.ok ? setD(r.data) : setError(r.error)));
  }, [id]);

  if (error && !d) {
    return (
      <Screen back>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }
  if (!d) return <Loading />;

  const sign = async () => {
    setBusy(true);
    setError(null);
    const r = await api.signSignoff(d.id, { agreed, name, hash: d.hash });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(r.data.signedLine ?? t('life.sign.done'));
    void refresh();
  };

  const rooms = groupByRoom(d.lines);
  const canSign = d.canSign && !done;
  return (
    <Screen
      back
      footer={
        canSign ? (
          <Button label={t('life.sign.submit')} onPress={() => void sign()} busy={busy} disabled={!agreed || name.trim().length < 3} reason={t('life.sign.name')} />
        ) : undefined
      }
    >
      <Eyebrow>{d.studio ?? ''}</Eyebrow>
      <Title size={30}>{t(`life.sign.kind.${d.kind}` as Parameters<T>[0], { number: `${d.quoteNumber} R${d.revision}` })}</Title>
      {d.signed ? <Body style={{ color: color.ok }}>{d.signed.line}</Body> : null}
      {done ? <Body style={{ color: color.ok }}>{done}</Body> : null}
      {d.changedSince && !d.signed ? <ErrorText>{t('life.sign.superseded')}</ErrorText> : null}

      {rooms.map(([room, lines]) => (
        <View key={room} style={{ gap: 6 }}>
          <Text style={styles.room}>{room}</Text>
          {lines.map((l, i) => (
            <View key={`${room}-${i}`} style={styles.line}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.product}>{l.product}</Text>
                {l.details ? <Text style={styles.details}>{l.details}</Text> : null}
                {l.note ? <Text style={styles.details}>{l.note}</Text> : null}
              </View>
              <Text style={styles.amount}>{inr(l.amountPaise)}</Text>
            </View>
          ))}
        </View>
      ))}

      <Card>
        <Row label={t('sign.work')} value={inr(d.totals.workPaise)} />
        {d.totals.feePaise ? <Row label={t('sign.fee')} value={inr(d.totals.feePaise)} /> : null}
        {d.totals.discountPaise ? <Row label={t('sign.discount')} value={`− ${inr(d.totals.discountPaise)}`} /> : null}
        {d.totals.gstPaise ? <Row label={t('sign.gst')} value={inr(d.totals.gstPaise)} /> : null}
        <Row label={t('sign.total')} value={inr(d.totals.totalPaise)} strong />
      </Card>

      {d.stages.length ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.room}>{t('sign.stages')}</Text>
          {d.stages.map((s, i) => (
            <Row key={`${s.label}-${i}`} label={`${i + 1}. ${s.label}`} value={inr(s.amountPaise)} />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={styles.room}>{t('sign.terms')}</Text>
        <Meta>{d.terms?.trim() ? d.terms : t('life.sign.noTerms')}</Meta>
      </View>

      {canSign ? (
        <View style={{ gap: 12 }}>
          <Pressable role="checkbox" aria-checked={agreed} onPress={() => setAgreed((a) => !a)} style={styles.agree}>
            <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Text style={{ color: color.white, fontSize: 14 }}>✓</Text> : null}</View>
            <Text style={[styles.details, { flex: 1, color: color.ink }]}>{d.agreeText}</Text>
          </Pressable>
          <Eyebrow>{t('life.sign.name')}</Eyebrow>
          <TextInput value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false} aria-label={t('life.sign.name')} style={styles.name} />
        </View>
      ) : !d.signed && !done && d.viewer !== 'owner' ? (
        <Body muted>{t('life.sign.ownerOnly')}</Body>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.details, { flex: 1, color: color.ink }, strong && { fontFamily: font.sansSemi }]}>{label}</Text>
      <Text style={[styles.amount, strong && { fontFamily: font.sansSemi, fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

function groupByRoom(lines: SignoffView['lines']): [string, SignoffView['lines']][] {
  const out = new Map<string, SignoffView['lines']>();
  for (const l of lines) out.set(l.room || '—', [...(out.get(l.room || '—') ?? []), l]);
  return [...out.entries()];
}

const styles = StyleSheet.create({
  room: { fontFamily: font.sansSemi, fontSize: 17, color: color.ink, marginTop: 6 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  product: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  details: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  amount: { fontFamily: font.mono, fontSize: 14, color: color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  agree: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.ink },
  name: { minHeight: 52, borderBottomWidth: 1.5, borderBottomColor: color.ink, fontFamily: font.sans, fontSize: 20, color: color.ink, padding: 0 },
});
