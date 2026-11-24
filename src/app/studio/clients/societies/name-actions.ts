'use server';

import { guarded } from '@/lib/action-guard';

import { mySocietyAccess, societyNames } from '@/modules/studio-practice/societies';

/** The studio's society names, for the lead forms' suggestions. Empty off the Max plan. */
export async function societyNamesAction(): Promise<string[]> {
  return guarded('societyNamesAction', [], async () => {
  const access = await mySocietyAccess();
  return access ? societyNames(access.scope.studioId) : [];
});
}
