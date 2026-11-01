import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowIcon } from '../../components/icons';
import { CalendarIcon, GrowLine, NowDot, SnagIcon } from '../../components/project/parts';
import { MilestoneLine, MovedNote, MovesCard, ProgressBar, StageChecklist, StageSteps, stageLine } from '../../components/project/tracker';
import { Body, Card, Eyebrow, Loading, Meta, Press, Screen, Stagger, Tile, Title } from '../../components/ui';
import { dayLabel, inr, lakh, shortDate } from '../../lib/format';
import { useHeadline, useLang, useT, type T } from '../../lib/i18n';
import { daysLate } from '../../lib/progress';
import { usePlan } from '../../lib/plan';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { PaymentEntries } from '../../components/project/payment-entries';
import { DesignCard } from '../../components/project/design';
import { LifecycleCard } from '../../components/project/lifecycle';
import { ExtrasCard, SignoffsCard } from '../../components/project/extras';
import { projectFocus, type Block } from '@/modules/app/project-focus';
import type { Decision, Money, Payments as PaymentsData, Project as ProjectData, Stage, Tracker, TrackerStage } from '../../lib/types';

/**
 * Project (design #22, Tracker): overall delay, paid and handover as tinted
 * tiles; snags and the open decision one tap away; then every stage on a
 * line that fills from the top, the current one pulsing. Stage status and
 * overall status always show together (FLOWS.md). Payments and changes so
 * far follow in one soft card. No savings meter: the server has no savings
 * figures yet, and none are made up here. With the step tracker the server
 * also sends how much of the home is done, overall and per stage, and each
 * stage's steps; the percentage card leads, and the stage under way lists
 * its steps (older servers: its room checklist).
 *
 * Laid out by where the project is (owner, 1 Nov 2026; modules/app/
 * project-focus.ts, shared with the website): in design only the design's
 * progress and what matters now; the rest under "See the whole plan".
 */
export default function Project() {
  const t = useT();
  const { assured } = usePlan();
  const { lang } = useLang();
  const size = useHeadline(42);
  const { state, refresh, refreshing } = useProject();
  const [now] = useState(() => Date.now());
  const [whole, setWhole] = useState(false);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen>
        <Eyebrow>{t('project.title')}</Eyebrow>
        <Title size={size}>{t('project.none.title')}</Title>
        <Body muted>{t('project.none.body')}</Body>
      </Screen>
    );
  }

  const p = state.project;
  // Computed on the server (planned vs forecast handover); older servers do not send it.
  const late = p.overallLateDays ?? daysLate(p.stages, now);
  const tracker = p.tracker ?? null;
  const customerDays = tracker?.overall.customerDays ?? 0;
  const handover = p.stages.find((s) => s.key === 'HANDOVER') ?? p.stages[p.stages.length - 1];
  const open = p.snags.filter((s) => s.status === 'OPEN').length;
  const fixed = p.snags.length - open;
  const due = p.decisions.find((d) => d.state === 'due-soon' || d.state === 'open') ?? null;
  const chosen = [...p.decisions].reverse().find((d) => d.state === 'chosen') ?? null;
  const openDecision = (d: Decision) => router.push({ pathname: '/decision/[id]', params: { id: d.id } });
  const snagSub = p.snags.length ? t('project.snagsCount', { open, fixed }) : t('project.snagsNone');
  const decisionSub = due
    ? t('project.decisionDue', { title: due.title, day: dayLabel(due.dueOn) })
    : chosen
      ? t('project.decisionChosen', { title: chosen.title })
      : t('project.decisionNone');
  const titleLine = lang === 'en' ? 20 : 26;

  /* Only what the phase needs (owner, 1 Nov 2026; modules/app/project-focus.ts, shared with the website). */
  const design = p.design && (typeof p.design.pct === 'number' || p.design.steps.length > 0) ? p.design : null;
  const layout = projectFocus({
    phase: p.lifecycle?.phase,
    designRunning: Boolean(design && !design.done),
    snags: p.snags.length,
    paymentToConfirm: (p.payments?.waitingPaise ?? 0) > 0,
  });
  const inDesign = layout.focus === 'design';
  const heading = inDesign ? t('project.title.design') : layout.focus === 'handover' ? t('project.title.handover') : t('project.title.home');

  const block = (b: Block): ReactNode => {
    switch (b) {
      case 'progress': {
        const pct = inDesign ? (design?.pct ?? null) : (p.progressPct ?? null);
        if (typeof pct !== 'number') return null;
        return (
          <Card>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{inDesign ? t('project.designSoFar') : t('project.progress')}</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <ProgressBar pct={pct} label={inDesign ? t('design.pct.a11y', { n: pct }) : t('project.progress.a11y', { n: pct })} />
            <Text style={styles.note}>{inDesign ? t('project.designSoFar.body', { studio: p.studio }) : t('project.progress.body', { studio: p.studio })}</Text>
          </Card>
        );
      }
      case 'stats':
        return (
          <>
            <View style={styles.row3}>
              <Stagger i={0} start={120} style={{ flex: 1 }}>
                <Tile
                  tint="peach"
                  label={t('project.overall')}
                  value={late ? (late === 1 ? t('project.dayLate') : t('project.daysLate', { n: late })) : t('project.onTime')}
                  valueColor={late ? color.accentInk : color.ok}
                />
              </Stagger>
              <Stagger i={1} start={120} style={{ flex: 1 }}>
                <Tile
                  tint="mint"
                  label={t('project.paid')}
                  value={p.money ? lakh(p.money.paidPaise) : '—'}
                  sub={p.money ? t('project.paidOf', { total: lakhFigure(p.money.contractPaise) }) : undefined}
                />
              </Stagger>
              <Stagger i={2} start={120} style={{ flex: 1 }}>
                <Tile tint="sand" label={t('project.handover')} value={handover ? shortDate(handover.targetOn) : '—'} />
              </Stagger>
            </View>
            {late > 0 && customerDays > 0 ? <Text style={styles.note}>{t('project.customerDays', { n: customerDays })}</Text> : null}
          </>
        );
      case 'lifecycle':
        /* The project lifecycle: where it is, what is next, and what unlocks it. */
        return p.lifecycle ? <LifecycleCard projectId={p.id} life={p.lifecycle} studio={p.studio} onChanged={() => void refresh()} t={t} /> : null;
      case 'signoffs':
        /* Change orders and digital sign-off (15 Oct 2026): quotations to sign, extra work to approve and pay. */
        return (
          <>
            {p.signoffs?.length ? <SignoffsCard signoffs={p.signoffs} t={t} /> : null}
            {p.extras?.length ? <ExtrasCard extras={p.extras} onChanged={() => void refresh()} t={t} /> : null}
          </>
        );
      case 'decision':
        return due ? (
          <Press onPress={() => openDecision(due)} accessibilityLabel={`${t('project.decision')}. ${decisionSub}`} style={styles.decisionTile}>
            <View style={styles.tileHead}>
              <CalendarIcon color={color.accentWarm} />
            </View>
            <Text style={[styles.tileTitle, { color: color.onDark }]}>{t('project.decision')}</Text>
            <Text style={[styles.tileSub, { color: color.onDark2 }]} numberOfLines={2}>
              {decisionSub}
            </Text>
          </Press>
        ) : null;
      case 'design':
        return design ? <DesignCard design={design} studio={p.studio} owner={p.role !== 'family'} docs={p.documents} onChanged={() => void refresh()} t={t} hideProgress={inDesign} /> : null;
      case 'site':
        /* Site moved inside Project when Chats took its tab (the owner's v1 screens, 1 Nov 2026). */
        return (
          <Press onPress={() => router.push('/site')} accessibilityRole="link" accessibilityLabel={t('tab.site')} style={styles.decisionTile}>
            <Text style={[styles.tileTitle, { color: color.onDark }]}>{t('tab.site')}</Text>
            <Text style={[styles.tileSub, { color: color.onDark2 }]} numberOfLines={2}>
              {p.updates[0] ? `${p.updates[0].note || t('tab.site')} · ${dayLabel(p.updates[0].at)}` : t('site.none')}
            </Text>
          </Press>
        );
      case 'snags':
        return (
          <Press onPress={() => router.push('/snags')} accessibilityLabel={`${t('project.snags')}. ${snagSub}`} style={styles.snagTile}>
            <View style={styles.tileHead}>
              <SnagIcon color={color.accent} />
              {open ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{open}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.tileTitle}>{t('project.snags')}</Text>
            <Text style={styles.tileSub}>{snagSub}</Text>
          </Press>
        );
      case 'nextPayment':
        return <NextPayment money={p.money} phases={p.phases} studio={p.studio} t={t} />;
      case 'payments':
        return p.money ? <Payments money={p.money} changes={p.changes} payments={p.payments ?? null} onChanged={() => void refresh()} t={t} /> : null;
      case 'changes':
        return null; // The phone's payments card carries the changes.
      case 'stages':
        return (
          <>
            <View role="list" aria-label={t('project.stages')}>
              {p.stages.map((s, i) => (
                <StageRow
                  key={s.key}
                  stage={s}
                  i={i}
                  last={i === p.stages.length - 1}
                  decision={s.state === 'now' && due ? due : null}
                  onDecision={openDecision}
                  titleLine={titleLine}
                  assured={assured}
                  studio={p.studio}
                  tracked={tracker && tracker.stages.length === p.stages.length ? (tracker.stages[i] ?? null) : null}
                  current={s.state === 'now' ? (tracker?.current ?? null) : null}
                  t={t}
                />
              ))}
            </View>
            {tracker ? <MovesCard moves={tracker.moves} t={t} /> : null}
          </>
        );
    }
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={{ gap: 22, paddingTop: 10 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('project.since', { studio: p.studio, date: shortDate(p.startOn) })}</Eyebrow>
          <Title size={size} style={{ letterSpacing: size * -0.05, lineHeight: lang === 'en' ? size * 0.98 : size * 1.25 }}>
            {heading}
          </Title>
        </View>

        {layout.main.map((b) => (
          <Fragment key={b}>{block(b)}</Fragment>
        ))}

        {layout.folded.length ? (
          <>
            <Press onPress={() => setWhole((w) => !w)} accessibilityRole="button" accessibilityState={{ selected: whole }} style={styles.wholePlan}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.tileTitle}>{t('project.wholePlan')}</Text>
                <Text style={[styles.tileSub, { marginTop: 0 }]}>{inDesign ? t('project.wholePlan.design') : t('project.wholePlan.sub')}</Text>
              </View>
              <Text style={styles.tileTitle}>{whole ? '↑' : '↓'}</Text>
            </Press>
            {whole
              ? layout.folded.map((b) => (
                  <Fragment key={b}>{block(b)}</Fragment>
                ))
              : null}
          </>
        ) : null}

        {/* Promises Assured-plan service (FLOWS.md): flagged for Sanyam, kept. */}
        <Text style={styles.note}>{assured ? t('project.footnote') : t('plan.basic.footnote')}</Text>
      </View>
    </Screen>
  );
}

/** The next payment alone: amount, stage and when (the whole plan has the rest). */
function NextPayment({ money, phases, studio, t }: { money: Money | null; phases: ProjectData['phases']; studio: string; t: T }) {
  if (!money) {
    if (!phases?.length) return null;
    return (
      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('project.paymentPlan')}</Text>
          <Meta>{t('project.youPay')}</Meta>
        </View>
        {phases.map((ph) => (
          <View key={ph.label} style={styles.payRow}>
            <Text style={[styles.payLabel, { flex: 1 }]}>{ph.label}</Text>
            <Text style={styles.amt}>{ph.pct}%</Text>
          </View>
        ))}
        <Text style={styles.note}>{t('project.payNote')}</Text>
      </Card>
    );
  }
  const next = money.next;
  return (
    <Card>
      <Text style={styles.cardTitle}>{next ? t('project.nextPayment') : t('project.allPaid')}</Text>
      {next ? (
        <>
          <Text style={styles.progressPct}>{inr(next.amountPaise)}</Text>
          <Text style={styles.note}>
            {next.dueOn ? t('project.nextPayment.due', { stage: next.label, studio, date: shortDate(next.dueOn) }) : t('project.nextPayment.when', { stage: next.label, studio })}
          </Text>
        </>
      ) : (
        <Text style={styles.note}>{inr(money.paidPaise)}</Text>
      )}
    </Card>
  );
}

/** "18.4" for ₹18.4 L, so the tile reads "₹7.36 L of 18.4"; under a lakh, rupees in full. */
function lakhFigure(paise: number): string {
  const rupees = paise / 100;
  if (rupees < 100_000) return inr(paise);
  return (rupees / 100_000).toFixed(2).replace(/\.?0+$/, '');
}

function StageRow({
  stage: s,
  i,
  last,
  decision,
  onDecision,
  titleLine,
  assured,
  studio,
  tracked,
  current,
  t,
}: {
  stage: Stage;
  i: number;
  last: boolean;
  decision: Decision | null;
  onDecision: (d: Decision) => void;
  titleLine: number;
  /** Assured promises our follow-up; Basic must not. */
  assured: boolean;
  studio: string;
  /** The server's planned-vs-actual for this stage (Phase 3); null from older servers. */
  tracked: TrackerStage | null;
  /** The current stage's room checklist. */
  current: Tracker['current'];
  t: T;
}) {
  const done = s.state === 'done';
  const nowStage = s.state === 'now';
  const date = shortDate(s.targetOn);
  const line = tracked
    ? stageLine(tracked, t)
    : done
      ? t('project.plannedDone', { date })
      : nowStage
        ? s.late
          ? t('project.dueLate', { date })
          : t('project.dueOnTrack', { date })
        : t('project.planned', { date });
  return (
    <Stagger i={i} start={220}>
      <View role="listitem" style={styles.tlInner}>
        <View style={styles.rail}>
          {done ? (
            <View style={[styles.node, { backgroundColor: color.accent }]} />
          ) : nowStage ? (
            <View style={[styles.node, styles.nodeNow]}>
              <NowDot color={color.accent} />
            </View>
          ) : (
            <View style={[styles.node, styles.nodeLater]} />
          )}
          {!last ? <GrowLine color={done ? color.accent : color.line} delay={350 + i * 500} /> : null}
        </View>
        <View style={[styles.stageBody, last && { paddingBottom: 0 }]}>
          <Text
            role="heading"
            style={[
              styles.stageTitle,
              { lineHeight: titleLine },
              nowStage && { color: color.accent },
              !done && !nowStage && { color: color.ink2 },
            ]}
          >
            {nowStage ? t('project.stageNow', { stage: s.label }) : s.label}
          </Text>
          <Text style={styles.mono}>
            {line}
            {typeof tracked?.progressPct === 'number' && tracked.steps ? ` · ${t('project.stagePct', { n: tracked.progressPct })}` : ''}
          </Text>
          {tracked ? <MovedNote stage={tracked} t={t} /> : null}
          {/* Customer milestones: every stage shows its starred steps; the current one also its bar. */}
          {tracked?.steps?.length && nowStage ? (
            <StageSteps steps={tracked.steps} pct={tracked.progressPct ?? 0} t={t} />
          ) : tracked?.steps?.length ? (
            <MilestoneLine steps={tracked.steps} t={t} />
          ) : nowStage && !tracked?.steps && current ? (
            <StageChecklist current={current} t={t} />
          ) : null}
          {s.late ? (
            <View style={styles.lateCard}>
              <Text style={styles.lateEyebrow}>{done ? t('project.lateDone.eyebrow') : t('project.late.eyebrow')}</Text>
              <Text style={styles.lateBody}>{done ? t('project.lateDone.body', { date }) : (assured ? t('project.late.body', { date }) : t('plan.basic.late', { date, studio }))}</Text>
            </View>
          ) : null}
          {decision ? (
            <Press onPress={() => onDecision(decision)} haptic={false} accessibilityRole="link" style={styles.chooseLink}>
              <Text style={styles.chooseText}>{t('project.chooseLink', { title: decision.title })}</Text>
              <ArrowIcon color={color.ink} size={14} />
            </Press>
          ) : null}
        </View>
      </View>
    </Stagger>
  );
}

/**
 * The payments card. Phase 5: with `payments` (servers since the studio
 * workspace), each stage's line comes from the studio's recorded entries —
 * waiting for you, part paid, paid — the last stage says what your decisions
 * added, and each entry the studio marked received asks you to confirm it.
 */
function Payments({
  money,
  changes,
  payments,
  onChanged,
  t,
}: {
  money: Money;
  changes: ProjectData['changes'];
  payments: PaymentsData | null;
  onChanged: () => void;
  t: T;
}) {
  const n = changes?.items.length ?? 0;
  const ledger = (i: number) => payments?.stages.find((x) => x.index === i) ?? null;
  const signed = (paise: number) => (paise < 0 ? t('decision.less', { amount: inr(-paise) }) : `+${inr(paise)}`);
  return (
    <Card>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{t('project.payments')}</Text>
        <Meta>{t('project.youPay')}</Meta>
      </View>
      {money.stages.map((s) => (
        <View key={s.index} style={styles.payRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.payLabel, s.state === 'next' && { color: color.accentInk }]}>{s.label}</Text>
            <Text style={[styles.mono, s.state === 'paid' && { color: color.ok }]}>
              {s.paidOn
                ? t('project.payPaid', { date: shortDate(s.paidOn) })
                : ledger(s.index)?.state === 'waiting'
                  ? t('pay.stageWaiting')
                  : ledger(s.index)?.state === 'part'
                    ? t('pay.stagePart', { paid: inr(ledger(s.index)!.paidPaise), total: inr(s.amountPaise) })
                : s.dueOn
                  ? t('project.payDue', { date: shortDate(s.dueOn) })
                  : s.state === 'next'
                    ? t('project.payNext')
                    : t('project.payLater')}
            </Text>
            {ledger(s.index)?.changesPaise ? <Text style={styles.mono}>{t('pay.includesChanges', { amount: signed(ledger(s.index)!.changesPaise) })}</Text> : null}
          </View>
          <Text style={styles.amt}>{inr(s.amountPaise)}</Text>
        </View>
      ))}
      {payments ? <PaymentEntries payments={payments} onChanged={onChanged} t={t} /> : null}
      {changes ? (
        <View style={styles.payRow}>
          <Text style={[styles.payLabel, { flex: 1 }]}>{t('project.changes')}</Text>
          <Text style={styles.amt}>
            {n === 0 || !changes.totalPaise
              ? t('project.changesNone')
              : changes.totalPaise < 0
                ? signed(changes.totalPaise)
                : n === 1
                  ? t('project.changesOne', { amount: inr(changes.totalPaise) })
                  : t('project.changesMany', { amount: inr(changes.totalPaise), n })}
          </Text>
        </View>
      ) : null}
      <Text style={styles.note}>{t('project.payNote')}</Text>
    </Card>
  );
}

/* The late note's warm tints are the design's own (Tracker.dc.html), not theme tokens. */
const LATE_BG = '#F5E2D8';
const LATE_EYEBROW = '#8E3B1B';
const LATE_TEXT = '#4A2A1C';
const RING_LATER = '#B9B7B1';

const styles = StyleSheet.create({
  row3: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 10 },
  snagTile: { flex: 1, minHeight: 112, backgroundColor: color.soft, borderRadius: 24, padding: 14, gap: 8 },
  decisionTile: { flex: 1, minHeight: 112, backgroundColor: color.ink, borderRadius: 18, padding: 14, gap: 8 },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  tileTitle: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  tileSub: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2, marginTop: -6 },

  tlInner: { flexDirection: 'row', gap: 16 },
  rail: { width: 18, alignItems: 'center' },
  node: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  nodeNow: { backgroundColor: color.paper, borderWidth: 2, borderColor: color.accent },
  nodeLater: { borderWidth: 1.5, borderColor: RING_LATER },
  stageBody: { flex: 1, paddingBottom: 22, gap: 6 },
  stageTitle: { fontFamily: font.sansSemi, fontSize: 18, letterSpacing: -0.36, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: color.ink2 },
  lateCard: { backgroundColor: LATE_BG, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  lateEyebrow: { fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: LATE_EYEBROW },
  lateBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: LATE_TEXT },
  chooseLink: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chooseText: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.ink },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  cardTitle: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  payLabel: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  amt: { fontFamily: font.monoMedium, fontSize: 13.5, color: color.ink, textAlign: 'right', flexShrink: 1 },
  wholePlan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, backgroundColor: color.soft },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 20, color: color.ink2 },
  progressPct: { fontFamily: font.mono, fontSize: 24, color: color.ink },

});
