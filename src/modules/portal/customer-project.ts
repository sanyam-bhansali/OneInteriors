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
import { CUSTOMER_PROJECT_SELECT, NO_LINKS, toCustomerProject, type CustomerProject } from './customer-project-view';

export type { CustomerDecision, CustomerDocument, CustomerProject, CustomerSnag } from './customer-project-view';

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
      const [updatePhotos, snagPhotos, fixedPhotos, docUrls] = await Promise.all([
        Promise.all(p.updates.map((u) => signedSitePhotoUrls(u.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.photoPaths))),
        Promise.all(p.snags.map((s) => signedSitePhotoUrls(s.fixedPhotoPaths))),
        signedDocUrls(p.documents.map((d) => d.storageKey)),
      ]);
      return toCustomerProject(p, userId, now, { updatePhotos, snagPhotos, fixedPhotos, docUrls });
    }),
  );
}
