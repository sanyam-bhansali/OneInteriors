import 'server-only';

/**
 * The requirement form — reads and writes (walkthrough, 27 Oct 2026; owner,
 * 1 Nov 2026). The designer sends it from the project's Design tab (it is
 * the mood-board step's task, ticked by sending); the client fills it in the
 * app, once; the studio reads the answers on the project. The questions and
 * every check are requirement-form-rules.ts.
 */

import { prisma } from '@/lib/prisma';
import { notify, notifyStudio } from '@/modules/notify/service';
import { memberOnProject } from '@/modules/studio/access';
import { recordEvent } from '@/modules/project/events';
import { istDay } from '@/modules/project/working-days';
import {
  FORM_INTRO,
  FORM_TITLE,
  SECTIONS,
  answersBySection,
  checkAnswers,
  formState,
  isRequirementFormTask,
  readAnswers,
  type Answers,
  type FormState,
  type Section,
} from './requirement-form-rules';

export type FormResult = { ok: true; message: string } | { ok: false; error: string };

/** What the studio sees on the project. Null when the member may not read it. */
export interface StudioRequirementForm {
  projectId: string;
  state: FormState;
  sentOn: string | null;
  filledOn: string | null;
  answers: { title: string; rows: { label: string; answer: string }[] }[];
  /** May send it (`design.work`) and it has not been sent. */
  canSend: boolean;
}

export async function studioRequirementForm(projectId: string): Promise<StudioRequirementForm | null> {
  const check = await memberOnProject(projectId);
  if (!check.ok) return null;
  const row = await prisma.homeRequirementForm.findFirst({
    where: { projectId, studioId: check.member.studioId },
    select: { sentAt: true, submittedAt: true, answers: true },
  });
  const state = formState(row);
  return {
    projectId,
    state,
    sentOn: row?.sentAt ? istDay(row.sentAt) : null,
    filledOn: row?.submittedAt ? istDay(row.submittedAt) : null,
    answers: row?.submittedAt ? answersBySection(readAnswers(row.answers)) : [],
    canSend: state === 'not-sent' && check.access.may('design.work'),
  };
}

/** Sends the form to the client, once; ticks the mood-board step's "send the requirement form" task. */
export async function sendRequirementForm(projectId: string, now = new Date()): Promise<FormResult> {
  const check = await memberOnProject(projectId, 'design.work');
  if (!check.ok) return check;
  const p = await prisma.homeProject.findFirst({
    where: { id: projectId, cancelledAt: null, introduction: { studioId: check.member.studioId } },
    select: { introduction: { select: { studioId: true, studio: { select: { tradeName: true } }, brief: { select: { userId: true } } } } },
  });
  if (!p) return { ok: false, error: 'That project is not one of yours.' };
  const studioId = p.introduction.studioId;
  const sent = await prisma.$transaction(async (tx) => {
    const had = await tx.homeRequirementForm.findFirst({ where: { projectId, studioId }, select: { id: true } });
    if (had) return false;
    await tx.homeRequirementForm.create({ data: { projectId, studioId, sentAt: now, sentById: check.member.userId } });
    const tasks = await tx.homeStepTask.findMany({ where: { doneAt: null, step: { stage: { projectId } } }, select: { id: true, label: true } });
    const ids = tasks.filter((x) => isRequirementFormTask(x.label)).map((x) => x.id);
    if (ids.length) await tx.homeStepTask.updateMany({ where: { id: { in: ids }, doneAt: null }, data: { doneAt: now, doneById: check.member.userId } });
    await recordEvent(tx, { projectId, type: 'requirements.sent', actor: { type: 'STUDIO', id: check.member.userId }, refId: projectId });
    return true;
  });
  if (!sent) return { ok: true, message: 'Already sent.' };
  /* A client who has not joined yet finds it on their project when they do. */
  const to = p.introduction.brief.userId;
  if (to) void notify(to, { kind: 'design', studio: p.introduction.studio.tradeName, title: 'Your requirement form: fill it in before the design starts.' }).catch(() => {});
  return { ok: true, message: 'Sent. The client fills it in their app; you see the answers here.' };
}

/** What the client sees: the form to fill, or what they sent. Null when no form was sent to them. */
export interface CustomerRequirementForm {
  projectId: string;
  studio: string;
  title: string;
  intro: string;
  state: Exclude<FormState, 'not-sent'>;
  filledOn: string | null;
  sections: readonly Section[];
  /** Filled in for them where we know it (their name and the home's address), else what they sent. */
  answers: Answers;
}

export async function customerRequirementForm(userId: string): Promise<CustomerRequirementForm | null> {
  const row = await prisma.homeRequirementForm.findFirst({
    where: { project: { cancelledAt: null, introduction: { brief: { userId } } } },
    orderBy: { sentAt: 'desc' },
    select: {
      projectId: true,
      submittedAt: true,
      answers: true,
      project: {
        select: {
          introduction: {
            select: {
              studio: { select: { tradeName: true } },
              brief: { select: { contactName: true, society: true, locality: true, user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  const b = row.project.introduction.brief;
  const prefill: Answers = {};
  const name = b.contactName?.trim() || b.user?.name?.trim();
  if (name) prefill.clientName = name;
  const address = [b.society, b.locality].map((x) => x?.trim()).filter(Boolean).join(', ');
  if (address) prefill.address = address;
  return {
    projectId: row.projectId,
    studio: row.project.introduction.studio.tradeName,
    title: FORM_TITLE,
    intro: FORM_INTRO,
    state: row.submittedAt ? 'filled' : 'sent',
    filledOn: row.submittedAt ? istDay(row.submittedAt) : null,
    sections: SECTIONS,
    answers: row.submittedAt ? readAnswers(row.answers) : prefill,
  };
}

/** The client sends the form: every question answered, once. The owner of the brief only. */
export async function submitRequirementForm(userId: string, raw: unknown, now = new Date()): Promise<FormResult & { questionId?: string }> {
  const checked = checkAnswers(raw);
  if (!checked.ok) return checked;
  const row = await prisma.homeRequirementForm.findFirst({
    where: { submittedAt: null, project: { cancelledAt: null, introduction: { brief: { userId } } } },
    orderBy: { sentAt: 'desc' },
    select: { id: true, projectId: true, studioId: true, project: { select: { designer: { select: { userId: true } } } } },
  });
  if (!row) return { ok: false, error: 'There is no form waiting for you. It may already be sent in.' };
  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.homeRequirementForm.updateMany({
      where: { id: row.id, studioId: row.studioId, submittedAt: null },
      data: { answers: checked.answers, submittedAt: now, submittedById: userId },
    });
    if (count === 0) return false;
    await recordEvent(tx, { projectId: row.projectId, type: 'requirements.filled', actor: { type: 'CUSTOMER', id: userId }, refId: row.id });
    return true;
  });
  if (!done) return { ok: false, error: 'This form is already sent in.' };
  const event = { kind: 'requirements-filled' as const, projectId: row.projectId };
  void (async () => {
    await notifyStudio(row.studioId, event);
    if (row.project.designer?.userId) await notify(row.project.designer.userId, event, { email: false });
  })().catch((e) => console.error('[requirement-form] notice failed', e));
  return { ok: true, message: 'Sent. Thank you: your designer starts from these answers.' };
}
