'use server';

/**
 * Book the expert call in one tap. The booking itself is
 * `modules/consultation/book.ts`, shared with the phone app's
 * `POST /api/app/v1/expert/book`, so there is one way a call gets booked.
 */

import { bookExpertCall, type BookResult } from '@/modules/consultation/book';

export type { BookResult };

export async function bookExpertCallAction(input: { startsAt: string; studioIds: string[] }): Promise<BookResult> {
  return bookExpertCall(input);
}
