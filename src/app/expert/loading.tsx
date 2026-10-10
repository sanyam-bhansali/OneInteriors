import { AppFooter, AppHeader, Spine } from '@/components/oi/Chrome';
import { FlowShell } from '@/components/home/FlowShell';
import { Split } from '@/components/home/parts';
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
    <FlowShell>
      <AppHeader />
      <Spine at="expert" />

      {/* The same black block the page opens with, so nothing jumps. */}
      <main className="mx-auto w-full max-w-[1040px] px-[var(--gutter)] pb-[clamp(48px,7vw,100px)] pt-[clamp(24px,4vw,48px)]">
        <section
          className="panel-dark overflow-hidden rounded-[var(--r-xl)] px-[clamp(22px,4.4vw,64px)] py-[clamp(28px,4.6vw,64px)]"
          data-reveal=""
          data-auto=""
        >
          <p className="eyebrow">{t('ch.eyebrow')}</p>
          <Split as="h1" className="h-l max-w-[18ch]" text={t('loading.h1')} auto />
          <p className="m-0 mt-[clamp(20px,3vw,32px)] max-w-[54ch] text-[clamp(15px,0.9rem+0.2vw,17px)] leading-[1.6] text-white/70">
            {waitLine('expert')}
          </p>
        </section>
      </main>

      <AppFooter />
    </FlowShell>
  );
}
