import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowIcon, BellIcon } from '../../components/icons';
import { Body, Button, DarkCard, Loading, Meta, Press, Rise, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayLabel, inr, shortDate, timeLabel } from '../../lib/format';
import { dayOf, daysLate } from '../../lib/progress';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT } from '../../lib/types';

/** Home, build stage (the v1 design): where the flat is, the one decision due, and the latest from site. */
export default function Home() {
  const { state: auth } = useAuth();
  const { state, refresh, refreshing } = useProject();
  const [unread, setUnread] = useState(0);
  const [now] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      void api.notifications().then((r) => r.ok && setUnread(r.data.unread));
    }, []),
  );

  if (state.status === 'loading') return <Loading />;
  const name = auth.status === 'signed-in' ? (auth.user.name ?? '').split(' ')[0] : '';

  if (state.status === 'none') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 18 }}>
          <Header unread={unread} />
          <Title>{name ? `Welcome, ${name}.` : 'Welcome.'}</Title>
          <Body muted>
            Your project appears here the day you sign with a studio: every site update, the decisions you need to make, and
            the snag list, with a notification each time something happens.
          </Body>
          <Button label="Find your designer" onPress={() => router.push({ pathname: '/web', params: { path: '/app/name', title: 'Your brief' } })} />
          <Button label="Ask GEIO" variant="ghost" onPress={() => router.push({ pathname: '/web', params: { path: '/app/geio', title: 'GEIO' } })} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const p = state.project;
  const latest = p.updates[0] ?? null;
  const nowIndex = p.stages.findIndex((s) => s.state === 'now');
  const stage = nowIndex >= 0 ? p.stages[nowIndex] : null;
  const { day, of } = dayOf(p.startOn, p.stages, now);
  const decision = p.decisions.find((d) => d.state === 'due-soon' || d.state === 'open') ?? null;
  // The design's one delay message: the stage and the whole project, kept apart.
  const late = daysLate(p.stages, now);
  const stageStatus = stage ? `${STAGE_SHORT[stage.key] ?? stage.label} · ${stage.late ? 'running late' : 'on track'}` : 'Handed over';
  const overall = `Overall · ${late ? `${late} day${late === 1 ? '' : 's'} late` : 'on time'}`;
  const nextPay = p.money?.next ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} />}>
        <View style={styles.hero}>
          {latest?.photos[0] ? (
            <Image source={{ uri: latest.photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          ) : (
            <Image source={require('../../../assets/app/home-hero.webp')} style={StyleSheet.absoluteFill} contentFit="cover" />
          )}
          <LinearGradient
            colors={['rgba(14,14,13,.55)', 'rgba(14,14,13,.1)', 'rgba(14,14,13,.4)', 'rgba(14,14,13,.92)']}
            locations={[0, 0.35, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <Header unread={unread} light label={`With ${p.studio}`} />
            {latest ? (
              <Rise delay={400} style={styles.pill}>
                <Text style={styles.pillText}>Updated from site {dayLabel(latest.at)}, {timeLabel(latest.at)}</Text>
              </Rise>
            ) : null}
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Text style={styles.status} accessibilityLabel={`${stageStatus}, day ${day} of ${of}`}>
                {stageStatus}
              </Text>
              <Text style={[styles.status, late ? { color: color.gold } : null]}>{overall}</Text>
            </View>
            <Rise>
              <Text style={styles.h1}>Your home is coming together{name ? `, ${name}` : ''}.</Text>
            </Rise>
            <View style={styles.stages}>
              {p.stages.map((s) => (
                <View key={s.key} style={{ alignItems: 'center', flex: 1, gap: 8 }}>
                  <View style={[styles.dot, s.state === 'done' && styles.dotDone, s.state === 'now' && styles.dotNow]} />
                  <Text style={[styles.stageText, s.state === 'now' && { color: color.white }]} numberOfLines={1}>
                    {STAGE_SHORT[s.key] ?? s.label}
                  </Text>
                </View>
              ))}
            </View>
          </SafeAreaView>
        </View>

        <View style={{ padding: 22, gap: 18 }}>
          {state.stale && state.error ? <Body muted>Showing what was saved on this phone. {state.error}</Body> : null}
          {decision ? (
            <Rise delay={200}>
              <DarkCard>
                <Text style={styles.cardMeta}>Your decision, due {dayLabel(decision.dueOn)}</Text>
                <Text style={styles.cardTitle}>{decision.title}</Text>
                <Text style={styles.cardBody}>{decision.why}</Text>
                <Press onPress={() => router.push({ pathname: '/decision/[id]', params: { id: decision.id } })} style={styles.cardCta}>
                  <Text style={styles.cardCtaText}>Decide</Text>
                  <ArrowIcon color={color.white} />
                </Press>
              </DarkCard>
            </Rise>
          ) : null}

          {nextPay ? (
            <Press onPress={() => router.push('/project')} haptic={false} style={styles.payCard}>
              <Meta>Next payment{nextPay.dueOn ? `, due ${shortDate(nextPay.dueOn)}` : ''}</Meta>
              <Text style={styles.payAmt}>{inr(nextPay.amountPaise)}</Text>
              <Body muted style={{ fontSize: 14 }}>
                To {p.studio} for {nextPay.label.toLowerCase()}. You pay the studio directly; we keep track of it here.
              </Body>
            </Press>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.h2}>Latest from site</Text>
            {latest ? <Meta>{dayLabel(latest.at)}</Meta> : null}
          </View>
          {latest ? (
            <Press onPress={() => router.push('/site')} haptic={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {latest.photos.slice(0, 3).map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" transition={300} />
                ))}
              </View>
              <Body style={{ marginTop: 12 }}>{latest.note}</Body>
            </Press>
          ) : (
            <Body muted>The first update from {p.studio} appears here, and on your phone, as soon as it is posted.</Body>
          )}
          <Button label="Ask GEIO" variant="ghost" onPress={() => router.push({ pathname: '/web', params: { path: '/app/geio', title: 'GEIO' } })} />
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ unread, light = false, label }: { unread: number; light?: boolean; label?: string }) {
  const c = light ? color.white : color.ink;
  return (
    <View style={styles.header}>
      <Press onPress={() => router.push('/me')} haptic={false}>
        <Text style={[styles.headerLabel, { color: light ? 'rgba(255,255,255,.9)' : color.ink2 }]}>{label ?? 'One Interiors'}</Text>
      </Press>
      <Press onPress={() => router.push('/notifications')} style={[styles.bell, { backgroundColor: light ? 'rgba(255,255,255,.16)' : 'rgba(14,14,13,.06)' }]} accessibilityLabel="Notifications">
        <BellIcon color={c} />
        {unread > 0 ? <View style={styles.badge} /> : null}
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { fontFamily: font.mono, fontSize: 13.5, color: 'rgba(255,255,255,.85)' },
  payCard: { padding: 16, borderRadius: 18, backgroundColor: color.surface, gap: 4 },
  payAmt: { fontFamily: font.sansSemi, fontSize: 26, letterSpacing: -1, color: color.ink },
  hero: { height: 420, backgroundColor: color.dark, overflow: 'hidden' },
  heroInner: { flex: 1, paddingHorizontal: 20, paddingBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  headerLabel: { fontFamily: font.sansMedium, fontSize: 13 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: color.accentWarm },
  pill: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(14,14,13,.72)' },
  pillText: { fontFamily: font.mono, fontSize: 13, color: color.onDark, letterSpacing: 0.4 },
  h1: { fontFamily: font.sansSemi, fontSize: 40, lineHeight: 39, letterSpacing: -1.8, color: color.white, marginTop: 8 },
  stages: { flexDirection: 'row', marginTop: 16 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.dark, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.4)' },
  dotDone: { backgroundColor: color.accentWarm, borderColor: color.accentWarm },
  dotNow: { borderWidth: 2, borderColor: color.accentWarm },
  stageText: { fontFamily: font.sansMedium, fontSize: 13, color: 'rgba(255,255,255,.7)' },
  cardMeta: { fontFamily: font.sansMedium, fontSize: 13, color: '#f08a5d' },
  cardTitle: { fontFamily: font.sansBold, fontSize: 25, lineHeight: 27, letterSpacing: -0.8, color: color.white },
  cardBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,.75)' },
  cardCta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.accent, borderRadius: 999, paddingHorizontal: 22, minHeight: 48, marginTop: 6 },
  cardCtaText: { fontFamily: font.sansSemi, fontSize: 16, color: color.white },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line, paddingBottom: 10 },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 12 },
});
