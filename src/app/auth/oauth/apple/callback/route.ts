import { completeApple } from '@/modules/auth/oauth';

/** Apple posts the answer back as a form (response_mode=form_post). */
export async function POST(request: Request) {
  return completeApple(request);
}
