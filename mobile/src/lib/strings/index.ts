import { decision } from './decision';
import { geio } from './geio';
import { home } from './home';
import { journey } from './journey';
import { kit } from './kit';
import { locker } from './locker';
import { me } from './me';
import { notifications } from './notifications';
import { plan } from './plan';
import { matchesWords } from './matches';
import { quoteWords } from './quote';
import { chooseWords } from './choose';
import { project } from './project';
import { signin } from './signin';
import { site } from './site';
import { snags } from './snags';
import { welcome } from './welcome';

/**
 * The phone app's own words, one file per screen so screens can grow their
 * copy without touching each other. Words the website's /app shares live in
 * `../i18n-dict.ts` (a copy of src/modules/app/i18n-dict.ts, kept identical
 * by tests/mobile-i18n.test.ts); a key here must not repeat one there.
 */
export const NATIVE = {
  ...kit,
  ...welcome,
  ...journey,
  ...signin,
  ...home,
  ...project,
  ...decision,
  ...snags,
  ...site,
  ...me,
  ...locker,
  ...notifications,
  ...geio,
  ...plan,
  ...matchesWords,
  ...quoteWords,
  ...chooseWords,
};
