import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Loading, Meta, Rise, Screen, Title } from '../../components/ui';
import { dayLabel, timeLabel } from '../../lib/format';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT } from '../../lib/types';

/** On site (the v1 design): every update from site, newest first, photos first. */
export default function Site() {
  const { state, refresh, refreshing } = useProject();
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

const styles = StyleSheet.create({
  update: { gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  mono: { fontFamily: font.monoMedium, fontSize: 12, color: color.ink2 },
  main: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { flexBasis: '48%', flexGrow: 1, aspectRatio: 4 / 3, borderRadius: 12 },
  who: { fontFamily: font.monoMedium, fontSize: 12, color: color.ink, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: color.line },
});
