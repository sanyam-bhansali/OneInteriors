import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PanelHead, PanelPage, useTopInset } from '../../components/journey-quote/Page';
import { Body, Button, DarkPanel, ErrorText, Loading, Meta, Rise, Stagger, Title } from '../../components/ui';
import { useBrief } from '../../lib/brief';
import { lakh } from '../../lib/format';
import { useHeadline, useT, type T } from '../../lib/i18n';
import { quoteApi, useChosenMatches, type CompareView } from '../../lib/journey/quote';
import { color, font, space, type } from '../../lib/theme';

/**
 * #14 Compare (designs/Compare.dc.html; the website's /app/compare). The
 * gap said in plain words first, on the dark panel, then the rows that
 * explain it: total, wardrobe board, kitchen shutter and counter, time to
 * handover, how late they usually run, checks passed. A cell that differs
 * from the others is marked in terracotta, never called better or worse.
 * Everything is read off the quotes and the studios' records by the server
 * (POST /journey/compare), for the three studios on the quote screen.
 */

type Column = CompareView['columns'][number];

/** Marks the values that differ from the most common one; nothing when all agree or all differ. */
function oddOut(values: (string | null)[]): boolean[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  if (top === values.length || top <= 1) return values.map(() => false);
  return values.map((v) => v !== null && (counts.get(v) ?? 0) < top);
}

/** journey.ts lateness() ("Usually 4 days late", "Usually on time", "Usually 2 days early") in the app's words. */
function late(line: string | null, t: T): { text: string; data: boolean } {
  if (!line) return { text: t('compare.noData'), data: false };
  const n = Number(/(\d+)/.exec(line)?.[1] ?? 0);
  if (/late$/.test(line)) return { text: n === 1 ? t('compare.lateOne') : t('compare.lateN', { n }), data: true };
  if (/early$/.test(line)) return { text: t('compare.early', { n }), data: true };
  return { text: t('compare.onTime'), data: true };
}

export default function CompareScreen() {
  const t = useT();
  const h1 = useHeadline(36);
  const top = useTopInset();
  const { brief, ready } = useBrief();
  const chosen = useChosenMatches();
  const [view, setView] = useState<CompareView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const slugs = chosen.matches.map((m) => m.slug).join(',');

  useEffect(() => {
    if (!ready || chosen.status === 'loading') return;
    let live = true;
    void quoteApi.compare(brief, slugs ? slugs.split(',') : []).then((res) => {
      if (!live) return;
      if (res.ok) setView(res.data);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
    // The brief is read when the slugs or the attempt change, not on every keystroke elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, chosen.status, slugs, attempt]);

  if (error) {
    return (
      <PanelPage footer={<Button label={t('quoteApp.retry')} onPress={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }} />}>
        <View style={{ padding: space.lg, paddingTop: top + 20, gap: 12 }}>
          <ErrorText>{t('compare.error')}</ErrorText>
          <Meta>{error}</Meta>
        </View>
      </PanelPage>
    );
  }
  if (!view) return <Loading />;

  const cols = view.columns;
  if (cols.length < 2) {
    return (
      <PanelPage footer={<Button label={t('quoteApp.none.cta')} onPress={() => router.replace('/journey/q/1' as Href)} />}>
        <View style={{ padding: space.lg, paddingTop: top + 20, gap: 14 }}>
          <Title size={h1}>{t('compare.none.h1')}</Title>
          <Body muted>{t('compare.none.sub')}</Body>
        </View>
      </PanelPage>
    );
  }

  const lates = cols.map((c) => late(c.lateness, t));
  const rows: { label: string; cells: { text: string; mono: boolean }[]; mark?: boolean }[] = [
    { label: t('compare.board'), cells: cols.map((c) => ({ text: c.board ?? '—', mono: true })), mark: true },
    { label: t('compare.shutter'), cells: cols.map((c) => ({ text: c.shutter ?? '—', mono: true })), mark: true },
    { label: t('compare.counter'), cells: cols.map((c) => ({ text: c.counter ?? '—', mono: true })), mark: true },
    {
      label: t('compare.weeks'),
      cells: cols.map((c) => (c.weeks === null ? { text: t('compare.noRecord'), mono: false } : { text: t('compare.weeksN', { n: c.weeks }), mono: true })),
    },
    { label: t('compare.late'), cells: lates.map((l) => ({ text: l.text, mono: l.data })) },
    { label: t('compare.checks'), cells: cols.map((c) => ({ text: c.checks, mono: true })) },
  ].filter((r) => r.cells.some((c) => c.text !== '—'));

  const footer = (
    <>
      <Button label={t('compare.cta')} onPress={() => router.push('/journey/expert' as Href)} />
      <Meta style={{ textAlign: 'center' }}>{t('compare.ctaNote')}</Meta>
    </>
  );

  return (
    <PanelPage footer={footer}>
      <DarkPanel style={{ paddingTop: top + 12, paddingLeft: 12, gap: 18 }}>
        <PanelHead back={'/journey/quote' as Href} meta={t('compare.meta')} />
        <View style={{ paddingLeft: 8, gap: 14 }}>
          <Title size={h1} style={{ color: color.onDark, lineHeight: h1 * 0.98 }}>
            {t('compare.h1')}
          </Title>
          {view.plainWords.map((p, i) => (
            <Rise key={p} delay={120 + i * 60}>
              <Text style={styles.plain}>{p}</Text>
            </Rise>
          ))}
        </View>
      </DarkPanel>

      <View style={styles.table}>
        <View style={[styles.grid, { paddingBottom: 12 }]}>
          {cols.map((c) => (
            <Text key={c.slug} style={styles.name}>
              {c.name}
            </Text>
          ))}
        </View>
        <Row label={t('compare.total')} i={0}>
          {cols.map((c: Column) => (
            <Text key={c.slug} style={styles.total} aria-label={`${c.name}: ${lakh(c.totalPaise)}`}>
              {lakh(c.totalPaise)}
            </Text>
          ))}
        </Row>
        {rows.map((r, ri) => {
          const odd = r.mark ? oddOut(r.cells.map((c) => (c.text === '—' ? null : c.text))) : r.cells.map(() => false);
          return (
            <Row key={r.label} label={r.label} i={ri + 1} last={ri === rows.length - 1}>
              {r.cells.map((cell, i) => (
                <Text
                  key={cols[i]!.slug}
                  aria-label={`${cols[i]!.name}: ${odd[i] ? t('compare.differs', { value: cell.text }) : cell.text}`}
                  style={[cell.mono ? styles.cell : styles.cellWords, odd[i] && { color: '#BA5329' }]}
                >
                  {cell.text}
                </Text>
              ))}
            </Row>
          );
        })}
        {view.ratesReal === false ? <Meta style={{ marginTop: 14 }}>{t('compare.preLaunch')}</Meta> : null}
      </View>
    </PanelPage>
  );
}

function Row({ label, i, last, children }: { label: string; i: number; last?: boolean; children: ReactNode }) {
  return (
    <Stagger i={i} start={220}>
      <View style={[styles.row, last && { borderBottomWidth: 1, borderBottomColor: color.line }]}>
        <Text style={type.eyebrow}>{label}</Text>
        <View style={styles.grid}>{children}</View>
      </View>
    </Stagger>
  );
}

const styles = StyleSheet.create({
  plain: { fontFamily: font.sans, fontSize: 16, lineHeight: 25, color: '#D6D4CE' },
  table: { paddingHorizontal: space.lg, paddingTop: 20 },
  grid: { flexDirection: 'row', gap: 8 },
  name: { flex: 1, fontFamily: font.sansSemi, fontSize: 14, letterSpacing: -0.14, color: color.ink },
  row: { borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 12, gap: 6 },
  total: { flex: 1, fontFamily: font.monoMedium, fontSize: 19, letterSpacing: -0.6, color: color.ink },
  cell: { flex: 1, fontFamily: font.mono, fontSize: 13.5, lineHeight: 19, color: color.ink },
  cellWords: { flex: 1, fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.ink2 },
});
