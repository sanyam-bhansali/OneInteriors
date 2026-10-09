import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ArrowIcon } from '../../components/icons';
import { Body, Loading, Meta, Press, Rise, Screen, Title } from '../../components/ui';
import { dayLabel, inr, lakh, shortDate } from '../../lib/format';
import { daysLate } from '../../lib/progress';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import type { Money, Project as ProjectData } from '../../lib/types';

/**
 * Project (v79 design + trust fixes 5 and 7): overall delay, paid and
 * handover up top; snags and the open decision one tap away; payments as a
 * ring in rupees with each stage's date; "Changes so far"; then every stage.
 */
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
  const open = p.snags.filter((s) => s.status === 'OPEN').length;
  const decision = p.decisions.find((d) => d.state === 'due-soon' || d.state === 'open') ?? null;

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Meta>
        {p.studio}, since {shortDate(p.startOn)}
      </Meta>
      <Title size={40}>Your project</Title>

      <View style={styles.stats}>
        <Stat label="Overall" value={late ? `${late} day${late === 1 ? '' : 's'} late` : 'On time'} tone={late ? color.accentInk : color.ok} />
        <Stat label="Paid" value={p.money ? `${lakh(p.money.paidPaise)}` : '—'} sub={p.money ? `of ${lakh(p.money.contractPaise)}` : undefined} />
        <Stat label="Handover" value={handover ? shortDate(handover.targetOn) : '—'} last />
      </View>

      <View>
        <Row
          title="Snags"
          sub={p.snags.length ? `${open} open · ${p.snags.length - open} fixed` : 'Nothing raised. Photograph anything that is not right.'}
          onPress={() => router.push('/snags')}
        />
        {decision ? (
          <Row
            title="Your decision"
            sub={`${decision.title} · due ${dayLabel(decision.dueOn)}`}
            onPress={() => router.push({ pathname: '/decision/[id]', params: { id: decision.id } })}
          />
        ) : null}
      </View>

      {p.money ? <Payments money={p.money} studio={p.studio} /> : null}
      {p.changes && p.changes.items.length ? <Changes changes={p.changes} contract={p.money?.contractPaise ?? null} /> : null}

      <Text style={styles.h2}>Every stage</Text>
      <View>
        {p.stages.map((s, i) => (
          <Rise key={s.key} delay={220 + i * 60} style={styles.tl}>
            <View style={styles.rail}>
              <View style={[styles.node, s.state === 'done' && styles.nodeDone, s.state === 'now' && styles.nodeNow]} />
              {i < p.stages.length - 1 ? <View style={[styles.line, s.state === 'done' && { backgroundColor: color.accent }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 22 }}>
              <Text style={[styles.h3, s.state === 'now' && { color: color.accentInk }, (s.state === 'next' || s.state === 'later') && { color: color.ink2 }]}>
                {s.label}
                {s.state === 'now' ? ', now' : ''}
              </Text>
              <Text style={styles.mono}>
                {s.state === 'done' ? 'Done' : `Planned ${shortDate(s.targetOn)}`}
                {s.state === 'now' ? (s.late ? ' · running late' : ' · on track') : ''}
              </Text>
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

      {!p.money && p.phases ? (
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

function Payments({ money, studio }: { money: Money; studio: string }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = Math.max(1, money.contractPaise);
  const next = money.next;
  const arc = (from: number, len: number, stroke: string) =>
    len > 0 ? (
      <Circle
        cx={66}
        cy={66}
        r={R}
        fill="none"
        stroke={stroke}
        strokeWidth={14}
        strokeDasharray={`${Math.max(0, (len / total) * C - 3)} ${C}`}
        strokeDashoffset={-(from / total) * C}
        rotation={-90}
        origin="66, 66"
      />
    ) : null;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text style={styles.h2}>Payments</Text>
        <Meta>You pay the studio</Meta>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 132, height: 132 }}>
          <Svg width={132} height={132} viewBox="0 0 132 132">
            <Circle cx={66} cy={66} r={R} fill="none" stroke={color.line} strokeWidth={14} />
            {arc(0, money.paidPaise, color.accent)}
            {arc(money.paidPaise, next?.amountPaise ?? 0, color.gold)}
          </Svg>
          <View style={styles.ringText} pointerEvents="none">
            <Text style={styles.ringBig}>{lakh(money.paidPaise)}</Text>
            <Text style={styles.mono}>paid</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Legend swatch={color.accent} label="Paid" value={inr(money.paidPaise)} />
          <Legend swatch={color.gold} label={next?.dueOn ? `Next, ${shortDate(next.dueOn)}` : 'Next'} value={next ? inr(next.amountPaise) : '—'} />
          <Legend swatch={color.line} label="After that" value={inr(money.laterPaise)} />
        </View>
      </View>
      {money.stages.map((s, i) => (
        <View key={s.index} style={styles.stage}>
          <Text style={[styles.stageN, s.state === 'paid' && { color: color.ok }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stageLabel, s.state === 'next' && { color: color.accentInk }]}>{s.label}</Text>
            <Text style={styles.mono}>
              {s.paidOn ? `Paid ${shortDate(s.paidOn)}` : s.dueOn ? `Due ${shortDate(s.dueOn)}` : s.state === 'next' ? 'Next · the studio sets the date' : 'Later'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amt}>{inr(s.amountPaise)}</Text>
            {s.pct !== null ? <Text style={styles.mono}>{s.pct}%</Text> : null}
          </View>
        </View>
      ))}
      <Body muted style={{ fontSize: 14 }}>
        You pay {studio} directly. We remind you two days before each payment is due, and keep every receipt in your Home locker.
      </Body>
    </View>
  );
}

function Changes({ changes, contract }: { changes: NonNullable<ProjectData['changes']>; contract: number | null }) {
  return (
    <View style={styles.card}>
      <Meta>Changes so far</Meta>
      <Text style={styles.big}>{changes.totalPaise ? `+${inr(changes.totalPaise)}` : 'Nothing added'}</Text>
      <Body muted style={{ fontSize: 14 }}>
        Across {changes.items.length} decision{changes.items.length === 1 ? '' : 's'}
        {contract !== null && changes.totalPaise ? `. Now ${inr(contract + changes.totalPaise)} in all, before GST.` : '.'}
      </Body>
      {changes.items.map((c) => (
        <View key={c.decisionId} style={styles.changeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stageLabel}>{c.title}</Text>
            <Text style={styles.mono}>
              {c.option}
              {c.chosenAt ? ` · ${shortDate(c.chosenAt)}` : ''}
            </Text>
          </View>
          <Text style={styles.amt}>{c.extraPaise ? `+${inr(c.extraPaise)}` : 'In quote'}</Text>
        </View>
      ))}
    </View>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: swatch }} />
      <Text style={[styles.stageLabel, { flex: 1, fontSize: 14 }]}>{label}</Text>
      <Text style={styles.amt}>{value}</Text>
    </View>
  );
}

function Row({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} haptic={false} style={styles.linkRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.stageLabel}>{title}</Text>
        <Text style={styles.subText}>{sub}</Text>
      </View>
      <ArrowIcon color={color.ink2} />
    </Press>
  );
}

function Stat({ label, value, sub, tone, last }: { label: string; value: string; sub?: string; tone?: string; last?: boolean }) {
  return (
    <View style={[styles.stat, !last && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.line }]}>
      <Meta>{label}</Meta>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      {sub ? <Text style={styles.mono}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, gap: 6 },
  statValue: { fontFamily: font.sansSemi, fontSize: 19, letterSpacing: -0.6, color: color.ink },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  subText: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
  tl: { flexDirection: 'row', gap: 12 },
  rail: { width: 20, alignItems: 'center' },
  node: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.ink3, backgroundColor: color.bg, marginTop: 2 },
  nodeDone: { borderColor: color.accent, backgroundColor: color.accent },
  nodeNow: { borderColor: color.accent, borderWidth: 6 },
  line: { flex: 1, width: 2, backgroundColor: color.line },
  h3: { fontFamily: font.sansSemi, fontSize: 19, letterSpacing: -0.4, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 13, color: color.ink2, marginTop: 3 },
  flag: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: color.accentWash, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  ringText: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringBig: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink },
  stage: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  stageN: { width: 18, fontFamily: font.monoMedium, fontSize: 13, color: color.accentInk, marginTop: 2 },
  stageLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  amt: { fontFamily: font.monoMedium, fontSize: 14, color: color.ink },
  card: { padding: 16, borderRadius: 18, backgroundColor: color.surface, gap: 6 },
  big: { fontFamily: font.sansSemi, fontSize: 30, letterSpacing: -1.2, color: color.ink },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 10, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
});
