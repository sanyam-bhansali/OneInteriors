import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CoinToast } from '../../components/brand';
import { dayIso, timeline, week, type DayGroup } from '../../components/site/days';
import { CubeIcon, SmallPill } from '../../components/site/parts';
import { Body, DarkCard, Eyebrow, Loading, Meta, Rise, Screen, Stagger, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { dayLabel, timeLabel } from '../../lib/format';
import { useHeadline, useT, type T } from '../../lib/i18n';
import { useProfile } from '../../lib/profile';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT, type Project } from '../../lib/types';

/**
 * On site (Feed.dc.html, screen 25): every working day, newest first. This
 * week as a Monday-to-Saturday strip, the latest day's photos and note in
 * full, and any working day this week with no update posted. "View in 3D"
 * only for full-home orders (FLOWS.md). The timelapse card is v1.1.
 */
export default function Site() {
  const t = useT();
  const size = useHeadline(42);
  const { state, refresh, refreshing } = useProject();
  const { profile } = useProfile();
  const [earned, setEarned] = useState(0);
  const ready = state.status === 'ready';
  useEffect(() => {
    // Opening the day's update earns its Home Coins, once a day.
    if (ready) void api.openedUpdate().then((r) => r.ok && setEarned(r.data.earned));
  }, [ready]);

  const project = state.status === 'ready' ? state.project : null;
  const strip = useMemo(() => week(project?.updates ?? []), [project]);
  const items = useMemo(
    () => timeline(project?.updates ?? [], strip.days.filter((d) => d.state === 'missed').map((d) => d.n)),
    [project, strip],
  );

  if (state.status === 'loading') return <Loading />;

  const header = (
    <Rise style={{ gap: 8 }}>
      <Eyebrow>{t('site.eyebrow')}</Eyebrow>
      <View style={styles.titleRow}>
        <Title size={size}>
          {t('site.h1')}
        </Title>
        {profile.home?.fullHome ? (
          <SmallPill
            label={t('site.view3d')}
            icon={<CubeIcon color={color.onDark} />}
            onPress={() => router.push({ pathname: '/web', params: { path: '/app/3d', title: '3D' } })}
          />
        ) : null}
      </View>
    </Rise>
  );

  if (!project) {
    return (
      <Screen>
        <View style={styles.body}>
          {header}
          <Body muted>{t('site.none')}</Body>
        </View>
      </Screen>
    );
  }

  const latest = items.findIndex((i) => i.kind === 'day');
  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
        <View style={styles.body}>
          {header}
          {state.status === 'ready' && state.stale && state.error ? <Meta>{t('site.stale')}</Meta> : null}

          <Rise delay={120} style={styles.week}>
            <View style={styles.weekHead}>
              <Text style={styles.weekTitle}>{t('site.week')}</Text>
              {strip.counted ? <Text style={styles.mono}>{t('site.week.count', { n: strip.worked, m: strip.counted })}</Text> : null}
            </View>
            <View style={styles.strip}>
              {strip.days.map((d, i) => {
                const name = t(`site.day.${d.key}`);
                const when = dayLabel(dayIso(d.n));
                const a11y =
                  d.state === 'done'
                    ? t('site.day.a11y.done', { day: when })
                    : d.state === 'missed'
                      ? t('site.day.a11y.missed', { day: when })
                      : d.state === 'today'
                        ? t('site.day.a11y.today', { day: when })
                        : d.state === 'later'
                          ? t('site.day.a11y.later', { day: when })
                          : when;
                return (
                  <Stagger key={d.key} i={i} start={180} style={styles.stripDay}>
                    <View accessible accessibilityLabel={a11y} style={{ width: '100%', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.bar, { backgroundColor: d.state === 'done' ? color.ink : d.state === 'missed' ? color.accent : color.line }]} />
                      <Text
                        style={[
                          styles.dayName,
                          { color: d.state === 'missed' ? color.accentInk : d.isToday ? color.ink : d.state === 'done' ? color.ink2 : color.ink3 },
                        ]}
                      >
                        {name}
                      </Text>
                    </View>
                  </Stagger>
                );
              })}
            </View>
          </Rise>

          {items.length === 0 ? <Body muted>{t('site.empty', { studio: project.studio })}</Body> : null}

          {items.map((item, i) =>
            item.kind === 'gap' ? (
              <Stagger key={`gap-${item.n}`} i={Math.min(i, 4)} start={240}>
                <DarkCard style={{ borderRadius: 18, padding: 18, gap: 8 }}>
                  <Eyebrow onDark>{t('site.gap.title', { date: dayLabel(dayIso(item.n)) })}</Eyebrow>
                  <Text style={styles.gapBody}>{t('site.gap.body', { studio: project.studio })}</Text>
                </DarkCard>
              </Stagger>
            ) : (
              <Stagger key={`day-${item.n}`} i={Math.min(i, 4)} start={240}>
                <Day group={item} project={project} lead={i === latest} today={strip.today} t={t} />
              </Stagger>
            ),
          )}
        </View>
      </Screen>
      {earned ? <CoinToast amount={earned} onDone={() => setEarned(0)} /> : null}
    </View>
  );
}

/** One day's updates: the latest day large, older days compact. */
function Day({ group, project, lead, today, t }: { group: DayGroup; project: Project; lead: boolean; today: number; t: T }) {
  const first = group.updates[0];
  const date = dayLabel(first.at);
  const isToday = group.n === today;
  const photos = group.updates.flatMap((u) => u.photos);
  const [hero, ...rest] = lead ? photos : [];
  const grid = lead ? rest : photos;
  const alt = t('site.photo', { date });
  const stages = [...new Set(group.updates.map((u) => u.stage).filter((s): s is string => !!s))];
  return (
    <View style={[styles.day, !lead && styles.dayRule]}>
      <View style={styles.dayHead}>
        <Text role="heading" style={styles.h2}>
          {isToday ? t('site.today', { date }) : date}
        </Text>
        <Text style={styles.mono}>{timeLabel(first.at)}</Text>
      </View>
      {hero ? <Image source={{ uri: hero }} accessibilityLabel={alt} style={styles.hero} contentFit="cover" transition={300} /> : null}
      {grid.length ? (
        <View style={styles.grid}>
          {grid.map((uri, i) => (
            <Image key={`${uri}-${i}`} source={{ uri }} accessibilityLabel={alt} style={styles.small} contentFit="cover" transition={300} />
          ))}
        </View>
      ) : null}
      {group.updates.map((u) => (
        <Text key={u.id} style={styles.note}>
          {u.note}
        </Text>
      ))}
      <View style={styles.chips}>
        <Text style={styles.chip}>{first.byStudio ? t('site.by.studio', { studio: project.studio }) : t('site.by.us')}</Text>
        {stages.map((s) => (
          <Text key={s} style={styles.chip}>
            {STAGE_SHORT[s] ?? s}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 22, paddingTop: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  week: { gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.line, paddingVertical: 14 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  weekTitle: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
  strip: { flexDirection: 'row', gap: 6 },
  stripDay: { flex: 1 },
  bar: { width: '100%', height: 4, borderRadius: 2 },
  dayName: { fontFamily: font.mono, fontSize: 13 },
  mono: { fontFamily: font.mono, fontSize: 13, color: color.ink2 },
  gapBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 22.5, color: '#D6D4CE' },
  day: { gap: 12 },
  dayRule: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 16, gap: 10 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  h2: { flexShrink: 1, fontFamily: font.sansMedium, fontSize: 22, letterSpacing: 22 * -0.03, color: color.ink },
  hero: { width: '100%', height: 200, borderRadius: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  small: { width: '48.9%', flexGrow: 1, height: 110, borderRadius: 12 },
  note: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontFamily: font.mono,
    fontSize: 13,
    color: color.ink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(11,11,11,.18)',
    overflow: 'hidden',
  },
});
