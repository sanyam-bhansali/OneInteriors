'use client';

import { useRouter } from 'next/navigation';
import { LANGS, type Lang } from '@/modules/i18n/site';
import { STUDIO_LANG_LABEL } from '@/modules/i18n/studio';
import { setLang } from '@/components/app/i18n';

/**
 * EN / हिं / मरा, for the studio screens a site team uses (sign-in, site
 * mode). Keeps the choice in the same `oa.lang` cookie as the customer site.
 * Without `onPick` it re-renders the page in the new language.
 */
export function LangSwitch({ value, onPick }: { value: Lang; onPick?: (lang: Lang) => void }) {
  const router = useRouter();
  return (
    <div role="radiogroup" aria-label="Language" className="flex gap-0.5 rounded-full bg-[var(--s-surface)] p-[3px] shadow-[var(--s-lift)]">
      {LANGS.map(({ id }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={STUDIO_LANG_LABEL[id].full}
          onClick={() => {
            setLang(id);
            if (onPick) onPick(id);
            else router.refresh();
          }}
          className={`min-h-9 min-w-11 rounded-full px-2 text-[14px] font-medium ${
            value === id ? 'bg-[var(--s-accent)] text-white' : 'text-[var(--s-ink-2)]'
          }`}
        >
          {STUDIO_LANG_LABEL[id].short}
        </button>
      ))}
    </div>
  );
}
