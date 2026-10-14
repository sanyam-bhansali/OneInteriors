import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { goBack, styles as quiz } from '../../components/journey/parts';
import { INITIAL_BG, toApiTier, toBriefTier } from '../../components/journey/studio-parts';
import { BackIcon } from '../../components/icons';
import { Button, ErrorText, Eyebrow, Loading, Meta, OptionPill, Press, Screen, Stagger, Title } from '../../components/ui';
import { useBrief } from '../../lib/brief';
import { localityLabel, TIER } from '../../lib/brief-types';
import { useHeadline, useT } from '../../lib/i18n';
import { matchesApi } from '../../lib/journey/matches';
import { useMatches } from '../../lib/journey/matches-hook';
import type { StudioCard } from '../../lib/journey/types';
import { color, font } from '../../lib/theme';

/**
 * #16 All studios (designs/Studios.dc.html; website src/app/app/studios):
 * every listed studio, best match first, each scored on the brief once it is
 * finished, so a studio never scores differently here and on Matches. The
 * filters (the tier they are looking at, near their area, usually on time)
 * work on the phone from what the server sends.
 */
type Filter = 'tier' | 'near' | 'onTime';

export default function StudiosScreen() {
  const t = useT();
  const h1 = useHeadline(32);
  const { brief, ready } = useBrief();
  const { state, tier } = useMatches();
  const [rows, setRows] = useState<StudioCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [on, setOn] = useState<Record<Filter, boolean>>({ tier: false, near: false, onTime: false });

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void matchesApi.studios(brief).then((res) => {
      if (!live) return;
      if (res.ok) {
        setRows(res.data.studios);
        setError(null);
      } else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [ready, brief, attempt]);

  // The tier they are looking at on Matches, else the brief's own.
  const band = tier ?? (state.status === 'ready' ? state.view.tier : null) ?? toApiTier(brief.tier) ?? 'premium';
  const near = brief.locality;

  const shown = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((s) => !on.tier || s.band === band)
      .filter((s) => !on.near || (near !== null && s.localities.includes(near)))
      .filter((s) => !on.onTime || /on time|early/i.test(s.lateness ?? ''))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
  }, [rows, on, band, near]);

  const header = (
    <View style={quiz.head}>
      <View style={quiz.headRow}>
        <Press onPress={() => goBack('/journey/matches' as Href)} accessibilityLabel={t('kit.back')} style={quiz.back}>
          <BackIcon color={color.ink} />
        </Press>
      </View>
    </View>
  );

  if (!ready || (!rows && !error)) return <Loading />;
  if (!rows) {
    return (
      <Screen header={header} footer={<Button label={t('matches.retry')} onPress={() => setAttempt((n) => n + 1)} />}>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'tier', label: t('studios.f.tier', { tier: TIER[toBriefTier(band)].label }) },
    ...(near ? [{ id: 'near' as const, label: t('studios.f.near', { place: localityLabel(near) ?? near }) }] : []),
    { id: 'onTime', label: t('studios.f.onTime') },
  ];
  const scored = rows.some((s) => s.score !== null);

  return (
    <Screen header={header}>
      <View style={{ gap: 14, paddingTop: 2 }}>
        <View style={{ gap: 6 }}>
          <Eyebrow>{t('studios.meta')}</Eyebrow>
          <Title size={h1}>{t('studios.h1', { n: rows.length })}</Title>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <View role="group" aria-label={t('studios.filters')} style={styles.filters}>
            {filters.map((f) => (
              <OptionPill key={f.id} role="checkbox" label={f.label} on={on[f.id]} onPress={() => setOn((o) => ({ ...o, [f.id]: !o[f.id] }))} />
            ))}
          </View>
        </ScrollView>
        <Text style={styles.count} aria-live="polite">
          {scored
            ? shown.length === 1
              ? t('studios.countOne')
              : t('studios.count', { n: shown.length })
            : t('studios.countPlain', { n: shown.length })}
        </Text>
      </View>

      <View>
        {shown.map((s, i) => (
          <Stagger key={s.slug} i={Math.min(i, 8)}>
            <Row s={s} i={i} />
          </Stagger>
        ))}
        {shown.length === 0 ? <Meta style={{ paddingVertical: 16 }}>{t('studios.none')}</Meta> : null}
      </View>
    </Screen>
  );
}

function Row({ s, i }: { s: StudioCard; i: number }) {
  const t = useT();
  const line = [s.area, s.since ? t('studio.since', { year: s.since }) : null].filter(Boolean).join(' · ');
  const meta = [s.band ? TIER[toBriefTier(s.band)].label : null, t('matches.checks', { a: s.checks.passed, b: s.checks.total }), s.lateness ?? t('matches.noData')]
    .filter(Boolean)
    .join(' · ');
  return (
    <Press
      onPress={() => router.push(`/journey/studio/${encodeURIComponent(s.slug)}` as Href)}
      accessibilityRole="link"
      accessibilityLabel={[s.name, line, meta, s.score !== null ? `${s.score} ${t('studios.match')}` : null].filter(Boolean).join('. ')}
      style={styles.row}
    >
      <View style={[styles.initial, { backgroundColor: INITIAL_BG[i % INITIAL_BG.length] }]}>
        <Text style={styles.initialText}>{s.name.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={styles.name}>{s.name}</Text>
        {line ? <Text style={styles.line}>{line}</Text> : null}
        <Text style={styles.meta}>{meta}</Text>
      </View>
      {s.score !== null ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.score}>{Math.round(s.score)}</Text>
          <Text style={styles.meta}>{t('studios.match')}</Text>
        </View>
      ) : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  filterScroll: { marginHorizontal: -20, flexGrow: 0 },
  filters: { flexDirection: 'row', gap: 8 },
  count: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  row: { borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  initial: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: font.sansSemi, fontSize: 19, color: color.white },
  name: { fontFamily: font.sansSemi, fontSize: 16.5, letterSpacing: -0.33, color: color.ink },
  line: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  meta: { fontFamily: font.sans, fontSize: 13.5, color: color.ink2 },
  score: { fontFamily: font.sansMedium, fontSize: 22, letterSpacing: -0.88, color: color.ink },
});
