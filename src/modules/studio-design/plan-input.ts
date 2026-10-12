import 'server-only';

/**
 * What a new project's DESIGN stage is built from (Studio OS Phase 2): the
 * studio's design steps and the flat size. Read before the signing or
 * booking transaction by project/own-project.ts and portal/choose.ts, and
 * passed to `createSignedProject`. Never fails a signing: if the studio's
 * template or the brief cannot be read, the project gets Hauspire's steps
 * and design keeps its usual share of the days.
 */

import { prisma } from '@/lib/prisma';
import type { DesignPlanInput } from '@/modules/portal/quote-to-plan';
import { bhkOf, readDesignTemplate } from './template';

export async function designPlanInput(studioId: string, home: { propertyType?: string | null; briefId?: string | null }): Promise<DesignPlanInput> {
  let template: DesignPlanInput['template'] = null;
  let propertyType = home.propertyType ?? null;
  try {
    const s = await prisma.studio.findUnique({ where: { id: studioId }, select: { designTemplate: true } });
    template = s?.designTemplate ? readDesignTemplate(s.designTemplate) : null;
  } catch {
    template = null;
  }
  if (!propertyType && home.briefId) {
    try {
      const b = await prisma.brief.findUnique({ where: { id: home.briefId }, select: { propertyType: true } });
      propertyType = b?.propertyType ?? null;
    } catch {
      propertyType = null;
    }
  }
  return { template, bhk: bhkOf(propertyType) };
}
