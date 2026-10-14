import 'server-only';

/**
 * The server half of "Set up your studio" (setup-quiz.ts is the pure half).
 *
 * The owner's alone: every function here refuses anyone else. It reads the
 * studio's current settings, plans the changes the answers would make, and
 * applies only those the owner ticked, each through the function the
 * Settings screen itself calls (lead sources, the Hauspire pipeline preset,
 * payment stages, design steps, the quotation defaults, the owner's home), so
 * every permission check and validation of those still holds. The answers
 * and the outcome are kept on `Studio.setupQuiz`.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { currentMember, type StudioMemberRef } from './access';
import { mayOpen, TEAM_PATH } from './surfaces';
import { myHomePrefs, saveMyHomePrefs } from './profile';
import { addLeadSource, myLeadSources, savePaymentTemplate } from '@/modules/studio-sales/settings';
import { applyHauspirePipeline, myStages } from '@/modules/studio-practice/stages';
import { resetDesignTemplate, saveDesignTemplate } from '@/modules/studio-design/design-flow';
import { myBranding, saveBranding } from '@/modules/studio-quote/store';
import {
  QUIZ_VERSION,
  parseAnswers,
  planSetup,
  readQuizRecord,
  type QuizAnswers,
  type QuizRecord,
  type SetupChange,
  type SetupPlan,
  type StudioNow,
} from './setup-quiz';

const OWNER_ONLY = 'Only the studio owner sets the studio up.';

async function owner(): Promise<StudioMemberRef | null> {
  const member = await currentMember();
  return member && member.status === 'ACTIVE' && member.role === 'OWNER' ? member : null;
}

async function studioNow(member: StudioMemberRef): Promise<StudioNow> {
  const [sources, stages, row, branding, prefs] = await Promise.all([
    myLeadSources(),
    myStages(),
    prisma.studio.findUnique({ where: { id: member.studioId }, select: { paymentTemplate: true, designTemplate: true } }),
    myBranding(),
    myHomePrefs(member.id),
  ]);
  return {
    full: member.fullSoftware === true,
    customSources: sources.map((s) => s.name),
    stages: stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind, isIntake: s.isIntake, sortOrder: s.sortOrder })),
    paymentTemplate: row?.paymentTemplate ?? null,
    designTemplate: row?.designTemplate ?? null,
    branding: branding
      ? { discountBps: branding.discountBps, feeBps: branding.feeBps, gstBps: branding.gstBps, validityDays: branding.validityDays, materialSpec: branding.materialSpec }
      : null,
    homeOrder: prefs.order,
  };
}

export interface SetupView {
  record: QuizRecord | null;
  /** Team is open to this studio (the full software): the quiz offers to invite people. */
  teamOpen: boolean;
  full: boolean;
}

/** What the quiz page needs, or null for anyone but the owner. */
export async function mySetup(): Promise<SetupView | null> {
  const member = await owner();
  if (!member) return null;
  const row = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { setupQuiz: true } });
  return { record: readQuizRecord(row?.setupQuiz ?? null), teamOpen: mayOpen(member, TEAM_PATH), full: member.fullSoftware === true };
}

/** The changes these answers would make now. */
export async function previewSetup(raw: unknown): Promise<{ ok: true; plan: SetupPlan } | { ok: false; error: string }> {
  const member = await owner();
  if (!member) return { ok: false, error: OWNER_ONLY };
  return { ok: true, plan: planSetup(parseAnswers(raw), await studioNow(member)) };
}

async function record(studioId: string, rec: Omit<QuizRecord, 'v' | 'at'>): Promise<void> {
  const value = { v: QUIZ_VERSION, at: new Date().toISOString(), ...rec };
  await prisma.studio.update({ where: { id: studioId }, data: { setupQuiz: value as unknown as Prisma.InputJsonValue } });
}

/** "Skip for now": the home keeps a small "Set up your studio" card. A quiz already done stays done. */
export async function skipSetup(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await owner();
  if (!member) return { ok: false, error: OWNER_ONLY };
  const row = await prisma.studio.findUnique({ where: { id: member.studioId }, select: { setupQuiz: true } });
  if (readQuizRecord(row?.setupQuiz ?? null)?.status === 'done') return { ok: true };
  await record(member.studioId, { status: 'skipped', answers: raw ? parseAnswers(raw) : null, applied: [] });
  return { ok: true };
}

export interface ApplyOutcome {
  ok: true;
  applied: { id: string; title: string }[];
  failed: { id: string; title: string; error: string }[];
}

/**
 * Apply the ticked changes. The plan is worked out again here from the
 * settings as they are now (never trusted from the browser), and a ticked
 * id that is not in it is ignored.
 */
export async function applySetup(raw: unknown, ticked: unknown): Promise<ApplyOutcome | { ok: false; error: string }> {
  const member = await owner();
  if (!member) return { ok: false, error: OWNER_ONLY };
  const answers: QuizAnswers = parseAnswers(raw);
  const ids = new Set(Array.isArray(ticked) ? ticked.filter((x): x is string => typeof x === 'string') : []);
  const plan = planSetup(answers, await studioNow(member));
  const chosen = plan.changes.filter((c) => ids.has(c.id));

  const applied: ApplyOutcome['applied'] = [];
  const failed: ApplyOutcome['failed'] = [];
  const note = (c: SetupChange, r: { ok: true } | { ok: false; error: string }) => {
    if (r.ok) applied.push({ id: c.id, title: c.title });
    else failed.push({ id: c.id, title: c.title, error: r.error });
  };

  for (const c of chosen) {
    if (c.kind === 'source') note(c, await addLeadSource(c.name));
    else if (c.kind === 'pipeline') note(c, await applyHauspirePipeline());
    else if (c.kind === 'payments') note(c, await savePaymentTemplate(c.stages));
    else if (c.kind === 'design') note(c, c.steps === null ? await resetDesignTemplate() : await saveDesignTemplate(c.steps));
    else if (c.kind === 'home') {
      const prefs = await myHomePrefs(member.id);
      const r = await saveMyHomePrefs({ ...prefs, order: c.order });
      note(c, r.ok ? { ok: true } : r);
    }
  }

  /* The quotation defaults in one save, carrying every other field as it is. */
  const quote = chosen.filter((c) => c.kind === 'discount' || c.kind === 'fee' || c.kind === 'gst' || c.kind === 'validity' || c.kind === 'materials');
  if (quote.length > 0) {
    const b = await myBranding();
    if (!b) {
      for (const c of quote) failed.push({ id: c.id, title: c.title, error: 'Finish your registration first — a quotation has to carry the name we checked you against.' });
    } else {
      const input = {
        phone: b.phone ?? '',
        email: b.email ?? '',
        website: b.website ?? '',
        welcomeNote: b.welcomeNote ?? '',
        feeBps: b.feeBps,
        discountBps: b.discountBps,
        bookingAdvancePaise: b.bookingAdvancePaise,
        gstBps: b.gstBps,
        materialSpec: b.materialSpec,
        validityDays: b.validityDays,
      };
      for (const c of quote) {
        if (c.kind === 'discount') input.discountBps = c.bps;
        if (c.kind === 'fee') input.feeBps = c.on ? 700 : 0;
        if (c.kind === 'gst') input.gstBps = c.on ? 1800 : 0;
        if (c.kind === 'validity') input.validityDays = c.days;
        if (c.kind === 'materials') input.materialSpec = c.rows;
      }
      const r = await saveBranding(input);
      for (const c of quote) note(c, r);
    }
  }

  await record(member.studioId, { status: 'done', answers, applied: applied.map((a) => a.id) });
  return { ok: true, applied, failed };
}
