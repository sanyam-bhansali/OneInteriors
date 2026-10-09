import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackIcon } from '../components/icons';
import { Body, Meta, Press, Rise, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { dayLabel, timeLabel } from '../lib/format';
import { routeFor } from '../lib/push';
import { color, font } from '../lib/theme';
import type { Notice } from '../lib/types';

/** Everything the app has told this customer, newest first. Opening the list marks it read. */
export default function Notifications() {
  const [list, setList] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = await api.notifications();
    setRefreshing(false);
    if (!r.ok) return setError(r.error);
    setList(r.data.notifications);
    if (r.data.unread > 0) void api.markRead('all');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen
      onRefresh={() => void load()}
      refreshing={refreshing}
      header={
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
            <BackIcon color={color.ink} />
          </Press>
        </View>
      }
    >
      <Meta>From site, the studio and your expert</Meta>
      <Title size={40}>Updates</Title>
      {error ? <Body muted>{error}</Body> : null}
      {list && list.length === 0 ? <Body muted>Nothing yet. Site updates, decisions and snags appear here, and on your lock screen.</Body> : null}
      <View>
        {(list ?? []).map((n, i) => {
          const href = routeFor(n.payload.url);
          return (
            <Rise key={n.id} delay={Math.min(i, 10) * 40}>
              <Press haptic={false} disabled={!href} onPress={() => href && router.push(href)} style={styles.row}>
                {!n.readAt ? <View style={styles.dot} /> : <View style={{ width: 8 }} />}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.title}>{n.payload.title}</Text>
                  {n.payload.body ? <Text style={styles.body}>{n.payload.body}</Text> : null}
                  <Text style={styles.when}>
                    {dayLabel(n.createdAt)}, {timeLabel(n.createdAt)}
                  </Text>
                </View>
              </Press>
            </Rise>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accentWarm, marginTop: 7 },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  body: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: color.ink2 },
  when: { fontFamily: font.mono, fontSize: 11.5, color: color.ink3 },
});
