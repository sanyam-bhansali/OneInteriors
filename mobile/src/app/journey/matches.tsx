import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { goBack, styles as quiz } from '../../components/journey/parts';
import { API_TIERS, ChecksChip, ChevronIcon, PencilIcon, Reasons, RingChip, lakhRange, toApiTier, toBriefTier, type ApiTier } from '../../components/journey/studio-parts';
import { ArrowIcon, BackIcon } from '../../components/icons';
import { Body, Button, CountUp, ErrorText, Eyebrow, Loading, Meta, Press, Rise, Screen, Segmented, Stagger, Title } from '../../components/ui';
import { useBrief } from '../../lib/brief';
import { carpetAreaFor, TIER, tierRangeFor } from '../../lib/brief-types';
import { useHeadline, useT } from '../../lib/i18n';
import type { MatchesWithRates } from '../../lib/journey/matches';
import { useMatches } from '../../lib/journey/matches-hook';
import type { ApiMatch } from '../../lib/journey/types';
import { color, font, type } from '../../lib/theme';

/**
 * #11 Matches (designs/Matches.dc.html; website src/app/app/matches): three
 * studios scored on the brief, the scores counting up. The Essential /
 * Premium / Luxury switch previews who fits a band up or down; the brief's
 * own tier changes only when they go on for quotes from what they are
 * looking at, so the quotes match the matches. Each card opens the studio.
 */
export default function MatchesScreen() {
  const t = useT();
  const h1 = useHeadline(34);
  const { brief, ready, update } = useBrief();
  const { state, load, tier, setTier } = useMatches();

  // Fetch on arrival and whenever they come back with changed answers; never loop on a fetch in flight.
  const stale = state.status === 'idle' || (state.status === 'ready' && state.key !== JSON.stringify(brief));
  useFocusEffect(
    useCallback(() => {
      if (ready && stale) void load();
    }, [ready, stale, load]),
  );

  const view = state.status === 'ready' ? (state.view as MatchesWithRates) : null;
  useEffect(() => {
    if (view && tier === null) setTier(view.tier);
  }, [view, tier, setTier]);

  const header = (
    <View style={[quiz.head, { paddingRight: 12 }]}>
      <View style={quiz.headRow}>
        <Press onPress={() => goBack('/journey/style' as Href)} accessibilityLabel={t('kit.back')} style={quiz.back}>
          <BackIcon color={color.ink} />
        </Press>
        {brief.completedAt ? (
          <Press onPress={() => router.push('/journey/q/1' as Href)} accessibilityRole="link" style={styles.edit}>
            <PencilIcon color={color.ink} />
            <Text style={styles.editText}>{t('matches.edit')}</Text>
          </Press>
        ) : null}
      </View>
    </View>
  );

  if (!ready || state.status === 'idle' || state.status === 'loading') return <Loading />;

  if (state.status === 'error') {
    return (
      <Screen header={header} footer={<Button label={t('matches.retry')} onPress={() => void load()} />}>
        <ErrorText>{state.error}</ErrorText>
      </Screen>
    );
  }

  const v = view!;
  const own = toApiTier(brief.tier);
  const shown: ApiTier = tier ?? v.tier;
  const list: ApiMatch[] = v.tiers[shown];
  const { sqft } = carpetAreaFor(brief);
  const range = (k: ApiTier) => {
    const r = tierRangeFor(toBriefTier(k), sqft);
    return lakhRange(r.lowPaise, r.highPaise);
  };
  const tierSwitch = (
    <Segmented
      label={t('matches.tiers')}
      value={shown}
      onChange={setTier}
      options={API_TIERS.map((k) => ({ id: k, label: TIER[toBriefTier(k)].label, sub: k === own ? t('matches.yourPick') : range(k) }))}
    />
  );

  // Not finished, or nothing fits this band: say so rather than show a studio that does not fit.
  if (!brief.completedAt || list.length === 0) {
    const first = !brief.completedAt;
    return (
      <Screen
        header={header}
        footer={<Button label={t(first ? 'matches.first.cta' : 'matches.none.cta')} onPress={() => router.push((first ? '/journey/name' : '/journey/q/1') as Href)} />}
      >
        <View style={{ gap: 18, paddingTop: 6 }}>
          <Title size={h1}>{t(first ? 'matches.first.h1' : 'matches.none.h1')}</Title>
          <Body muted>{t(first ? 'matches.first.sub' : 'matches.none.sub')}</Body>
          {first ? null : tierSwitch}
        </View>
      </Screen>
    );
  }

  const chose = own ? TIER[toBriefTier(own)].label : null;
  const words = range(shown);
  const go = () => {
    if (shown !== own) {
      const r = tierRangeFor(toBriefTier(shown), sqft);
      update({ tier: toBriefTier(shown), budgetMinPaise: r.lowPaise, budgetMaxPaise: r.highPaise });
    }
    setTier(shown);
    router.push('/journey/phone' as Href);
  };

  return (
    <Screen
      header={header}
      footer={
        <View style={quiz.rule}>
          <Button label={list.length === 1 ? t('matches.ctaOne') : t('matches.cta', { n: list.length })} onPress={go} />
        </View>
      }
    >
      <View style={{ gap: 18, paddingTop: 2 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('matches.count', { n: v.studioCount, m: list.length })}</Eyebrow>
          <Title size={h1}>{t('matches.h1', { count: list.length === 3 ? t('matches.three') : t('matches.studios', { n: list.length }) })}</Title>
        </View>

        <Rise delay={160}>{tierSwitch}</Rise>
        <Text style={styles.note}>
          {chose && shown !== own
            ? t('matches.if', { chose, tier: TIER[toBriefTier(shown)].label, range: words })
            : t('matches.best', { tier: TIER[toBriefTier(shown)].label, range: words })}
        </Text>
        {v.ratesReal === false ? <Meta>{t('matches.rates')}</Meta> : null}

        <View>
          {list.map((m, i) => (
            <Stagger key={`${shown}-${m.slug}`} i={i} start={220}>
              <MatchCard m={m} top={i === 0} />
            </Stagger>
          ))}
        </View>

        <Press onPress={() => router.push('/journey/studios' as Href)} accessibilityRole="link" accessibilityLabel={`${t('matches.all', { n: v.studioCount })}. ${t('matches.all.sub')}`} style={styles.all}>
          <Text style={styles.allText}>{t('matches.all', { n: v.studioCount })}</Text>
          <ArrowIcon color={color.ink} size={16} />
        </Press>
      </View>
    </Screen>
  );
}

function MatchCard({ m, top }: { m: ApiMatch; top: boolean }) {
  const t = useT();
  const line = [m.area, m.since ? t('studio.since', { year: m.since }) : null].filter(Boolean).join(' · ');
  // The first card says why at length; the others give their one best reason (as the website does).
  const reasons = m.reasons.slice(0, top ? 3 : 1);
  return (
    <Press
      onPress={() => router.push(`/journey/studio/${encodeURIComponent(m.slug)}` as Href)}
      accessibilityRole="link"
      accessibilityLabel={t('matches.open', { name: m.name, score: Math.round(m.score) })}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <CountUp value={Math.round(m.score)} style={styles.score} duration={1200} />
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <Text role="heading" style={styles.name}>
            {m.name}
          </Text>
          {line ? <Text style={styles.line}>{line}</Text> : null}
          <Text style={styles.range}>{t('matches.range', { range: lakhRange(m.quote.lowPaise, m.quote.highPaise) })}</Text>
        </View>
        <ChevronIcon color={color.ink3} />
      </View>
      <View style={styles.chips}>
        <ChecksChip label={t('matches.checks', { a: m.checks.passed, b: m.checks.total })} />
        <RingChip label={m.lateness ?? t('matches.noData')} />
      </View>
      {reasons.length > 0 ? (
        top ? (
          <View style={styles.why}>
            <Text style={styles.whyLabel}>{t('matches.why')}</Text>
            <Reasons items={reasons} />
          </View>
        ) : (
          <Reasons items={reasons} />
        )
      ) : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  edit: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  editText: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  note: { ...type.body, fontSize: 14, lineHeight: 21, color: color.ink2, backgroundColor: color.soft, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden' },
  card: { borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 18, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: { width: 64, fontFamily: font.sansMedium, fontSize: 46, lineHeight: 48, letterSpacing: 46 * -0.05, color: color.ink, fontVariant: ['tabular-nums'] },
  name: { fontFamily: font.sansMedium, fontSize: 21, letterSpacing: 21 * -0.03, color: color.ink },
  line: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  range: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  why: { backgroundColor: color.soft, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  whyLabel: { fontFamily: font.sansSemi, fontSize: 13, color: color.accent },
  all: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  allText: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
});
