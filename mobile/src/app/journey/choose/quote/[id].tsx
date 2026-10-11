import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChooseFrame, LineIcon } from '../../../../components/journey/choose-parts';
import { Button, CountUp, ErrorText, Eyebrow, Heading, Loading, Title } from '../../../../components/ui';
import { inr } from '../../../../lib/format';
import { useHeadline, useT } from '../../../../lib/i18n';
import { chooseApi, type FinalQuoteView } from '../../../../lib/journey/choose';
import { useProfile } from '../../../../lib/profile';
import { color, font, radius } from '../../../../lib/theme';

/**
 * #19 Choose 3 · Final quote (design FinalQuote.dc.html; the website's
 * src/app/app/choose/quote/[id]). The studio's own quotation after
 * measuring: the total, and how it compares with the first quote, both
 * before GST (the studio's quotation may carry no GST line, and comparing it
 * with a figure that did would read as a saving that is not one). The
 * design's "3 lines changed · 37 unchanged" is not shown: the final quote's
 * lines are the studio's own products and the first quote's are our
 * catalogue codes, so nothing pairs them (docs/APP-API-JOURNEY.md). Every
 * room and line is here instead, then what signing locks.
 */

type State = { status: 'loading' } | { status: 'ready'; q: FinalQuoteView } | { status: 'error'; error: string };

/** Within a rupee counts as the same. */
const SAME = 100;

export default function FinalQuote() {
  const t = useT();
  const h1 = useHeadline(34);
  const expert = useProfile().profile.expert.name;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await chooseApi.quote(String(id));
    setState(res.ok ? { status: 'ready', q: res.data.quote } : { status: 'error', error: res.error });
  }, [id]);

  useEffect(() => {
    let live = true;
    void chooseApi.quote(String(id)).then((res) => {
      if (live) setState(res.ok ? { status: 'ready', q: res.data.quote } : { status: 'error', error: res.error });
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') {
    return (
      <ChooseFrame
        back="/journey/choose"
        step={3}
        footer={
          <Button
            label={t('choose.retry')}
            onPress={() => {
              setState({ status: 'loading' });
              void load();
            }}
          />
        }
      >
        <Title size={h1}>{t('final.h1')}</Title>
        <ErrorText>{state.error}</ErrorText>
      </ChooseFrame>
    );
  }

  const q = state.q;
  const diff = q.firstBeforeGstPaise === null ? null : q.beforeTaxPaise - q.firstBeforeGstPaise;
  const weeks = Math.round(q.handoverDays / 7);
  const pcts = q.stages.every((s) => s.pct !== null) ? q.stages.map((s) => `${s.pct}%`).join(' · ') : null;
  const toggle = (room: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });

  const footer = q.accepted ? (
    <Button label={t('choose.open')} onPress={() => router.replace('/home')} />
  ) : (
    <>
      <Button
        label={t('final.cta')}
        onPress={() =>
          router.push({
            pathname: '/journey/choose/sign/[id]',
            params: { id: q.id },
          })
        }
      />
      <Button label={t('final.ask', { expert })} variant="ghost" onPress={() => router.push('/geio?ask=expert')} />
    </>
  );

  return (
    <ChooseFrame back="/journey/choose" step={3} footer={footer}>
      <View style={{ gap: 8 }}>
        <Eyebrow>{t('final.meta', { studio: q.studioName })}</Eyebrow>
        <Title size={h1}>{t('final.h1')}</Title>
      </View>

      <View style={styles.total} accessible accessibilityLabel={`${t('final.totalFor', { n: q.lineCount })}: ${inr(q.beforeTaxPaise)}`}>
        <Text style={styles.totalLabel}>{t('final.totalFor', { n: q.lineCount })}</Text>
        <CountUp value={q.beforeTaxPaise} format={(n) => inr(Math.round(n / 100) * 100)} style={styles.totalFigure} />
        {diff === null ? null : Math.abs(diff) < SAME ? (
          <View style={[styles.pill, { backgroundColor: 'rgba(47,107,66,.25)' }]}>
            <LineIcon name="tick" size={14} tint="#8FD3A4" stroke={2.6} />
            <Text style={[styles.pillText, { color: '#8FD3A4' }]}>{t('final.same')}</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: diff > 0 ? 'rgba(224,122,78,.22)' : 'rgba(47,107,66,.25)',
                },
              ]}
            >
              <Text style={[styles.pillText, { color: diff > 0 ? color.accentWarm : '#8FD3A4' }]}>
                {t(diff > 0 ? 'final.above' : 'final.below', {
                  amount: inr(Math.abs(diff)),
                })}
              </Text>
            </View>
            <Text style={styles.totalNote}>{t('final.measured')}</Text>
          </View>
        )}
      </View>

      <View>
        <Heading style={{ fontSize: 20, paddingBottom: 4 }}>{t('final.rooms')}</Heading>
        {q.rooms.map((r) => {
          const on = open.has(r.room);
          const count = r.lines.length === 1 ? t('final.line1') : t('final.lines', { n: r.lines.length });
          return (
            <View key={r.room} style={styles.room}>
              <Pressable
                role="button"
                aria-expanded={on}
                aria-label={`${r.room}, ${count}, ${inr(r.amountPaise)}`}
                onPress={() => toggle(r.room)}
                style={styles.roomHead}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.roomName}>{r.room}</Text>
                  <Text style={styles.roomSub} numberOfLines={on ? undefined : 1}>
                    {on ? count : `${count} · ${r.lines.map((l) => l.product).join(', ')}`}
                  </Text>
                </View>
                <Text style={styles.amount}>{inr(r.amountPaise)}</Text>
                <View style={{ transform: [{ rotate: on ? '-90deg' : '90deg' }] }}>
                  <LineIcon name="chevron" size={16} tint={color.ink3} />
                </View>
              </Pressable>
              {on
                ? r.lines.map((l, i) => (
                    <View key={`${l.product}-${i}`} style={styles.line}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.lineName}>{l.product}</Text>
                        {l.details ? <Text style={styles.lineSpec}>{l.details}</Text> : null}
                      </View>
                      <Text style={styles.lineAmount}>{inr(l.amountPaise)}</Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}
      </View>

      <View style={styles.bill}>
        <BillRow label={t('final.work')} amount={inr(q.workPaise)} />
        {q.feePaise > 0 ? <BillRow label={t('final.fee')} amount={`+${inr(q.feePaise)}`} /> : null}
        {q.discountPaise > 0 ? <BillRow label={t('final.discount')} amount={`−${inr(q.discountPaise)}`} minus /> : null}
        {q.onSpotPaise > 0 ? <BillRow label={q.onSpotLabel ?? t('final.onSpot')} amount={`−${inr(q.onSpotPaise)}`} minus /> : null}
        <BillRow label={t('final.beforeTax')} amount={inr(q.beforeTaxPaise)} total />
        {q.gstPaise > 0 ? (
          <>
            <BillRow label={t('final.gst')} amount={`+${inr(q.gstPaise)}`} />
            <BillRow label={t('final.pay')} amount={inr(q.totalPaise)} total />
          </>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <Heading style={{ fontSize: 20 }}>{t('final.locked')}</Heading>
        <Locked text={t('final.lock.price')} />
        <Locked text={t('final.lock.materials')} />
        <Locked text={t('final.lock.handover', { weeks })} />
        {q.stages.length ? (
          <Locked text={pcts ? t('final.lock.stages', { n: q.stages.length, pcts }) : t('final.lock.stagesN', { n: q.stages.length })} />
        ) : null}
        {q.terms ? <Locked text={t('final.lock.terms', { studio: q.studioName })} /> : null}
      </View>
    </ChooseFrame>
  );
}

function BillRow({ label, amount, minus, total }: { label: string; amount: string; minus?: boolean; total?: boolean }) {
  return (
    <View style={[styles.billRow, total && styles.billTotal]}>
      <Text style={[styles.billLabel, total && { fontFamily: font.sansSemi, color: color.ink }]}>{label}</Text>
      <Text style={[styles.billAmount, minus && { color: color.ok }, total && { fontFamily: font.monoMedium }]}>{amount}</Text>
    </View>
  );
}

function Locked({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ marginTop: 2 }}>
        <LineIcon name="tick" size={18} tint={color.ok} stroke={2.2} />
      </View>
      <Text style={styles.lockText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  total: {
    borderRadius: radius.md,
    backgroundColor: color.ink,
    padding: 20,
    gap: 12,
  },
  totalLabel: { fontFamily: font.sans, fontSize: 14, color: color.onDark2 },
  totalFigure: {
    fontFamily: font.monoMedium,
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 46,
    color: color.onDark,
  },
  totalNote: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    color: color.onDark2,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: font.sansSemi, fontSize: 13.5 },
  room: { borderTopWidth: 1, borderTopColor: '#EDEDEA' },
  roomHead: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  roomName: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  roomSub: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    color: color.ink2,
  },
  amount: { fontFamily: font.mono, fontSize: 15, color: color.ink },
  line: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: color.line,
    marginBottom: 6,
  },
  lineName: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  lineSpec: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 20,
    color: color.ink2,
  },
  lineAmount: { fontFamily: font.mono, fontSize: 14, color: color.ink },
  bill: {
    backgroundColor: color.soft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 10,
  },
  billTotal: { borderTopWidth: 1, borderTopColor: color.line },
  billLabel: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 15,
    color: color.ink2,
  },
  billAmount: { fontFamily: font.mono, fontSize: 15, color: color.ink },
  lockText: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.ink,
  },
});
