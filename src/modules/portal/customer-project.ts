import 'server-only';

/**
 * The one projection of a customer's project that the phone app
 * (`/api/app/v1/project`), the laptop site and GEIO read. Everything the
 * studio records lands on the same `HomeProject` rows; this file decides
 * which of it the customer sees. The rules — what is selected and how each
 * field is built — are in the pure `customer-project-view.ts`, tested by
 * tests/customer-projection.test.ts.
 *
 * Moved here from project-store.ts (studio workspace Phase 1), which still
 * re-exports it so no caller had to change.
 */

import { prisma } from '@/lib/prisma';
import { signedSitePhotoUrls } from '@/modules/storage/site-photos';
import { signedDocUrls } from '@/modules/storage/project-docs';
import { siteLogPhotoLinks } from '@/modules/project/site-log-storage';
import { CUSTOMER_PROJECT_SELECT, NO_LINKS, toCustomerProject, type CustomerProject } from './customer-project-view';

export type { CustomerDecision, CustomerDocument, CustomerProject, CustomerSnag } from './customer-project-view';

/** Whether this person has a project to open (their own, or one they joined as family). For the app's door (app/app/layout.tsx). */
export async function hasLiveProject(userId: string): Promise<boolean> {
  const n = await prisma.homeProject.count({
    where: {
      cancelledAt: null,
      OR: [{ introduction: { brief: { userId } } }, { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } }],
    },
  });
  return n > 0;
}

/**
 * Every project on this customer's brief, or one they joined as family,
 * newest first. Empty when they have none yet.
 *
 * `links: false` leaves photo and document links empty instead of signing
 * them: GEIO reads the project on every question and never shows a photo, so
 * it should not cost a storage round trip per picture.
 */
export async function customerProjects(userId: string, now = new Date(), opts: { links?: boolean } = {}): Promise<CustomerProject[]> {
  const links = opts.links !== false;
  const projects = await prisma.homeProject.findMany({
    where: {
      // A refunded booking (Studio OS Phase 1) is kept but is not their project any more.
      cancelledAt: null,
      OR: [
        { introduction: { brief: { userId } } },
        { family: { some: { userId, joinedAt: { not: null }, removedAt: null } } },
      ],
    },
    orderBy: { startOn: 'desc' },
    select: CUSTOMER_PROJECT_SELECT,
  });
  return Promise.all(
    projects.map(async (p) => {
      if (!links) return toCustomerProject(p, userId, now, NO_LINKS);
      const [updatePhotos, snagPhotos, fixedPhotos, docUrls, choicePhotos] = await Promise.all([
        Promise.all(p.updates.map((u) => signedSitePhotoUrls(u.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.fixedPhotoPaths))),
        signedDocUrls(p.documents.map((d) => d.storageKey)),
        Promise.all(p.decisions.map((d) => choicePhotoLinks(d.choices))),
      ]);
      const siteLogPhotos = await siteLogPhotoLinks(p.siteLogs); // Phase 2
      return toCustomerProject(p, userId, now, { updatePhotos, snagPhotos, fixedPhotos, docUrls, choicePhotos, siteLogPhotos });
    }),
  );
}

/**
 * One project exactly as its customer (the owner of the brief) sees it in
 * the app right now — the same select and the same mapper, so the studio's
 * "What {customer} sees right now" panel cannot show a different truth.
 * Links are left empty: the panel shows counts and words, not files.
 *
 * Reads without checking who is asking. The caller must already have
 * authorised the studio member on this project (studio/workspace.ts does,
 * through studio/access.ts `memberOnProject`).
 */
export async function customerViewOf(projectId: string, now = new Date()): Promise<CustomerProject | null> {
  const row = await prisma.homeProject.findUnique({ where: { id: projectId }, select: CUSTOMER_PROJECT_SELECT });
  if (!row) return null;
  return toCustomerProject(row, row.introduction.brief.userId ?? '', now, NO_LINKS);
}

/** Phase 5: each decision option's photo as a signed link, in option order; "" where there is none. */
async function choicePhotoLinks(choices: { photoPath: string | null }[]): Promise<string[]> {
  const paths = choices.map((c) => c.photoPath).filter((x): x is string => Boolean(x));
  if (paths.length === 0) return choices.map(() => '');
  const signed = await signedSitePhotoUrls(paths);
  // signedSitePhotoUrls drops a link it could not make; then none can be matched to its option safely.
  if (signed.length !== paths.length) return choices.map(() => '');
  let k = 0;
  return choices.map((c) => (c.photoPath ? signed[k++]! : ''));
}
