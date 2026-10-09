import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { daysLate } from '../../lib/progress';
import { Body, Loading, Meta, Rise, Screen, Title } from '../../components/ui';
import { shortDate } from '../../lib/format';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { STAGE_SHORT } from '../../lib/types';

/** Project tracker (the v1 design): late, started, handover; every stage with its date; the payment plan. */
export default function Project() {
  const { state, refresh, refreshing } = useProject();
  const [now] = useState(() => Date.now());
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen>
        <Meta>Your project</Meta>
        <Title>Nothing started yet.</Title>
        <Body muted>The timeline appears here the day you sign with a studio.</Body>
      </Screen>
    );
  }

  const p = state.project;
  const late = daysLate(p.stages, now);
  const handover = p.stages[p.stages.length - 1];

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Meta>
        {p.studio}, since {shortDate(p.startOn)}
      </Meta>
      <Title size={40}>Your project</Title>

      <View style={styles.stats}>
        <Stat label="Running" value={late ? `${late} day${late === 1 ? '' : 's'} late` : 'On time'} tone={late ? color.accentInk : color.ok} />
        <Stat label="Started" value={shortDate(p.startOn)} />
        <Stat label="Handover" value={handover ? shortDate(handover.targetOn) : '—'} last />
      </View>

      <View>
        {p.stages.map((s, i) => (
          <Rise key={s.key} delay={220 + i * 60} style={styles.tl}>
            <View style={styles.rail}>
              <View style={[styles.node, s.state === 'done' && styles.nodeDone, s.state === 'now' && styles.nodeNow]} />
              {i < p.stages.length - 1 ? <View style={[styles.line, s.state === 'done' && { backgroundColor: color.accent }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 22 }}>
              <Text style={[styles.h3, s.state === 'now' && { color: color.accentInk }, (s.state === 'next' || s.state === 'later') && { color: color.ink2 }]}>
                {STAGE_SHORT[s.key] ? s.label : s.label}
                {s.state === 'now' ? ', now' : ''}
              </Text>
              <Text style={styles.mono}>{s.state === 'done' ? 'Done' : `Planned ${shortDate(s.targetOn)}`}</Text>
              {s.late ? (
                <View style={styles.flag}>
                  <Meta style={{ color: color.accentInk }}>Past its date</Meta>
                  <Body style={{ fontSize: 14 }}>Planned for {shortDate(s.targetOn)} and not marked done yet. Your expert is following it up.</Body>
                </View>
              ) : null}
            </View>
          </Rise>
        ))}
      </View>

      {p.phases ? (
        <View style={{ gap: 6 }}>
          <View style={styles.head}>
            <Text style={styles.h2}>Payment plan</Text>
            <Meta>You pay the studio</Meta>
          </View>
          {p.phases.map((ph) => (
            <View key={ph.label} style={styles.row}>
              <Body>{ph.label}</Body>
              <Text style={styles.mono}>{ph.pct}%</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }) {
  return (
    <View style={[styles.stat, !last && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.line }]}>
      <Meta>{label}</Meta>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, gap: 6 },
  statValue: { fontFamily: font.sansSemi, fontSize: 19, letterSpacing: -0.6, color: color.ink },
  tl: { flexDirection: 'row', gap: 12 },
  rail: { width: 20, alignItems: 'center' },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.ink3, backgroundColor: color.bg, marginTop: 2 },
  nodeDone: { borderColor: color.accent, backgroundColor: color.accent },
  nodeNow: { borderColor: color.accent, borderWidth: 6 },
  line: { flex: 1, width: 2, backgroundColor: color.line },
  h3: { fontFamily: font.sansSemi, fontSize: 19, letterSpacing: -0.4, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2, marginTop: 4 },
  flag: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: color.accentWash, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
