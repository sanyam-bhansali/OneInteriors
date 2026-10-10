import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowIcon } from '../../components/icons';
import { Body, Loading, Meta, Press, Rise, Screen, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { dayLabel, timeLabel } from '../../lib/format';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT } from '../../lib/types';

/** On site (the v1 design): every update from site, newest first, photos first. */
export default function Site() {
  const { state, refresh, refreshing } = useProject();
  const [earned, setEarned] = useState(0);
  const ready = state.status === 'ready';
  useEffect(() => {
    if (ready) void api.openedUpdate().then((r) => r.ok && setEarned(r.data.earned));
  }, [ready]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen>
        <Meta>Every update from site</Meta>
        <Title>On site</Title>
        <Body muted>Site photos and notes appear here once your project starts.</Body>
      </Screen>
    );
  }
  const p = state.project;
  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Meta>Every update from site</Meta>
      <Title size={40}>On site</Title>
      {earned ? <Body style={styles.toast}>+{earned} Home Coins for today’s update</Body> : null}
      <View>
        <Link title="View in 3D" sub="Your flat, room by room, as the studio builds it" path="/app/3d" />
        {p.updates.length ? <Link title="Your home's story" sub="Every site photo, played as one film" path="/app/story" /> : null}
      </View>
      {p.updates.length === 0 ? <Body muted>Nothing yet. The first update from {p.studio} appears here as soon as it is posted.</Body> : null}
      {p.updates.map((u, i) => (
        <Rise key={u.id} delay={Math.min(i, 4) * 80} style={styles.update}>
          <View style={styles.head}>
            <Text style={styles.h2}>{dayLabel(u.at)}</Text>
            <Text style={styles.mono}>{timeLabel(u.at)}</Text>
          </View>
          {u.photos[0] ? <Image source={{ uri: u.photos[0] }} style={styles.main} contentFit="cover" transition={300} /> : null}
          {u.photos.length > 1 ? (
            <View style={styles.pair}>
              {u.photos.slice(1, 5).map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.small} contentFit="cover" transition={300} />
              ))}
            </View>
          ) : null}
          <Body>{u.note}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Text style={styles.who}>{u.byStudio ? `Posted by ${p.studio}` : 'Posted by One Interiors'}</Text>
            {u.stage ? <Text style={styles.who}>{STAGE_SHORT[u.stage] ?? u.stage}</Text> : null}
          </View>
        </Rise>
      ))}
    </Screen>
  );
}

function Link({ title, sub, path }: { title: string; sub: string; path: string }) {
  return (
    <Press onPress={() => router.push({ pathname: '/web', params: { path, title } })} haptic={false} style={styles.link}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSub}>{sub}</Text>
      </View>
      <ArrowIcon color={color.ink2} />
    </Press>
  );
}

const styles = StyleSheet.create({
  toast: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: color.dark, color: color.onDark, fontSize: 14, overflow: 'hidden' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  linkTitle: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  linkSub: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  update: { gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  mono: { fontFamily: font.monoMedium, fontSize: 13, color: color.ink2 },
  main: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { flexBasis: '48%', flexGrow: 1, aspectRatio: 4 / 3, borderRadius: 12 },
  who: { fontFamily: font.monoMedium, fontSize: 13, color: color.ink, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: color.line },
});
