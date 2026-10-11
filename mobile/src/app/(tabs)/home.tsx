import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoinChip } from '../../components/brand';
import { KenBurns, LightPill, RefreshChip, StageTrack, type TrackStage } from '../../components/home/hero';
import { ArrowMark, BellMark } from '../../components/home/marks';
import { Body, Button, DarkCard, Eyebrow, Loading, Press, Rise, StatusChip, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayLabel, inr, timeLabel } from '../../lib/format';
import { useHeadline, useLang, useT, type Key, type T } from '../../lib/i18n';
import { daysLate } from '../../lib/progress';
import { useProfile } from '../../lib/profile';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import type { Decision, Stage, Update } from '../../lib/types';

/**
 * Home after signing (Main.dc.html, screen 21): the site photo with the
 * coin balance and the bell, stage status and overall status side by side,
 * the stage track; then the one decision due, today on site and the next
 * payment. The weekly challenge, Home of the month and the society circle
 * in the design are v1.1 and left out until the server has them.
 */
export default function Home() {
  const t = useT();
  const { lang } = useLang();
  const h1Size = useHeadline(40);
  const insets = useSafeAreaInsets();
  const { state: auth } = useAuth();
  const { state, refresh, refreshing } = useProject();
  const { profile, refresh: refreshProfile } = useProfile();
  const [unread, setUnread] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const [shown, setShown] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void api.notifications().then((r) => r.ok && setUnread(r.data.unread));
    }, []),
  );

  const onRefresh = () => {
    void refresh().then(() => setShown((n) => n + 1));
    void refreshProfile();
    void api.notifications().then((r) => r.ok && setUnread(r.data.unread));
  };

  if (state.status === 'loading') return <Loading />;
  const name = auth.status === 'signed-in' ? (auth.user.name ?? '').trim().split(' ')[0] : '';
  const newCount = unread ?? profile.unread;

  if (state.status === 'none') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
          <View style={[styles.header, { justifyContent: 'flex-end' }]}>
            <Bell count={newCount} t={t} light={false} />
          </View>
          <Title size={h1Size}>{name ? t('home.welcome.name', { name }) : t('home.welcome')}</Title>
          <Body muted>{t('home.none.body')}</Body>
          <Button label={t('welcome.cta')} onPress={() => router.push('/journey/name')} />
          <Button label={t('home.none.geio')} variant="ghost" onPress={() => router.push('/geio')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const p = state.project;
  const latest = p.updates[0] ?? null;
  const stage = p.stages.find((s) => s.state === 'now') ?? null;
  const decision = pickDecision(p.decisions);
  const late = (p as { overallLateDays?: number }).overallLateDays ?? daysLate(p.stages, now);
  const stageName = (s: Stage) => shortStage(s, lang, t);
  const stageChip = stage
    ? t(stage.late ? 'home.status.late' : 'home.status.onTrack', { stage: stageName(stage) })
    : t('home.status.done');
  const overall = late > 0 ? (late === 1 ? t('home.overall.late1') : t('home.overall.late', { n: late })) : t('home.overall.onTime');
  const nextPay = p.money?.next ?? null;
  const track: TrackStage[] = p.stages.map((s) => ({ key: s.key, name: stageName(s), state: s.state }));
  const place = profile.home?.label ?? t('home.with', { studio: p.studio });
  const today = latest ? sameDay(latest.at, now) : false;
  const family = p.role === 'family';

  const openDecision = (d: Decision) =>
    family
      ? router.push({ pathname: '/web', params: { path: `/app/decision?id=${d.id}`, title: t('home.decision.vote') } })
      : router.push({ pathname: '/decision/[id]', params: { id: d.id } });

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.white} progressViewOffset={insets.top} />}>
        <View style={[styles.hero, { minHeight: 360 + insets.top }]}>
          <KenBurns source={latest?.photos[0] ? { uri: latest.photos[0] } : require('../../../assets/app/home-hero.webp')} label={latest?.note} />
          <LinearGradient
            colors={['rgba(11,11,11,.55)', 'rgba(11,11,11,.1)', 'rgba(11,11,11,.4)', 'rgba(11,11,11,.92)']}
            locations={[0, 0.35, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          {latest ? <RefreshChip key={`${latest.id}-${shown}`} text={updatedLine(latest, now, t)} top={insets.top + 70} /> : null}
          <View style={[styles.heroInner, { paddingTop: insets.top + 16 }]}>
            <View style={styles.header}>
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {profile.coins.balance > 0 ? <CoinChip balance={profile.coins.balance} onPress={() => router.push('/me')} /> : null}
                <Bell count={newCount} t={t} light />
              </View>
            </View>
            <View style={{ gap: 16, marginTop: 40 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <StatusChip tone={stage?.late ? 'late' : 'ok'} label={stageChip} />
                  <StatusChip tone={late > 0 ? 'late' : 'ok'} label={overall} />
                </View>
                <Rise>
                  <Text role="heading" style={[styles.h1, { fontSize: h1Size, lineHeight: Math.round(h1Size * (lang === 'en' ? 0.98 : 1.2)), letterSpacing: h1Size * -0.045 }]}>
                    {name ? t('home.h1.name', { name }) : t('home.h1')}
                  </Text>
                </Rise>
              </View>
              <StageTrack stages={track} onPress={() => router.push('/project')} label={`${t('home.track')}. ${stageChip}. ${overall}.`} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {state.stale && state.error ? <Body muted style={{ fontSize: 14 }}>{t('home.stale', { error: state.error })}</Body> : null}

          {decision ? (
            <Rise delay={200}>
              <DarkCard style={{ gap: 12 }}>
                <Eyebrow onDark>{t(decision.state === 'overdue' ? 'home.decision.overdue' : 'home.decision.due', { date: dayLabel(decision.dueOn) })}</Eyebrow>
                <Text style={styles.cardTitle}>{decision.title}</Text>
                {decision.why ? <Text style={styles.cardBody}>{decision.why}</Text> : null}
                <LightPill label={t(family ? 'home.decision.vote' : 'home.decision.cta')} onPress={() => openDecision(decision)} />
              </DarkCard>
            </Rise>
          ) : null}

          <Rise delay={280} style={{ gap: 12 }}>
            <View style={styles.sectionHead}>
              <Text role="heading" style={styles.h2}>
                {t(today ? 'home.site.today' : 'home.site.latest')}
              </Text>
              {latest ? <Eyebrow>{dayLabel(latest.at)}</Eyebrow> : null}
            </View>
            {latest ? (
              <>
                {latest.photos.length ? (
                  <Press onPress={() => router.push('/site')} haptic={false} accessibilityRole="link" accessibilityLabel={t('home.site.all')} style={styles.photos}>
                    {[0, 1, 2].map((i) =>
                      latest.photos[i] ? (
                        <Image
                          key={i}
                          source={{ uri: latest.photos[i] }}
                          style={styles.thumb}
                          contentFit="cover"
                          transition={300}
                          accessibilityLabel={t('home.site.photo', { n: i + 1 })}
                        />
                      ) : (
                        <View key={i} style={{ flex: 1 }} />
                      ),
                    )}
                  </Press>
                ) : null}
                <Text style={styles.note}>{latest.note}</Text>
              </>
            ) : (
              <Body muted>{t('home.site.empty', { studio: p.studio })}</Body>
            )}
            <Press onPress={() => router.push('/site')} haptic={false} accessibilityRole="link" style={styles.more}>
              <Eyebrow style={{ color: color.ink }}>{t('home.site.all')}</Eyebrow>
              <ArrowMark color={color.ink} />
            </Press>
          </Rise>

          {nextPay ? (
            <Rise delay={340}>
              <Press onPress={() => router.push('/project')} haptic={false} accessibilityRole="link" style={styles.pay}>
                <View style={styles.payRow}>
                  <Text style={styles.payTitle}>{t('home.pay.title')}</Text>
                  <Text style={styles.payAmt}>{inr(nextPay.amountPaise)}</Text>
                </View>
                <Text style={styles.payBody}>{t('home.pay.body', { studio: p.studio, when: lowerFirst(nextPay.label) })}</Text>
              </Press>
            </Rise>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** The bell, with a terracotta dot while anything is unread. */
function Bell({ count, t, light }: { count: number; t: T; light: boolean }) {
  return (
    <Press
      onPress={() => router.push('/notifications')}
      accessibilityLabel={count > 0 ? t('home.bell.new', { n: count }) : t('me.notifications')}
      style={[styles.bell, { backgroundColor: light ? 'rgba(255,255,255,.16)' : color.soft }]}
    >
      <BellMark color={light ? color.white : color.ink} />
      {count > 0 ? <View style={styles.badge} /> : null}
    </Press>
  );
}

/** The decision most worth the customer's attention: overdue first, then the soonest due. */
function pickDecision(list: Decision[]): Decision | null {
  const rank = { overdue: 0, 'due-soon': 1, open: 2, chosen: 3 } as const;
  const open = list.filter((d) => d.state !== 'chosen');
  open.sort((a, b) => rank[a.state] - rank[b.state] || Date.parse(a.dueOn) - Date.parse(b.dueOn));
  return open[0] ?? null;
}

/**
 * A stage's name short enough for the track: the studio's own one-word
 * label in English ("Carpentry"), else the standard name for its key.
 */
function shortStage(s: Stage, lang: string, t: T): string {
  if (lang === 'en' && s.label.length <= 10) return s.label;
  const key = `home.stage.${s.key}` as Key;
  const name = t(key);
  return name === key ? s.label : name;
}

function updatedLine(u: Update, now: number, t: T): string {
  const ago = now - Date.parse(u.at);
  if (ago >= 0 && ago < 60 * 60_000) return t('home.updated.now');
  return sameDay(u.at, now) ? t('home.updated.today', { time: timeLabel(u.at) }) : t('home.updated.day', { day: dayLabel(u.at) });
}

const istDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const sameDay = (iso: string, now: number) => istDay(Date.parse(iso)) === istDay(now);
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

const styles = StyleSheet.create({
  hero: { backgroundColor: color.ink, overflow: 'hidden' },
  heroInner: { flex: 1, paddingHorizontal: 20, paddingBottom: 22, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  place: { flexShrink: 1, fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: color.accentWarm },
  h1: { fontFamily: font.sansMedium, color: color.white },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 22 },
  cardTitle: { fontFamily: font.sansMedium, fontSize: 24, lineHeight: 25, letterSpacing: 24 * -0.035, color: color.onDark },
  cardBody: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 22, color: color.onDark2 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    paddingBottom: 10,
  },
  h2: { flexShrink: 1, fontFamily: font.sansMedium, fontSize: 22, letterSpacing: 22 * -0.03, color: color.ink },
  photos: { flexDirection: 'row', gap: 6 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: color.soft },
  note: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink },
  more: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pay: { borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 16, gap: 4 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 },
  payTitle: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  payAmt: { fontFamily: font.mono, fontSize: 15, color: color.ink },
  payBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
});
