import { StyleSheet, Text, View } from 'react-native';
import { Card, Meta } from '../ui';
import { shortDate } from '../../lib/format';
import type { Key, T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { Tracker, TrackerMove, TrackerStage } from '../../lib/types';
import { TickIcon } from './parts';

/**
 * The Project screen's Phase 3 parts, from what the server computes
 * (portal/tracker-view.ts): the line under each stage (planned vs actual,
 * days early or late, a moved date), the current stage's checklist room
 * by room, and every moved date with its reason in plain words — the
 * customer's own changes labelled as theirs. Nothing here works a status
 * out; it only says what the server sent.
 */

/** "Planned 31 Oct, done 2 Nov · 2 days late" and friends, for one stage. */
export function stageLine(s: TrackerStage, t: T): string {
  if (s.actualEnd) {
    const head = t('project.doneOn', { planned: shortDate(s.originalEnd), actual: shortDate(s.actualEnd) });
    const tail = s.lateDays > 0 ? t('project.doneLateN', { n: s.lateDays }) : s.earlyDays > 0 ? t('project.doneEarly', { n: s.earlyDays }) : t('project.doneOnTime');
    return `${head} · ${tail}`;
  }
  if (s.status === 'late') return t('project.dueLateN', { date: shortDate(s.plannedEnd), n: s.lateDays });
  if (s.status === 'on-track') return t('project.dueOnTrack', { date: shortDate(s.plannedEnd) });
  return t('project.plannedRange', { from: shortDate(s.plannedStart), to: shortDate(s.plannedEnd) });
}

const reasonKey = (m: { reason: TrackerMove['reason']; byDecision?: boolean }): Key =>
  (m.byDecision ? 'project.reason.DECISION' : `project.reason.${m.reason}`) as Key;

/** Under a stage whose end moved: "Moved from 31 Oct · A supplier delivered late." */
export function MovedNote({ stage: s, t }: { stage: TrackerStage; t: T }) {
  if (!s.moved) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.small}>
        {t('project.movedFrom', { from: shortDate(s.moved.from) })} · {t(reasonKey(s.moved))}
      </Text>
      {s.moved.customer ? <Text style={styles.yours}>{t('project.move.yours')}</Text> : null}
    </View>
  );
}

/** The stage under way, room by room: what is done and what is not yet. */
export function StageChecklist({ current, t }: { current: NonNullable<Tracker['current']>; t: T }) {
  const all = current.rooms.flatMap((r) => r.items);
  if (all.length === 0) return null;
  const done = all.filter((i) => i.done).length;
  return (
    <View style={styles.checklist}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t('project.checklist.title')}</Text>
        <Meta>{t('project.checklist.count', { done, total: all.length })}</Meta>
      </View>
      {current.rooms.map((room) => (
        <View key={room.room} style={{ gap: 6 }}>
          <Text style={styles.room}>{room.room}</Text>
          {room.items.map((it, i) => (
            <View
              key={`${room.room}-${i}`}
              style={styles.item}
              accessible
              accessibilityLabel={`${it.label}, ${it.done ? t('project.checklist.done') : t('project.checklist.open')}`}
            >
              <View style={[styles.box, it.done ? styles.boxDone : null]}>{it.done ? <TickIcon color={color.white} size={13} /> : null}</View>
              <Text style={[styles.itemText, it.done && { color: color.ink2 }]}>{it.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Every moved date, newest first: old date → new date, and why. */
export function MovesCard({ moves, t }: { moves: TrackerMove[]; t: T }) {
  if (moves.length === 0) return null;
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t('project.moves.title')}</Text>
      </View>
      {moves.map((m) => (
        <View key={m.at} style={styles.moveRow}>
          <Text style={styles.moveLine}>
            {m.field === 'handover'
              ? t('project.move.handover', { from: shortDate(m.from), to: shortDate(m.to) })
              : t('project.move.stage', { stage: m.stage ?? '', from: shortDate(m.from), to: shortDate(m.to) })}
          </Text>
          <Text style={styles.small}>
            {t(reasonKey(m))}
            {m.handoverTo ? ` ${t('project.move.handoverAlso', { date: shortDate(m.handoverTo) })}` : ''}
          </Text>
          {m.customer ? <Text style={styles.yours}>{t('project.move.yours')}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  yours: { fontFamily: font.sansMedium, fontSize: 13, lineHeight: 18, color: color.ok },
  checklist: { backgroundColor: color.soft, borderRadius: 16, padding: 14, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  headTitle: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
  room: { fontFamily: font.sansSemi, fontSize: 13, letterSpacing: 13 * 0.04, textTransform: 'uppercase', color: color.ink2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#B9B7B1', alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: color.accent, borderColor: color.accent },
  itemText: { flex: 1, fontFamily: font.sans, fontSize: 14.5, lineHeight: 20, color: color.ink },
  moveRow: { gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  moveLine: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
});
