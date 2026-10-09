import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { Wrap } from '@/components/oi';
import { waitLine } from '@/lib/wait-lines';
import { getLang } from '@/modules/i18n/server';
import { translator } from '@/modules/i18n/site';
import { EXPERT_DICT } from '@/modules/i18n/site/expert';

/**
 * The wait before the expert request form.
 *
 * The shortest of the three, on purpose. This route re-prices in order to show
 * the customer which studios they are choosing between, but by now they have
 * seen the numbers twice and narrating the pricing again would be padding —
 * and padding is the exact thing the labour illusion stops being honest at.
 *
 * The live objection here is different again, and it is the one that stops
 * people booking: *is this going to be a sales call?* Everyone reading this has
 * been on the other kind. So the line names what will not happen. See
 * wait-lines.ts.
 *
 * It carries the same chrome and the same spine position as the loaded page,
 * because a loading screen built out of different furniture makes the layout
 * jump the moment content arrives, and a jump reads as a glitch.
 */
export default async function ExpertLoading() {
  const t = translator(await getLang(), EXPERT_DICT);
  return (
    <div className="oi-app min-h-dvh bg-[var(--bg)]">
      <AppHeader />
      <Spine at="expert" />

      <Wrap className="py-16">
        <p className="oi-eyebrow m-0 mb-5">{t('ch.eyebrow')}</p>
        <h1 className="oi-display m-0 mb-8 max-w-[20ch] text-[clamp(1.75rem,1.1rem+2.1vw,2.6rem)]">
          {t('loading.h1')}
        </h1>

        <p className="m-0 max-w-[54ch] border-l-2 border-[var(--line)] pl-5 text-[16px] leading-[1.6] text-[var(--ink2)]">
          {waitLine('expert')}
        </p>
      </Wrap>

      <AppFooter />
    </div>
  );
}
