import type { Entry } from './entry';

/** Words inside the shared parts (components/ui.tsx, brand.tsx). First draft: Sanyam reviews. */
export const kit = {
  'kit.back': { en: 'Back', hi: 'वापस', mr: 'मागे' },
  'kit.coinsPlus': { en: '+{n} coins', hi: '+{n} कॉइन', mr: '+{n} कॉइन' },
  'kit.coinsEarned': { en: '{n} coins earned', hi: '{n} कॉइन मिले', mr: '{n} कॉइन मिळाले' },
  'kit.coinChip': { en: 'Home Coins, {n}', hi: 'होम कॉइन, {n}', mr: 'होम कॉइन, {n}' },
  'kit.remove': { en: 'Remove', hi: 'हटाएँ', mr: 'काढा' },
  'kit.rank': { en: 'Rank {label}', hi: '{label} को क्रम दें', mr: '{label} ला क्रम द्या' },
} satisfies Record<string, Entry>;
