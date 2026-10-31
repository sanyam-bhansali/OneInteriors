import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { blockerLine, stepLine } from '../project/lifecycle';
import { Button, DarkCard, Press } from '../ui';
import { BellIcon } from '../icons';
import { dayLabel } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT, type Lifecycle, type Project } from '../../lib/types';

/**
 * Home format C, "One thing at a time" (the owner's v1 screens; chosen 1 Nov
 * 2026), as on the website (app/app/home/OneThingHome.tsx). A studio client
 * usually has one thing waiting, so it goes first with one button: the
 * project lifecycle's blocker (portal/lifecycle-view.ts). With nothing
 * waiting, what the studio is doing. Then shortcuts, and the stages.
 */

/** Where the one thing is done. */
function go(kind: NonNullable<Lifecycle['blocker']>['kind'], p: Project) {
  if (kind === 'decide') {
    const d = p.decisions.find((x) => x.state === 'open' || x.state === 'due-soon');
    if (d) return router.push({ pathname: '/decision/[id]', params: { id: d.id } });
  }
  if (kind === 'confirm_snag' || kind === 'sign_off') return router.push('/snags');
  return router.push('/project');
}

function greeting(t: T): string {
  const h = new Date(Date.now() + 330 * 60_000).getUTCHours();
  return t(h < 12 ? 'one.morning' : h < 17 ? 'one.afternoon' : 'one.evening');
}

export function OneThingHome({ p, name, unread, t, refreshing, onRefresh }: { p: Project; name: string; unread: number; t: T; refreshing: boolean; onRefresh: () => void }) {
  const life = p.lifecycle ?? null;
  const blocker = life ? blockerLine(life, t) : null;
  const latest = p.updates[0] ?? null;
  const photo = latest?.photos[0] ?? null;
  const shortcut = (title: string, sub: string, to: '/site' | '/project' | '/locker' | '/snags') => (
    <Press key={to} onPress={() => router.push(to)} accessibilityRole="link" style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Press>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting(t)}</Text>
            <Text role="heading" style={styles.name} numberOfLines={1}>
              {name || p.studio}
            </Text>
          </View>
          <Press onPress={() => router.push('/notifications')} accessibilityLabel={t('one.notifications', { n: unread })} style={styles.bell}>
            <BellIcon color={color.ink} />
            {unread > 0 ? <View style={styles.dot} /> : null}
          </Press>
        </View>

        <DarkCard style={{ padding: 0, overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 16 / 10 }} contentFit="cover" accessibilityLabel={t('one.photo')} /> : null}
          <View style={{ padding: 20, gap: 10 }}>
            <Text style={styles.kicker}>{blocker ? t('one.kicker') : t('life.nothing')}</Text>
            <Text style={styles.big}>{blocker ?? (life ? stepLine(life.current, t) : t('one.working', { studio: p.studio }))}</Text>
            <Text style={styles.why}>
              {blocker
                ? life?.next
                  ? t('one.waitsNext', { studio: p.studio, next: stepLine(life.next, t) })
                  : t('one.waits', { studio: p.studio })
                : life
                  ? t(`life.doing.${life.studioDoing}` as Parameters<T>[0], { studio: p.studio })
                  : ''}
            </Text>
            {blocker && life?.blocker ? (
              <Button label={t('one.do')} onPress={() => go(life.blocker!.kind, p)} />
            ) : (
              <Button label={t('one.project')} variant="ghost" onPress={() => router.push('/project')} />
            )}
          </View>
        </DarkCard>

        <View>
          {shortcut(t('tab.site'), latest ? t('one.site.last', { day: dayLabel(latest.at) }) : t('one.site.none'), '/site')}
          {shortcut(t('tab.project'), typeof p.progressPct === 'number' ? t('one.pct', { n: p.progressPct }) : t('one.project.sub'), '/project')}
          {shortcut(t('one.docs'), t('one.docs.sub'), '/locker')}
          {shortcut(t('one.snags'), t('one.snags.sub'), '/snags')}
        </View>

        {p.stages.length ? (
          <View>
            <Text style={styles.section}>{t('one.stages')}</Text>
            {p.stages.map((s) => (
              <View key={s.key} style={styles.row}>
                <Text style={[styles.rowTitle, { flex: 1 }]}>{STAGE_SHORT[s.key] ?? s.label}</Text>
                <Text style={styles.rowSub}>{s.state === 'done' ? t('one.done') : s.state === 'now' ? t('one.now') : t('one.next')}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hello: { fontFamily: font.sans, fontSize: 15, color: color.ink2 },
  name: { fontFamily: font.sansMedium, fontSize: 32, letterSpacing: -1.2, color: color.ink },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent },
  kicker: { fontFamily: font.sansSemi, fontSize: 13, color: color.accentWarm },
  big: { fontFamily: font.sansSemi, fontSize: 26, lineHeight: 30, letterSpacing: -0.8, color: color.white },
  why: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.onDark2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.line },
  rowTitle: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  rowSub: { fontFamily: font.sans, fontSize: 13, color: color.ink2, marginTop: 2 },
  arrow: { fontFamily: font.sans, fontSize: 18, color: color.ink2 },
  section: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink, marginBottom: 4 },
});
