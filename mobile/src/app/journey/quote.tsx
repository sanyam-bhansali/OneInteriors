import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { GeioOrb } from '../../components/brand';
import { QuizScreen } from '../../components/journey/parts';
import { Body, Button, CountUp, ErrorText, Loading, Meta, Press, Stagger, Title } from '../../components/ui';
import { shortDate, inr, lakh } from '../../lib/format';
import { useHeadline, useT } from '../../lib/i18n';
import { useMatches } from '../../lib/journey/matches-hook';
import { ratesArePreLaunch, useChosenMatches } from '../../lib/journey/quote';
import type { ApiQuote } from '../../lib/journey/types';
import { color, font, radius, type } from '../../lib/theme';

/**
 * #13 Quote (designs/Quote.dc.html; the website's /app/quote). One studio at
 * a time behind studio tabs, its lines grouped by room (each room opens to
 * its lines), and the total rolling up in the terracotta card. What the
 * quote is, is said first and in the promised words: a first quote from the
 * studio's own rate card, the band it can move in until they measure, and
 * the date it holds till.
 */

type Room = { room: string; lines: ApiQuote['lines']; subtotal: number };

/** The quote's lines grouped by room, in the order the studio priced them. */
function byRoom(q: ApiQuote): Room[] {
  const rooms: Room[] = [];
  for (const l of q.lines) {
    let r = rooms.find((x) => x.room === l.room);
    if (!r) rooms.push((r = { room: l.room, lines: [], subtotal: 0 }));
    r.lines.push(l);
    r.subtotal += l.amountPaise;
  }
  return rooms;
}

export default function QuoteScreen() {
  const t = useT();
  const h1 = useHeadline(36);
  const chosen = useChosenMatches();
  const { state } = useMatches();
  const [pick, setPick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const matches = chosen.matches;
  const m = matches[Math.min(pick, Math.max(matches.length - 1, 0))];
  const rooms = useMemo(() => (m ? byRoom(m.quote) : []), [m]);

  if (chosen.status === 'loading') return <Loading />;

  if (chosen.status === 'error') {
    return (
      <QuizScreen back={'/journey/matches' as Href} footer={<Button label={t('quoteApp.retry')} onPress={chosen.retry} />}>
        <ErrorText>{chosen.error}</ErrorText>
      </QuizScreen>
    );
  }

  if (!m) {
    return (
      <QuizScreen back={'/journey/matches' as Href} footer={<Button label={t('quoteApp.none.cta')} onPress={() => router.replace('/journey/q/1' as Href)} />}>
        <Title size={h1}>{t('quoteApp.none.h1')}</Title>
        <Body muted>{t('quoteApp.none.sub')}</Body>
      </QuizScreen>
    );
  }

  const q = m.quote;
  const openRoom = open ?? rooms[0]?.room ?? null;
  const many = matches.length > 1;
  const preLaunch = state.status === 'ready' && ratesArePreLaunch(state.view);

  const footer = many ? (
    <Button label={t('quoteApp.compare', { n: matches.length })} onPress={() => router.push('/journey/compare' as Href)} />
  ) : (
    <Button label={t('compare.cta')} onPress={() => router.push('/journey/expert' as Href)} />
  );

  return (
    <QuizScreen
      back={'/journey/matches' as Href}
      meta={many ? t('quoteApp.meta', { n: matches.length }) : t('quoteApp.metaOne')}
      footer={footer}
      footerRule
    >
      <View style={{ gap: 20, marginTop: -8 }}>
        <Title size={h1} style={{ lineHeight: h1 * 0.98 }}>
          {t('quoteApp.h1')}
        </Title>

        <View style={styles.note}>
          <InfoIcon />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.noteTitle}>{t('quoteApp.first')}</Text>
            <Text style={styles.noteBody}>
              {t('quoteApp.final')} {t('quoteApp.valid', { date: shortDate(q.validTill) })}
            </Text>
          </View>
        </View>
        {preLaunch ? <Meta style={{ color: color.accentInk }}>{t('quoteApp.preLaunch')}</Meta> : null}

        {many ? (
          <View role="tablist" aria-label={t('quoteApp.studios')} style={styles.tabs}>
            {matches.map((s, i) => {
              const on = s.slug === m.slug;
              return (
                <Stagger key={s.slug} i={i} start={220}>
                  <Press
                    onPress={() => {
                      setPick(i);
                      setOpen(null);
                    }}
                    accessibilityRole="tab"
                    accessibilityLabel={s.name}
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, on && { color: color.white }]}>{s.name}</Text>
                  </Press>
                </Stagger>
              );
            })}
          </View>
        ) : null}

        <View role="tabpanel" aria-label={m.name}>
          {rooms.map((r) => {
            const isOpen = openRoom === r.room;
            const count = r.lines.length === 1 ? t('quoteApp.line') : t('quoteApp.lines', { n: r.lines.length });
            return (
              <View key={`${m.slug}-${r.room}`} style={styles.room}>
                <Pressable
                  onPress={() => setOpen(isOpen ? '' : r.room)}
                  role="button"
                  aria-expanded={isOpen}
                  aria-label={`${r.room}, ${inr(r.subtotal)}, ${count}`}
                  style={styles.roomHead}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.roomName}>{r.room}</Text>
                    <Text style={styles.amt}>{inr(r.subtotal)}</Text>
                  </View>
                  <View style={styles.rowTop}>
                    <Text style={styles.spec} numberOfLines={1}>
                      {count}
                      {r.lines[0]?.spec ? ` · ${r.lines[0].spec}` : ''}
                    </Text>
                    <Chevron open={isOpen} />
                  </View>
                </Pressable>
                {isOpen ? (
                  <View style={styles.lines}>
                    {r.lines.map((l, i) => (
                      <View key={`${l.item}-${i}`} style={styles.line} accessible accessibilityLabel={`${l.item}, ${inr(l.amountPaise)}. ${[l.size, l.spec].filter(Boolean).join(', ')}`}>
                        <View style={styles.rowTop}>
                          <Text style={styles.lineItem}>{l.item}</Text>
                          <Text style={styles.lineAmt}>{inr(l.amountPaise)}</Text>
                        </View>
                        <Text style={styles.spec}>{[l.size, l.spec].filter(Boolean).join(' · ')}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.total} accessible accessibilityLabel={`${t('quoteApp.total', { n: q.lines.length })}: ${inr(q.totalPaise)}`}>
          <View style={styles.totalTop}>
            <Text style={styles.totalLabel}>{t('quoteApp.total', { n: q.lines.length })}</Text>
            <Text style={styles.totalBig}>
              <CountUp key={m.slug} value={q.totalPaise} format={(v) => `₹${(v / 1e7).toFixed(1)}`} duration={900} style={styles.totalBig} />
              <Text style={styles.totalUnit}> L</Text>
            </Text>
          </View>
          <Text style={styles.totalExact}>{inr(q.totalPaise)}</Text>
          <Text style={styles.totalNote}>{t('quoteApp.included')}</Text>
        </View>

        <Text style={styles.small}>
          {t('quoteApp.band', { low: lakh(q.lowPaise), high: lakh(q.highPaise) })} {t('quoteApp.ownCard')}
        </Text>

        <Press onPress={() => router.push('/geio' as Href)} accessibilityRole="link" accessibilityLabel={t('quoteApp.geio')} style={styles.geio}>
          <GeioOrb size={30} />
          <Text style={styles.geioText}>{t('quoteApp.geio')}</Text>
        </Press>
      </View>
    </QuizScreen>
  );
}

function InfoIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginTop: 1 }} aria-hidden>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color.accent} strokeWidth={1.8} />
      <Path d="M12 11v5M12 8h.01" stroke={color.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} aria-hidden>
      <Path d="m6 9 6 6 6-6" fill="none" stroke={color.ink2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: color.soft, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16 },
  noteTitle: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 20, color: color.ink },
  noteBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: color.ring, justifyContent: 'center' },
  tabOn: { backgroundColor: color.ink, borderColor: color.ink },
  tabText: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  room: { borderTopWidth: 1, borderTopColor: color.line },
  roomHead: { minHeight: 64, paddingVertical: 14, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
  roomName: { flex: 1, fontFamily: font.sansMedium, fontSize: 16, color: color.ink },
  amt: { fontFamily: font.mono, fontSize: 14.5, color: color.ink },
  spec: { flex: 1, fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: color.ink2 },
  lines: { paddingLeft: 12, paddingBottom: 10, borderLeftWidth: 2, borderLeftColor: color.line, marginBottom: 10, gap: 12 },
  line: { gap: 3 },
  lineItem: { flex: 1, fontFamily: font.sans, fontSize: 15, lineHeight: 21, color: color.ink },
  lineAmt: { fontFamily: font.mono, fontSize: 13.5, color: color.ink },
  total: { borderRadius: radius.md, backgroundColor: '#BA5329', padding: 22, gap: 10 },
  totalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  totalLabel: { flex: 1, fontFamily: font.sansMedium, fontSize: 20, lineHeight: 22, letterSpacing: -0.6, color: color.white },
  totalBig: { fontFamily: font.monoMedium, fontSize: 44, lineHeight: 46, letterSpacing: -2, color: color.white },
  totalUnit: { fontFamily: font.sansMedium, fontSize: 22, color: color.white },
  totalExact: { fontFamily: font.mono, fontSize: 14, color: 'rgba(255,255,255,.85)', alignSelf: 'flex-end' },
  totalNote: { fontFamily: font.mono, fontSize: 13, lineHeight: 19, letterSpacing: 0.5, color: 'rgba(255,255,255,.92)' },
  small: { ...type.body, fontSize: 13.5, lineHeight: 20, color: color.ink2 },
  geio: { alignSelf: 'flex-start', minHeight: 44, paddingLeft: 6, paddingRight: 16, borderRadius: radius.pill, backgroundColor: color.soft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  geioText: { fontFamily: font.sansMedium, fontSize: 14, color: color.ink },
});
