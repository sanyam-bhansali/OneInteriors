import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBack, styles as quiz } from '../../../components/journey/parts';
import { HeartIcon, Reasons, ShieldIcon, TickIcon } from '../../../components/journey/studio-parts';
import { BackIcon } from '../../../components/icons';
import { Body, Button, ErrorText, Loading, Meta, Press, Rise, Screen, Title } from '../../../components/ui';
import { useBrief } from '../../../lib/brief';
import { useHeadline, useT } from '../../../lib/i18n';
import { matchesApi, type StudioProfile } from '../../../lib/journey/matches';
import { useMatches } from '../../../lib/journey/matches-hook';
import type { StudioCard } from '../../../lib/journey/types';
import { useReducedMotion } from '../../../lib/motion';
import { color, font, motion, type } from '../../../lib/theme';

/**
 * #17 Studio profile (designs/Studio.dc.html; website
 * src/app/app/studios/[slug]): a photo header, "Verified by One Interiors"
 * when they are, the score on this brief, why they suit you, and four tabs:
 * Past homes, Checks, Delivery record, Reviews.
 *
 * Every number is the studio's real record or says it has none. Reviews
 * come only from customers whose project went through One Interiors, so
 * until there are some the tab says so; there is no rating tile without
 * one. The heart keeps the studio on this phone only (no server list yet).
 */

type Tab = 'homes' | 'checks' | 'record' | 'reviews';
const TABS: Tab[] = ['homes', 'checks', 'record', 'reviews'];
const SAVED = 'oi.saved.studios';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

type Load = { status: 'loading' } | { status: 'ready'; studio: StudioProfile } | { status: 'missing' } | { status: 'error'; error: string };

export default function StudioScreen() {
  const t = useT();
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { brief, ready } = useBrief();
  const { state: matches } = useMatches();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>('homes');
  const [saved, setSaved] = useState(false);
  const [listed, setListed] = useState<StudioCard | null>(null);

  useEffect(() => {
    let live = true;
    void matchesApi.studio(slug).then((res) => {
      if (!live) return;
      if (res.ok && res.data.studio) setLoad({ status: 'ready', studio: res.data.studio });
      else if (res.ok || res.status === 404) setLoad({ status: 'missing' });
      else setLoad({ status: 'error', error: res.error });
    });
    return () => {
      live = false;
    };
  }, [slug, attempt]);

  useEffect(() => {
    void AsyncStorage.getItem(SAVED)
      .then((raw) => setSaved((JSON.parse(raw ?? '[]') as string[]).includes(slug)))
      .catch(() => {});
  }, [slug]);

  // The score and reasons on this brief: from the matches when they include this studio, else from the full list.
  const matched = useMemo(() => {
    if (matches.status !== 'ready') return null;
    const all = [...matches.view.tiers.essential, ...matches.view.tiers.premium, ...matches.view.tiers.luxury];
    return all.find((m) => m.slug === slug) ?? null;
  }, [matches, slug]);
  useEffect(() => {
    if (matched || !ready || !brief.completedAt) return;
    let live = true;
    void matchesApi.studios(brief).then((res) => {
      if (live && res.ok) setListed(res.data.studios.find((s) => s.slug === slug) ?? null);
    });
    return () => {
      live = false;
    };
  }, [matched, ready, brief, slug]);
  const card: StudioCard | null = matched ?? listed;

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    void AsyncStorage.getItem(SAVED)
      .then((raw) => {
        const list = (JSON.parse(raw ?? '[]') as string[]).filter((s) => s !== slug);
        return AsyncStorage.setItem(SAVED, JSON.stringify(next ? [...list, slug] : list));
      })
      .catch(() => {});
  };

  if (load.status === 'loading') return <Loading />;
  if (load.status === 'missing' || load.status === 'error') {
    const missing = load.status === 'missing';
    const header = (
      <View style={quiz.head}>
        <Press onPress={() => goBack('/journey/studios' as Href)} accessibilityLabel={t('kit.back')} style={quiz.back}>
          <BackIcon color={color.ink} />
        </Press>
      </View>
    );
    return (
      <Screen
        header={header}
        footer={
          missing ? (
            <Button label={t('studio.missing.cta')} onPress={() => router.replace('/journey/studios' as Href)} />
          ) : (
            <Button label={t('matches.retry')} onPress={() => setAttempt((n) => n + 1)} />
          )
        }
      >
        {missing ? (
          <View style={{ gap: 14 }}>
            <Title size={34}>{t('studio.missing.h1')}</Title>
            <Body muted>{t('studio.missing.sub')}</Body>
          </View>
        ) : (
          <ErrorText>{load.error}</ErrorText>
        )}
      </Screen>
    );
  }

  return (
    <Profile
      s={load.studio}
      card={card}
      tab={tab}
      setTab={setTab}
      saved={saved}
      toggleSave={toggleSave}
      cta={brief.completedAt ? { label: t('studio.cta', { name: load.studio.name }), to: '/journey/phone' } : { label: t('studio.start'), to: '/journey/name' }}
    />
  );
}

function Profile({
  s,
  card,
  tab,
  setTab,
  saved,
  toggleSave,
  cta,
}: {
  s: StudioProfile;
  card: StudioCard | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  saved: boolean;
  toggleSave: () => void;
  cta: { label: string; to: string };
}) {
  const t = useT();
  const h1 = useHeadline(36);
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const [ken] = useState(() => new Animated.Value(still ? 1 : 1.12));
  useEffect(() => {
    if (still) return ken.setValue(1);
    Animated.timing(ken, { toValue: 1, duration: 18000, easing: motion.glide, useNativeDriver: true }).start();
  }, [ken, still]);

  const cover = s.photo ?? s.portfolio[0]?.photo ?? null;
  const meta = [s.area, s.since ? t('studio.since', { year: s.since }) : null, s.team ? t('studio.team', { n: s.team }) : null].filter(Boolean).join(' · ');
  const passed = s.checks.filter((c) => c.passed);
  const score = card?.score ?? null;
  const reasons = card?.reasons ?? [];
  const tabName: Record<Tab, string> = {
    homes: t('studio.tab.homes'),
    checks: t('studio.tab.checks'),
    record: t('studio.tab.record'),
    reviews: t('studio.tab.reviews'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView stickyHeaderIndices={[3]} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 0: the photo header */}
        <View style={[styles.hero, { height: 300 + insets.top }]}>
          {cover ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: ken }] }]}>
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={t('studio.homes.work', { name: s.name })} />
            </Animated.View>
          ) : null}
          <LinearGradient colors={['rgba(11,11,11,.5)', 'rgba(11,11,11,0)', 'rgba(11,11,11,.85)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroInner, { paddingTop: insets.top + 12 }]}>
            <View style={styles.heroTop}>
              <Press onPress={() => goBack('/journey/matches' as Href)} accessibilityLabel={t('kit.back')} style={styles.round}>
                <BackIcon color={color.white} size={20} />
              </Press>
              <Pressable
                onPress={toggleSave}
                role="switch"
                aria-checked={saved}
                aria-label={t('studio.save')}
                style={styles.round}
              >
                <HeartIcon color={saved ? color.accentWarm : color.white} filled={saved} />
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              {s.verified ? (
                <View style={styles.verified}>
                  <ShieldIcon color={color.white} />
                  <Text style={styles.verifiedText}>{t('studio.verified')}</Text>
                </View>
              ) : null}
              <Title size={h1} style={{ color: color.white }}>
                {s.name}
              </Title>
              {meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
              {saved ? <Text style={styles.heroMeta}>{t('studio.saved')}</Text> : null}
            </View>
          </View>
        </View>

        {/* 1: the tiles */}
        <Rise delay={120} style={styles.tiles}>
          <StatTile
            tint={color.peach}
            value={score !== null ? String(Math.round(score)) : '—'}
            valueColor={score !== null ? color.accent : color.ink3}
            label={score !== null ? t('studio.tile.match') : t('studio.tile.unscored')}
          />
          {card?.rating ? (
            <StatTile tint={color.lilac} value={`${card.rating.stars.toFixed(1)} ★`} label={t('studio.tile.reviews', { n: card.rating.count })} />
          ) : (
            <StatTile tint={color.lilac} value={`${passed.length}/${s.checks.length}`} label={t('studio.tile.checks')} />
          )}
          <StatTile tint={color.mint} value={String(s.delivery.completed)} label={t('studio.tile.homes')} />
        </Rise>

        {/* 2: why they suit you */}
        <View>
          {reasons.length > 0 ? (
            <Rise delay={200} style={styles.why}>
              <Text style={styles.whyLabel}>{t('matches.why')}</Text>
              <Reasons items={reasons} />
            </Rise>
          ) : null}
        </View>

        {/* 3: the tabs, which stay at the top as the page scrolls */}
        <View style={styles.tabsWrap}>
          {/* Four tabs do not fit 375 px in every language, so the row scrolls sideways. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} role="tablist" aria-label={t('studio.tabs')}>
            {TABS.map((k) => {
              const sel = k === tab;
              return (
                <Pressable key={k} role="tab" aria-selected={sel} aria-label={tabName[k]} onPress={() => setTab(k)} style={[styles.tab, sel && styles.tabOn]}>
                  <Text style={[styles.tabText, sel && { color: color.ink }]}>{tabName[k]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 4: the chosen tab */}
        <View role="tabpanel" aria-label={tabName[tab]} style={styles.panel}>
          {tab === 'homes' ? <Homes s={s} /> : null}
          {tab === 'checks' ? <Checks s={s} /> : null}
          {tab === 'record' ? <Record s={s} /> : null}
          {tab === 'reviews' ? <Reviews s={s} /> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <Button label={cta.label} onPress={() => router.push(cta.to as Href)} />
      </View>
    </View>
  );
}

function StatTile({ tint, value, label, valueColor }: { tint: string; value: string; label: string; valueColor?: string }) {
  return (
    <View accessible aria-label={`${value}, ${label}`} style={[styles.tile, { backgroundColor: tint }]}>
      <Text style={[styles.tileValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Homes({ s }: { s: StudioProfile }) {
  const t = useT();
  if (s.portfolio.length === 0) return <Meta>{t('studio.homes.none')}</Meta>;
  return (
    <View style={{ gap: 22 }}>
      {s.portfolio.map((p, i) => (
        <View key={`${p.photo}-${i}`} style={{ gap: 10 }}>
          <View>
            <Image
              source={{ uri: p.photo }}
              style={styles.homePic}
              contentFit="cover"
              transition={200}
              accessibilityLabel={p.caption ? t('studio.homes.alt', { caption: p.caption, name: s.name }) : t('studio.homes.work', { name: s.name })}
            />
            {p.isRender ? (
              <View style={styles.renderTag}>
                <Text style={styles.renderText}>{t('studio.render')}</Text>
              </View>
            ) : null}
          </View>
          {p.caption ? <Text style={styles.homeTitle}>{p.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Checks({ s }: { s: StudioProfile }) {
  const t = useT();
  const passed = s.checks.filter((c) => c.passed);
  const last = passed
    .map((c) => c.checkedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  return (
    <View style={{ gap: 6 }}>
      <Text role="heading" style={styles.panelH}>
        {t('studio.checks.h', { a: passed.length, b: s.checks.length })}
      </Text>
      <Text style={styles.panelSub}>{[last ? t('studio.checks.last', { date: day(last) }) : null, t('studio.checks.sub')].filter(Boolean).join(' ')}</Text>
      <View style={{ marginTop: 8 }}>
        {s.checks.map((c) => (
          <View key={c.label} accessible aria-label={`${c.label}. ${c.passed ? t('studio.check.passed') : t('studio.check.pending')}`} style={styles.checkRow}>
            <View style={[styles.checkDot, !c.passed && { backgroundColor: color.soft }]}>
              {c.passed ? <TickIcon color={color.ok} /> : <Text style={styles.pending}>…</Text>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.checkLabel}>{c.label}</Text>
              <Text style={styles.panelSub}>
                {c.passed ? [c.source, c.checkedAt ? day(c.checkedAt) : null].filter(Boolean).join(' · ') || t('studio.check.passed') : t('studio.check.pending')}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Record({ s }: { s: StudioProfile }) {
  const t = useT();
  const d = s.delivery.avgLateDays;
  const head =
    d === null || s.delivery.completed === 0
      ? t('studio.record.none')
      : d <= 0
        ? t('studios.f.onTime')
        : d === 1
          ? t('studio.record.lateOne')
          : t('studio.record.late', { n: d });
  return (
    <View style={{ gap: 10 }}>
      <Text role="heading" style={styles.panelH}>
        {head}
      </Text>
      <View style={styles.recordCard}>
        <Text style={styles.whyLabel}>{t('studio.record.label')}</Text>
        {s.delivery.line ? <Text style={[type.body, { fontSize: 16, lineHeight: 24 }]}>{s.delivery.line}</Text> : null}
        <Text style={styles.panelSub}>{t('studio.record.note')}</Text>
      </View>
    </View>
  );
}

function Reviews({ s }: { s: StudioProfile }) {
  const t = useT();
  if (s.reviews.length === 0) {
    return (
      <View style={styles.recordCard}>
        <Text style={[type.body, { fontFamily: font.sansSemi, fontSize: 16 }]}>{t('studio.reviews.none')}</Text>
        <Text style={styles.panelSub}>{t('studio.reviews.sub')}</Text>
      </View>
    );
  }
  const avg = s.reviews.reduce((a, r) => a + r.stars, 0) / s.reviews.length;
  return (
    <View style={{ gap: 12 }}>
      <Text role="heading" style={styles.panelH}>
        {t('studio.reviews.h', { stars: avg.toFixed(1), n: s.reviews.length })}
      </Text>
      {s.reviews.map((r) => (
        <View key={`${r.name}-${r.at}`} style={styles.recordCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={styles.checkLabel}>{r.name}</Text>
            <Text style={[styles.panelSub, { color: color.ok }]}>{t('studio.reviews.verified')}</Text>
          </View>
          <Text style={styles.panelSub}>{`${r.stars} ★ · ${day(r.at)}`}</Text>
          <Text style={[type.body, { fontSize: 15, lineHeight: 22 }]}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: color.ink, overflow: 'hidden' },
  heroInner: { flex: 1, paddingHorizontal: 16, paddingBottom: 20, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,11,11,.45)', alignItems: 'center', justifyContent: 'center' },
  verified: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#BA5329',
  },
  verifiedText: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  heroMeta: { fontFamily: font.sans, fontSize: 15, color: 'rgba(255,255,255,.85)' },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  tile: { flex: 1, minHeight: 88, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, justifyContent: 'space-between', gap: 4 },
  tileValue: { fontFamily: font.sansMedium, fontSize: 26, letterSpacing: -1.04, color: color.ink },
  tileLabel: { fontFamily: font.sans, fontSize: 13, lineHeight: 17, color: color.ink2 },
  why: { marginHorizontal: 20, marginTop: 10, backgroundColor: color.soft, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  whyLabel: { fontFamily: font.sansSemi, fontSize: 13, color: color.accent },
  tabsWrap: { backgroundColor: color.paper, marginTop: 18, borderBottomWidth: 1, borderBottomColor: color.line },
  tabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 20 },
  tab: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: color.accent },
  tabText: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink3 },
  panel: { paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  panelH: { fontFamily: font.sansMedium, fontSize: 20, letterSpacing: -0.4, color: color.ink },
  panelSub: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.ink2 },
  homePic: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  renderTag: { position: 'absolute', left: 12, top: 12, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: color.white },
  renderText: { fontFamily: font.sansSemi, fontSize: 13, color: color.accent },
  homeTitle: { fontFamily: font.sansSemi, fontSize: 17, letterSpacing: -0.34, color: color.ink },
  checkRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: color.line },
  checkDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E3EDE5', alignItems: 'center', justifyContent: 'center' },
  pending: { fontFamily: font.sansSemi, fontSize: 13, color: color.ink3 },
  checkLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  recordCard: { backgroundColor: color.soft, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.paper },
});

