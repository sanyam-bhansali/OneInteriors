import 'server-only';
import { cookies } from 'next/headers';
import { LANG_COOKIE, asLang, type Lang } from './site';

/** The visitor's language, for a server-rendered page. Reading it makes the page dynamic. */
export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}
