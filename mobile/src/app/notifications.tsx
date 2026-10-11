import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarMark, CameraMark, ChatMark, ChevronBack, FolderMark, LinesMark, TickMark } from '../components/home/marks';
import { Body, ErrorText, Press, Screen, Stagger, Title } from '../components/ui';
import { api } from '../lib/api';
import { dayLabel, timeLabel } from '../lib/format';
import { useHeadline, useT } from '../lib/i18n';
import { useProfile } from '../lib/profile';
import { routeFor } from '../lib/push';
import { color, font } from '../lib/theme';
import type { Notice } from '../lib/types';

/**
 * Notifications (Notifications.dc.html, screen 29): Today and Earlier,
 * newest first, an unread dot and a tinted icon on what is new, each row
 * opening its source. Opening the list marks it read; the dots stay for
 * this visit so the customer can still see what was new.
 */
export default function Notifications() {
  const t = useT();
  const size = useHeadline(38);
  const { refresh: refreshProfile } = useProfile();
  const [list, setList] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = await api.notifications();
    setRefreshing(false);
    if (!r.ok) return setError(r.error);
    setError(null);
    setNow(Date.now());
    setList(r.data.notifications);
    if (r.data.unread > 0) void api.markRead('all').then(() => refreshProfile());
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sorted = [...(list ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const today = sorted.filter((n) => sameDay(n.createdAt, now));
  const earlier = sorted.filter((n) => !sameDay(n.createdAt, now));

  return (
    <Screen
      onRefresh={() => void load()}
      refreshing={refreshing}
      header={
        <View style={styles.top}>
          <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={styles.back} accessibilityLabel={t('notif.back')}>
            <ChevronBack color={color.ink} />
          </Press>
          <Press onPress={() => router.push('/me')} haptic={false} accessibilityRole="link" style={styles.settings}>
            <Text style={styles.settingsText}>{t('notif.settings')}</Text>
          </Press>
        </View>
      }
    >
      <View style={{ gap: 22, marginTop: -12 }}>
        <Title size={size} style={{ letterSpacing: size * -0.05 }}>
          {t('me.notifications')}
        </Title>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {list && list.length === 0 ? <Body muted>{t('notif.empty')}</Body> : null}
        {today.length ? <Group title={t('notif.today')}>{today.map((n, i) => <Row key={n.id} n={n} i={i} now={now} />)}</Group> : null}
        {earlier.length ? (
          <Group title={t('notif.earlier')}>
            {earlier.map((n, i) => (
              <Row key={n.id} n={n} i={today.length + i} now={now} />
            ))}
          </Group>
        ) : null}
      </View>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ paddingLeft: 10 }}>
      <Text role="heading" style={styles.group}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ n, i, now }: { n: Notice; i: number; now: number }) {
  const t = useT();
  const href = routeFor(n.payload.url);
  const fresh = !n.readAt;
  const when = whenLabel(n.createdAt, now);
  const ink = fresh ? color.accentInk : color.ink2;
  const label = [fresh ? t('notif.unread') : null, n.payload.title, n.payload.body, when].filter(Boolean).map((x) => String(x).replace(/[.。।]+$/, '')).join('. ');
  return (
    <Stagger i={Math.min(i, 10)} start={120}>
      <Press haptic={false} disabled={!href} onPress={() => href && router.push(href)} accessibilityRole="link" accessibilityLabel={label} style={styles.row}>
        {fresh ? <View style={styles.dot} /> : null}
        <View style={[styles.icon, { backgroundColor: fresh ? '#F5E2D8' : color.soft2 }]}>
          <NoticeIcon template={n.template} url={n.payload.url} color={ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {n.payload.title ? <Text style={[styles.title, { fontFamily: fresh ? font.sansSemi : font.sansMedium }]}>{n.payload.title}</Text> : null}
          {n.payload.body ? <Text style={styles.body}>{n.payload.body}</Text> : null}
        </View>
        <Text style={styles.when}>{when}</Text>
      </Press>
    </Stagger>
  );
}

/** The design's icon for each kind: camera for site, calendar for decisions, tick for snags, lines for money, a bubble for the expert. */
function NoticeIcon({ template, url = '', color: c }: { template: string; url?: string; color: string }) {
  const kind = `${template} ${url}`.toLowerCase();
  if (kind.includes('decision')) return <CalendarMark color={c} />;
  if (kind.includes('snag')) return <TickMark color={c} />;
  if (kind.includes('payment') || kind.includes('project')) return <LinesMark color={c} />;
  if (kind.includes('document') || kind.includes('locker')) return <FolderMark color={c} />;
  if (kind.includes('expert') || kind.includes('geio') || kind.includes('reply') || kind.includes('message')) return <ChatMark color={c} />;
  return <CameraMark color={c} />;
}

const IST = 'Asia/Kolkata';
const istDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: IST });
const sameDay = (iso: string, now: number) => istDay(Date.parse(iso)) === istDay(now);

/** "5:12 pm" today, "Tue" this week, "Tue 6 Oct" before that. */
function whenLabel(iso: string, now: number): string {
  if (sameDay(iso, now)) return timeLabel(iso);
  const days = (now - Date.parse(iso)) / 86_400_000;
  if (days < 6) return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', timeZone: IST });
  return dayLabel(iso);
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16, paddingLeft: 10, paddingRight: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  settings: { minHeight: 44, justifyContent: 'center' },
  settingsText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink },
  group: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line },
  dot: { position: 'absolute', left: -10, top: '50%', marginTop: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, color: color.ink },
  body: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
  when: { fontFamily: font.sans, fontSize: 13, color: color.ink3, paddingTop: 2 },
});
