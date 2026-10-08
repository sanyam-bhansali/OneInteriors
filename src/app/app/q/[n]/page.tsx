'use client';

/**
 * Quiz 1–7 (the owner's v1 screens): home, scope, budget, style, household,
 * priorities, involvement. One question a screen, the answer written to the
 * same brief the website uses, so matching and pricing are unchanged.
 */

import { useParams, useRouter } from 'next/navigation';
import { Body, Cta, Foot, Frame, Head, Progress, useBrief } from '@/components/app/ui';
import {
  PUNE_LOCALITIES,
  STYLE_LABELS,
  STYLE_TAGS,
  type Brief,
  type Involvement,
  type PriorityFactor,
  type PropertyType,
  type ScopeType,
} from '@/modules/brief/types';
import { carpetAreaFor } from '@/modules/brief/steps';
import { TIER, TIERS, tierRangeFor, type Tier } from '@/modules/quotation/tiers';
import { roomsFor } from '@/modules/quotation/scope';
import { ROOM_LABELS } from '@/modules/quotation/catalogue';
import { BEDROOMS } from '@/modules/quotation/estimate';
import { STYLE_PHOTOS } from '@/data/style-photos';
import { formatINRCompact } from '@/lib/money';
import { saveBriefAction } from '@/app/quiz/actions';

const TOTAL = 7;

const HOMES: { value: PropertyType; label: string }[] = [
  { value: 'BHK_1', label: '1 BHK' },
  { value: 'BHK_2', label: '2 BHK' },
  { value: 'BHK_3', label: '3 BHK' },
  { value: 'BHK_4_PLUS', label: '4+ BHK' },
  { value: 'VILLA', label: 'Villa / Row house' },
];

/** The areas people pick most; the rest are a tap away. */
const POPULAR = ['kharadi', 'baner', 'wakad', 'hinjewadi', 'kothrud', 'viman-nagar', 'aundh', 'hadapsar', 'balewadi', 'undri', 'ravet', 'magarpatta'];

const SCOPES: { value: ScopeType; title: string; sub: string }[] = [
  { value: 'FULL_HOME', title: 'Full home', sub: 'Every room, from bare walls to handover' },
  { value: 'KITCHEN_WARDROBE', title: 'Kitchen & wardrobes', sub: 'The two jobs that need a carpenter most' },
  { value: 'SINGLE_ROOM', title: 'One room', sub: 'A bedroom, the living room, a study' },
  { value: 'RENOVATION', title: 'Renovation', sub: 'Change what is already there' },
];

const TIER_TAG: Record<Tier, string> = { ESSENTIAL: 'Good value', PREMIUM: 'Most chosen', LUXURY: 'Made to order' };
const TIER_LINE: Record<Tier, string> = {
  ESSENTIAL: 'Everything you need, made well',
  PREMIUM: 'Better materials where they are touched',
  LUXURY: 'Made to your drawings, in the materials you chose',
};

const PRIORITIES: { value: PriorityFactor; title: string; sub: string }[] = [
  { value: 'SPEED', title: 'Finishing on time', sub: 'Weighs each studio’s delivery record' },
  { value: 'DESIGN_AMBITION', title: 'Design ambition', sub: 'Bolder, more personal past work' },
  { value: 'BUDGET', title: 'Staying in budget', sub: 'Final bills that match the quote' },
  { value: 'MATERIAL_QUALITY', title: 'Material quality', sub: 'Better boards, hardware and finishes' },
];

const INVOLVEMENT: { value: Involvement; title: string; sub: string }[] = [
  { value: 'DECIDE_FOR_ME', title: 'Decide most things for me', sub: 'Studios that lead with a clear design of their own' },
  { value: 'COLLABORATE', title: 'Work through it together', sub: 'Regular reviews; you sign off the key choices' },
  { value: 'APPROVE_EVERYTHING', title: 'I want to approve every detail', sub: 'Every finish and fitting comes to you first' },
];

function answered(brief: Brief, n: number): boolean {
  switch (n) {
    case 1:
      return brief.propertyType !== null && brief.locality !== null;
    case 2:
      return brief.scope !== null && (brief.scope !== 'SINGLE_ROOM' || brief.scopeRooms.length > 0);
    case 3:
      return brief.tier !== null;
    case 4:
      return brief.styleLikes.length >= 2;
    case 5:
      return true;
    case 6:
      return brief.priorityRanking.length === 4;
    case 7:
      return brief.involvement !== null;
    default:
      return false;
  }
}

export default function AppQuestion() {
  const router = useRouter();
  const n = Math.min(TOTAL, Math.max(1, Number(useParams<{ n: string }>().n) || 1));
  const [brief, update] = useBrief();
  if (!brief) return <Frame>{null}</Frame>;

  const next = () => {
    if (n < TOTAL) {
      update({ lastStep: n + 1 });
      router.push(`/app/q/${n + 1}`);
      return;
    }
    // The last answer: the brief is complete, kept on the server too when
    // there is one, then the matches.
    const done = { ...brief, completedAt: new Date().toISOString(), lastStep: 12 };
    update(done);
    void saveBriefAction({ ...done, contactName: null }).catch(() => {});
    router.push('/app/matches');
  };

  const back = n === 1 ? '/app/name' : `/app/q/${n - 1}`;
  const meta = n === TOTAL ? 'Last question' : `Question ${n} of ${TOTAL}`;
  const ok = answered(brief, n);

  return (
    <Frame>
      <Head back={back} meta={meta} />
      <Progress step={n} of={TOTAL} />
      <Body>
        <Step n={n} brief={brief} update={update} />
      </Body>
      <Foot>
        {n === 6 && !ok && brief.priorityRanking.length > 0 ? (
          <p className="oa-foot-note">Rank all four to continue ({brief.priorityRanking.length} of 4)</p>
        ) : null}
        <Cta onClick={next} disabled={!ok}>
          {n === TOTAL ? 'See my 3 matches' : 'Next'}
        </Cta>
      </Foot>
    </Frame>
  );
}

function Step({ n, brief, update }: { n: number; brief: Brief; update: (p: Partial<Brief>) => void }) {
  switch (n) {
    case 1:
      return <HomeStep brief={brief} update={update} />;
    case 2:
      return <ScopeStep brief={brief} update={update} />;
    case 3:
      return <TierStep brief={brief} update={update} />;
    case 4:
      return <StyleStep brief={brief} update={update} />;
    case 5:
      return <HouseholdStep brief={brief} update={update} />;
    case 6:
      return <PriorityStep brief={brief} update={update} />;
    default:
      return <InvolvementStep brief={brief} update={update} />;
  }
}

type StepProps = { brief: Brief; update: (p: Partial<Brief>) => void };

function HomeStep({ brief, update }: StepProps) {
  const popular = PUNE_LOCALITIES.filter((l) => POPULAR.includes(l.slug));
  const others = PUNE_LOCALITIES.filter((l) => !POPULAR.includes(l.slug));
  const otherPicked = brief.locality !== null && !POPULAR.includes(brief.locality);
  return (
    <>
      <h1 className="oa-title">First, what kind of home are we working with?</h1>
      <p className="oa-sub">And where in Pune is it?</p>
      <p className="oa-label">Property type</p>
      <div className="oa-chips" role="group" aria-label="Property type">
        {HOMES.map((h) => (
          <button
            key={h.value}
            type="button"
            className="oa-chip"
            aria-pressed={brief.propertyType === h.value}
            onClick={() => update({ propertyType: h.value })}
          >
            {h.label}
          </button>
        ))}
      </div>
      <p className="oa-label">Locality</p>
      <div className="oa-chips" role="group" aria-label="Locality">
        {popular.map((l) => (
          <button
            key={l.slug}
            type="button"
            className="oa-chip"
            aria-pressed={brief.locality === l.slug}
            onClick={() => update({ locality: l.slug })}
          >
            {l.label}
          </button>
        ))}
      </div>
      <select
        aria-label="Another area"
        className="oa-search"
        value={otherPicked ? (brief.locality ?? '') : ''}
        onChange={(e) => e.target.value && update({ locality: e.target.value })}
      >
        <option value="">Somewhere else in Pune…</option>
        {others.map((l) => (
          <option key={l.slug} value={l.slug}>
            {l.label}
          </option>
        ))}
      </select>
      <label className="oa-label" htmlFor="oa-area">
        Carpet area, sq ft (optional)
      </label>
      <input
        id="oa-area"
        className="oa-input"
        inputMode="numeric"
        placeholder="960"
        value={brief.carpetAreaSqft ?? ''}
        onChange={(e) => {
          const v = Number(e.target.value.replace(/\D/g, ''));
          update({ carpetAreaSqft: v > 0 ? Math.min(v, 20000) : null });
        }}
      />
      <p className="oa-note">Not sure? Skip it. Studios measure on their first visit.</p>
    </>
  );
}

function ScopeStep({ brief, update }: StepProps) {
  const rooms = roomsFor(BEDROOMS[brief.propertyType ?? 'BHK_2']);
  return (
    <>
      <h1 className="oa-title">How much of it are we doing?</h1>
      <div className="oa-list" role="radiogroup" aria-label="Scope">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={brief.scope === s.value}
            className="oa-row"
            onClick={() => update({ scope: s.value, scopeRooms: [], excludedItems: [] })}
          >
            <span>
              <span className="oa-row-title">{s.title}</span>
              <span className="oa-row-sub">{s.sub}</span>
            </span>
            <span className="oa-radio" />
          </button>
        ))}
      </div>
      {brief.scope === 'SINGLE_ROOM' || brief.scope === 'RENOVATION' ? (
        <>
          <p className="oa-label">Which rooms?</p>
          <div className="oa-chips" role="group" aria-label="Rooms">
            {rooms.map((r) => (
              <button
                key={r}
                type="button"
                className="oa-chip"
                aria-pressed={brief.scopeRooms.includes(r)}
                onClick={() =>
                  update({
                    scopeRooms: brief.scopeRooms.includes(r)
                      ? brief.scopeRooms.filter((x) => x !== r)
                      : [...brief.scopeRooms, r],
                    excludedItems: [],
                  })
                }
              >
                {ROOM_LABELS[r]}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function TierStep({ brief, update }: StepProps) {
  const { sqft } = carpetAreaFor(brief);
  return (
    <>
      <h1 className="oa-title">What are you planning to spend?</h1>
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Finish level">
        {TIERS.map((t) => {
          const { lowPaise, highPaise } = tierRangeFor(t, sqft);
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={brief.tier === t}
              className="oa-tier"
              onClick={() => update({ tier: t, budgetMinPaise: lowPaise, budgetMaxPaise: highPaise })}
            >
              <span className="oa-tier-top">
                <span className="oa-tier-name">{TIER[t].label}</span>
                <span className="oa-tier-tag">{TIER_TAG[t]}</span>
              </span>
              <p>{TIER_LINE[t]}</p>
              <span className="range block">
                {highPaise === null
                  ? `From ${formatINRCompact(lowPaise)}`
                  : `${formatINRCompact(lowPaise)} – ${formatINRCompact(highPaise)}`}{' '}
                for {sqft.toLocaleString('en-IN')} sq ft, before GST
              </span>
            </button>
          );
        })}
      </div>
      <p className="oa-note">This sets the materials, not a fixed price. Your quotes show the exact figure for your flat.</p>
    </>
  );
}

function StyleStep({ brief, update }: StepProps) {
  const picked = brief.styleLikes;
  return (
    <>
      <h1 className="oa-title">Which of these feel like your home?</h1>
      <div className="flex items-baseline justify-between gap-3">
        <p className="oa-sub" style={{ margin: 0 }}>
          Pick two or three, on instinct.
        </p>
        <span className="oa-meta" style={{ color: 'var(--accent-ink)' }}>
          {picked.length} of 3
        </span>
      </div>
      <div className="oa-grid3">
        {STYLE_TAGS.map((tag) => {
          const on = picked.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className="oa-photo"
              aria-pressed={on}
              aria-label={STYLE_LABELS[tag]}
              onClick={() =>
                update({
                  styleLikes: on ? picked.filter((t) => t !== tag) : picked.length >= 3 ? picked : [...picked, tag],
                  styleDislikes: brief.styleDislikes.filter((t) => t !== tag),
                })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${STYLE_PHOTOS[tag].src}?auto=format&fit=crop&w=300&h=400&q=60`} alt="" loading="lazy" />
              {on ? <i className="tick">✓</i> : null}
              <span>{STYLE_LABELS[tag]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function HouseholdStep({ brief, update }: StepProps) {
  const h = brief.household ?? { adults: 2, children: 0, elderly: 0, pets: false, worksFromHome: false };
  const set = (patch: Partial<typeof h>) => update({ household: { ...h, ...patch } });
  const counter = (key: 'adults' | 'children' | 'elderly', title: string, sub: string, min: number) => (
    <div className="oa-row" style={{ cursor: 'default' }}>
      <span>
        <span className="oa-row-title">{title}</span>
        <span className="oa-row-sub">{sub}</span>
      </span>
      <span className="oa-step">
        <button type="button" aria-label={`Fewer ${title.toLowerCase()}`} onClick={() => set({ [key]: Math.max(min, h[key] - 1) })}>
          −
        </button>
        <output aria-live="polite">{h[key]}</output>
        <button type="button" className="plus" aria-label={`More ${title.toLowerCase()}`} onClick={() => set({ [key]: Math.min(9, h[key] + 1) })}>
          +
        </button>
      </span>
    </div>
  );
  const toggle = (key: 'pets' | 'worksFromHome', title: string, sub: string) => (
    <div className="oa-row" style={{ cursor: 'default' }}>
      <span>
        <span className="oa-row-title">{title}</span>
        <span className="oa-row-sub">{sub}</span>
      </span>
      <button type="button" role="switch" aria-checked={h[key]} aria-label={title} className="oa-toggle" onClick={() => set({ [key]: !h[key] })} />
    </div>
  );
  return (
    <>
      <h1 className="oa-title">Who’s going to live there?</h1>
      <div className="oa-list">
        {counter('adults', 'Adults', '18 and over', 1)}
        {counter('children', 'Children', 'Under 18', 0)}
        {counter('elderly', 'Parents or elderly', 'We plan for grab rails and easy reach', 0)}
        {toggle('pets', 'Pets', 'Scratch-proof fabrics and finishes')}
        {toggle('worksFromHome', 'Someone works from home', 'A quiet corner with a proper desk')}
      </div>
    </>
  );
}

function PriorityStep({ brief, update }: StepProps) {
  const ranking = brief.priorityRanking;
  const tap = (p: PriorityFactor) =>
    update({ priorityRanking: ranking.includes(p) ? ranking.filter((x) => x !== p) : [...ranking, p] });
  const first = PRIORITIES.find((p) => p.value === ranking[0]);
  return (
    <>
      <h1 className="oa-title">What matters most to you here?</h1>
      <p className="oa-sub">Tap them in order, most important first.</p>
      <div className="oa-list">
        {PRIORITIES.map((p) => {
          const at = ranking.indexOf(p.value);
          return (
            <button key={p.value} type="button" className="oa-row" aria-pressed={at >= 0} onClick={() => tap(p.value)} style={{ justifyContent: 'flex-start' }}>
              <span className={`oa-rank${at >= 0 ? ' on' : ''}`}>{at >= 0 ? at + 1 : ''}</span>
              <span>
                <span className="oa-row-title" style={at >= 0 ? { color: 'var(--accent-ink)' } : undefined}>
                  {p.title}
                </span>
                <span className="oa-row-sub">{p.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      {ranking.length > 0 ? (
        <div className="flex items-center justify-between">
          <span className="oa-label accent" style={{ margin: 0 }}>
            {first ? `${first.title} first` : ''}
          </span>
          <button type="button" className="oa-link" style={{ textDecoration: 'underline', fontSize: 14 }} onClick={() => update({ priorityRanking: [] })}>
            Start over
          </button>
        </div>
      ) : null}
    </>
  );
}

function InvolvementStep({ brief, update }: StepProps) {
  return (
    <>
      <h1 className="oa-title">How involved do you want to be?</h1>
      <div className="oa-list" role="radiogroup" aria-label="Involvement">
        {INVOLVEMENT.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={brief.involvement === o.value}
            className="oa-row"
            onClick={() => update({ involvement: o.value })}
          >
            <span>
              <span className="oa-row-title">{o.title}</span>
              <span className="oa-row-sub">{o.sub}</span>
            </span>
            <span className="oa-radio" />
          </button>
        ))}
      </div>
    </>
  );
}
