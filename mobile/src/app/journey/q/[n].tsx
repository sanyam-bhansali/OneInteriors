import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GroupLabel, PriorityIcon, QuizScreen, RadioRow } from '../../../components/journey/parts';
import { Body, Button, CircleOption, Loading, OptionPill, Press, RankedRow, Rise, Stagger, Title } from '../../../components/ui';
import { useBrief } from '../../../lib/brief';
import {
  BEDROOMS,
  carpetAreaFor,
  POPULAR_LOCALITIES,
  PUNE_LOCALITIES,
  roomsFor,
  STYLE_LABELS,
  STYLE_TAGS,
  TIER,
  tierRangeFor,
  TIERS,
  type Brief,
  type Household,
  type Involvement,
  type PriorityFactor,
  type PropertyType,
  type ScopeType,
  type StyleTag,
} from '../../../lib/brief-types';
import { useHeadline, useT, type Key } from '../../../lib/i18n';
import { stylePhoto } from '../../../lib/style-dna';
import { color, font, type } from '../../../lib/theme';

/**
 * #3–9 The quiz, one question a screen (designs Q1–Q7.dc.html). Each answer
 * is written to the phone's brief with the website's own field names and
 * values (src/app/app/q/[n]/page.tsx), so it can go to the server as-is.
 * Next stays soft, and says what is missing, until the question is answered
 * the way the website requires.
 */

const TOTAL = 7;

const HOMES: { value: PropertyType; label: string | null }[] = [
  { value: 'BHK_1', label: '1 BHK' },
  { value: 'BHK_2', label: '2 BHK' },
  { value: 'BHK_3', label: '3 BHK' },
  { value: 'BHK_4_PLUS', label: '4+ BHK' },
  { value: 'VILLA', label: null },
];
const SCOPES: ScopeType[] = ['FULL_HOME', 'KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION'];
const PRIORITIES: PriorityFactor[] = ['SPEED', 'DESIGN_AMBITION', 'BUDGET', 'MATERIAL_QUALITY'];
const INVOLVEMENT: Involvement[] = ['DECIDE_FOR_ME', 'COLLABORATE', 'APPROVE_EVERYTHING'];
const HOUSEHOLD: Household = { adults: 2, children: 0, elderly: 0, pets: false, worksFromHome: false };

/** The website's `answered()`, and why not when it is not. */
function missing(brief: Brief, n: number): Key | null {
  switch (n) {
    case 1:
      return brief.propertyType !== null && brief.locality !== null ? null : 'quiz.q1.need';
    case 2:
      if (brief.scope === null) return 'quiz.pickOne';
      return brief.scope === 'SINGLE_ROOM' && brief.scopeRooms.length === 0 ? 'quiz.q2.needRooms' : null;
    case 3:
      return brief.tier !== null ? null : 'quiz.pickOne';
    case 4:
      return brief.styleLikes.length >= 2 ? null : 'quiz.q4.more';
    case 5:
      return null;
    case 6:
      return brief.priorityRanking.length === 4 ? null : 'quiz.q6.more';
    default:
      return brief.involvement !== null ? null : 'quiz.pickOne';
  }
}

export default function Question() {
  const t = useT();
  const raw = Number(useLocalSearchParams<{ n: string }>().n);
  const n = Math.min(TOTAL, Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 1));
  const { brief, ready, update } = useBrief();
  if (!ready) return <Loading />;

  const why = missing(brief, n);
  const reason = why
    ? t(why, {
        n: n === 4 ? 2 - brief.styleLikes.length : 4 - brief.priorityRanking.length,
      })
    : undefined;

  const next = () => {
    if (n < TOTAL) {
      update({ lastStep: n + 1 });
      router.push(`/journey/q/${n + 1}` as Href);
      return;
    }
    // The last answer: the brief is complete (lastStep 12, as the website writes it), then the style DNA.
    update({ completedAt: new Date().toISOString(), lastStep: 12 });
    router.push('/journey/style');
  };

  const back: Href = n === 1 ? '/journey/name' : (`/journey/q/${n - 1}` as Href);
  const meta = n === TOTAL ? t('q.last') : t('q.meta', { n, of: TOTAL });

  return (
    <QuizScreen
      back={back}
      meta={meta}
      step={n}
      footerRule={n === 1 || n === 4}
      footer={<Button label={n === TOTAL ? t('q.seeMatches') : t('common.next')} onPress={next} disabled={!!why} reason={reason} />}
    >
      <Step n={n} brief={brief} update={update} />
    </QuizScreen>
  );
}

type StepProps = { brief: Brief; update: (p: Partial<Brief>) => void };

function Step({ n, ...p }: StepProps & { n: number }) {
  switch (n) {
    case 1:
      return <HomeStep {...p} />;
    case 2:
      return <ScopeStep {...p} />;
    case 3:
      return <TierStep {...p} />;
    case 4:
      return <StyleStep {...p} />;
    case 5:
      return <HouseholdStep {...p} />;
    case 6:
      return <PriorityStep {...p} />;
    default:
      return <InvolvementStep {...p} />;
  }
}

/** Q1: home type, locality, carpet area (optional). */
function HomeStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(36);
  const popular = POPULAR_LOCALITIES.map((slug) => PUNE_LOCALITIES.find((l) => l.slug === slug)).filter((l) => !!l);
  const others = PUNE_LOCALITIES.filter((l) => !POPULAR_LOCALITIES.includes(l.slug));
  const otherPicked = brief.locality !== null && !POPULAR_LOCALITIES.includes(brief.locality);
  const [showOther, setShowOther] = useState(otherPicked);
  const place = (l: { slug: string; label: string }, i: number) => (
    <Stagger key={l.slug} i={i} start={220}>
      <OptionPill label={l.label} on={brief.locality === l.slug} onPress={() => update({ locality: l.slug })} />
    </Stagger>
  );
  return (
    <>
      <View style={{ gap: 8 }}>
        <Title size={h1}>{t('q1.h1')}</Title>
        <Rise delay={120}>
          <Body muted style={{ fontSize: 15 }}>
            {t('q1.sub')}
          </Body>
        </Rise>
      </View>

      <View>
        <GroupLabel>{t('q1.type')}</GroupLabel>
        <View role="radiogroup" aria-label={t('q1.type')} style={styles.chips}>
          {HOMES.map((h, i) => (
            <Stagger key={h.value} i={i} start={220}>
              <OptionPill label={h.label ?? t('quiz.villa')} on={brief.propertyType === h.value} onPress={() => update({ propertyType: h.value })} />
            </Stagger>
          ))}
        </View>
      </View>

      <View>
        <GroupLabel>{t('q1.locality')}</GroupLabel>
        <View role="radiogroup" aria-label={t('q1.locality')} style={styles.chips}>
          {popular.map(place)}
          {showOther ? others.map((l, i) => place(l, popular.length + i)) : null}
        </View>
        <Pressable role="button" onPress={() => setShowOther((s) => !s)} style={styles.linkHit}>
          <Text style={styles.link}>{showOther ? t('quiz.q1.less') : t('q1.other')}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text nativeID="area-label" style={type.eyebrow}>
          {t('q1.area')}
        </Text>
        <TextInput
          value={brief.carpetAreaSqft ? String(brief.carpetAreaSqft) : ''}
          onChangeText={(v) => {
            const num = Number(v.replace(/\D/g, ''));
            update({ carpetAreaSqft: num > 0 ? Math.min(num, 20000) : null });
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder={t('quiz.q1.areaPh')}
          placeholderTextColor={color.ink3}
          aria-labelledby="area-label"
          accessibilityLabel={t('q1.area')}
          style={styles.area}
        />
        <Text style={styles.note}>{t('q1.areaNote')}</Text>
      </View>
    </>
  );
}

/** Q2: scope; a single-room job or a renovation also picks its rooms. */
function ScopeStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(40);
  const rooms = roomsFor(BEDROOMS[brief.propertyType ?? 'BHK_2']);
  return (
    <>
      <Title size={h1}>{t('q2.h1')}</Title>
      <View role="radiogroup" aria-label={t('q2.h1')} style={styles.list}>
        {SCOPES.map((s, i) => (
          <RadioRow
            key={s}
            i={i}
            title={t(`scope.${s}`)}
            hint={t(`scope.${s}.sub`)}
            on={brief.scope === s}
            onPress={() => update({ scope: s, scopeRooms: [], excludedItems: [] })}
          />
        ))}
      </View>
      {brief.scope === 'SINGLE_ROOM' || brief.scope === 'RENOVATION' ? (
        <Rise>
          <GroupLabel>{t('q2.rooms')}</GroupLabel>
          <View role="group" aria-label={t('q2.rooms')} style={styles.chips}>
            {rooms.map((r) => {
              const on = brief.scopeRooms.includes(r);
              return (
                <OptionPill
                  key={r}
                  role="checkbox"
                  label={t(`quiz.room.${r}`)}
                  on={on}
                  onPress={() => update({ scopeRooms: on ? brief.scopeRooms.filter((x) => x !== r) : [...brief.scopeRooms, r], excludedItems: [] })}
                />
              );
            })}
          </View>
        </Rise>
      ) : null}
    </>
  );
}

/** Q3: the finish level. Writes the band for their flat as the budget, as the website does. */
function TierStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(40);
  const { sqft } = carpetAreaFor(brief);
  return (
    <>
      <Title size={h1}>{t('q3.h1')}</Title>
      <View role="radiogroup" aria-label={t('q3.h1')} style={{ gap: 10 }}>
        {TIERS.map((tier, i) => {
          const on = brief.tier === tier;
          return (
            <Stagger key={tier} i={i} start={220}>
              <Press
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${TIER[tier].label}, ${t(`tier.${tier}.tag`)}. ${t(`tier.${tier}.line`)}`}
                onPress={() => {
                  const { lowPaise, highPaise } = tierRangeFor(tier, sqft);
                  update({ tier, budgetMinPaise: lowPaise, budgetMaxPaise: highPaise });
                }}
                style={[styles.tier, on && { backgroundColor: color.ink, borderColor: color.ink }]}
              >
                <View style={styles.tierTop}>
                  <Text style={[styles.tierName, on && { color: color.white }]}>{TIER[tier].label}</Text>
                  <Text style={[type.eyebrow, on && { color: color.accentWarm }]}>{t(`tier.${tier}.tag`)}</Text>
                </View>
                <Text style={[styles.tierLine, on && { color: '#C9C7C1' }]}>{t(`tier.${tier}.line`)}</Text>
              </Press>
            </Stagger>
          );
        })}
      </View>
      <Text style={[styles.note, { fontSize: 13.5 }]}>{t('q3.note')}</Text>
    </>
  );
}

/** Q4: two or three style photos, on instinct. Likes in the order tapped; a liked style is never also disliked. */
function StyleStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(36);
  const picked = brief.styleLikes;
  const [w, setW] = useState(0);
  const tile = w > 0 ? (w - 12) / 3 : 0;
  const toggle = (tag: StyleTag) => {
    const on = picked.includes(tag);
    update({
      styleLikes: on ? picked.filter((x) => x !== tag) : picked.length >= 3 ? picked : [...picked, tag],
      styleDislikes: brief.styleDislikes.filter((x) => x !== tag),
    });
  };
  return (
    <>
      <View style={{ gap: 8 }}>
        <Title size={h1}>{t('q4.h1')}</Title>
        <Rise delay={120} style={styles.q4sub}>
          <Body muted style={{ fontSize: 14.5, flex: 1 }}>
            {t('q4.sub')}
          </Body>
          <Text role="status" aria-live="polite" style={[type.eyebrow, { color: color.accent }]}>
            {t('q4.count', { n: picked.length })}
          </Text>
        </Rise>
      </View>
      <View role="group" aria-label={t('q4.h1')} style={styles.grid} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {tile > 0
          ? STYLE_TAGS.map((tag, i) => {
              const on = picked.includes(tag);
              return (
                <Stagger key={tag} i={i} start={220}>
                  <Press
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={STYLE_LABELS[tag]}
                    onPress={() => toggle(tag)}
                    style={[styles.ring, { width: tile, height: (tile * 4) / 3 }, on && { borderColor: color.ink }]}
                  >
                    <View style={styles.tile}>
                    <Image source={{ uri: stylePhoto(tag) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    <LinearGradient colors={['rgba(11,11,11,0)', 'rgba(11,11,11,.8)']} style={styles.tileFoot}>
                      <Text style={styles.tileLabel} numberOfLines={2}>
                        {STYLE_LABELS[tag]}
                      </Text>
                    </LinearGradient>
                    {on ? (
                      <View style={styles.tick}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
                          <Path d="M20 6 9 17l-5-5" fill="none" stroke={color.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </View>
                    ) : null}
                    </View>
                  </Press>
                </Stagger>
              );
            })
          : null}
      </View>
    </>
  );
}

/** Q5: who lives there. Written only once something is changed, as the website does. */
function HouseholdStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(40);
  const h = brief.household ?? HOUSEHOLD;
  const set = (patch: Partial<Household>) => update({ household: { ...h, ...patch } });
  const counters: { key: 'adults' | 'children' | 'elderly'; title: string; sub: string; min: number }[] = [
    { key: 'adults', title: t('q5.adults'), sub: t('q5.adults.sub'), min: 1 },
    { key: 'children', title: t('q5.children'), sub: t('q5.children.sub'), min: 0 },
    { key: 'elderly', title: t('q5.elderly'), sub: t('q5.elderly.sub'), min: 0 },
  ];
  const flags: { key: 'pets' | 'worksFromHome'; title: string; sub: string }[] = [
    { key: 'pets', title: t('q5.pets'), sub: t('q5.pets.sub') },
    { key: 'worksFromHome', title: t('q5.wfh'), sub: t('q5.wfh.sub') },
  ];
  return (
    <>
      <Title size={h1}>{t('q5.h1')}</Title>
      <View style={styles.list}>
        {counters.map((c, i) => (
          <Stagger key={c.key} i={i} start={220} style={styles.hRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.hTitle}>{c.title}</Text>
              <Text style={styles.hSub}>{c.sub}</Text>
            </View>
            <Press
              onPress={() => set({ [c.key]: Math.max(c.min, h[c.key] - 1) })}
              disabled={h[c.key] <= c.min}
              accessibilityLabel={t('quiz.q5.fewer', { x: c.title })}
              style={[styles.step, h[c.key] <= c.min && { opacity: 0.4 }]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d="M5 12h14" stroke={color.ink} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Press>
            <Text aria-live="polite" style={styles.count}>
              {h[c.key]}
            </Text>
            <Press
              onPress={() => set({ [c.key]: Math.min(9, h[c.key] + 1) })}
              disabled={h[c.key] >= 9}
              accessibilityLabel={t('quiz.q5.more', { x: c.title })}
              style={[styles.step, styles.stepPlus]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d="M12 5v14M5 12h14" stroke={color.onDark} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Press>
          </Stagger>
        ))}
        {flags.map((f, i) => {
          const on = h[f.key];
          return (
            <Stagger key={f.key} i={counters.length + i} start={220} style={styles.hRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hTitle}>{f.title}</Text>
                <Text style={styles.hSub}>{f.sub}</Text>
              </View>
              <Press
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={f.title}
                onPress={() => set({ [f.key]: !on })}
                style={styles.switchHit}
              >
                <View style={[styles.switch, { backgroundColor: on ? color.ink : '#C9C7C1', alignItems: on ? 'flex-end' : 'flex-start' }]}>
                  <View style={styles.knob} />
                </View>
              </Press>
            </Stagger>
          );
        })}
      </View>
    </>
  );
}

/** Q6: the four priorities, ranked by tapping them in order. Index 0 is the most important. */
function PriorityStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(40);
  const ranking = brief.priorityRanking;
  const left = PRIORITIES.filter((p) => !ranking.includes(p));
  const status =
    left.length === 0 ? t('q6.first', { x: t(`prio.${ranking[0]}`) }) : ranking.length === 0 ? t('quiz.q6.tapTop') : t('quiz.q6.now', { n: ranking.length + 1 });
  return (
    <>
      <View style={{ gap: 8 }}>
        <Title size={h1}>{t('q6.h1')}</Title>
        <Rise delay={120}>
          <Body muted style={{ fontSize: 15 }}>
            {t('q6.sub')}
          </Body>
        </Rise>
      </View>

      {ranking.length > 0 ? (
        <View role="list" aria-label={t('quiz.q6.ranking')} style={{ gap: 10 }}>
          {ranking.map((p, i) => (
            <RankedRow
              key={p}
              n={i + 1}
              label={t(`prio.${p}`)}
              icon={<PriorityIcon id={p} tint="rgba(255,255,255,.8)" size={22} />}
              onRemove={() => update({ priorityRanking: ranking.filter((x) => x !== p) })}
            />
          ))}
        </View>
      ) : null}

      {left.length > 0 ? (
        <View role="group" aria-label={t('quiz.q6.left')} style={styles.circles}>
          {left.map((p, i) => (
            <Stagger key={p} i={i} start={220}>
              <CircleOption label={t(`prio.${p}`)} icon={<PriorityIcon id={p} tint={color.ink} />} onPress={() => update({ priorityRanking: [...ranking, p] })} />
            </Stagger>
          ))}
        </View>
      ) : null}

      <View style={styles.q6foot}>
        <Text role="status" aria-live="polite" style={[type.eyebrow, { color: color.accent, flex: 1 }]}>
          {status}
        </Text>
        {ranking.length > 0 ? (
          <Pressable role="button" onPress={() => update({ priorityRanking: [] })} style={styles.linkHit}>
            <Text style={[styles.link, { color: color.ink2, fontSize: 14 }]}>{t('q6.startOver')}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

/** Q7: how involved they want to be. */
function InvolvementStep({ brief, update }: StepProps) {
  const t = useT();
  const h1 = useHeadline(40);
  return (
    <>
      <Title size={h1}>{t('q7.h1')}</Title>
      <View role="radiogroup" aria-label={t('q7.h1')} style={styles.list}>
        {INVOLVEMENT.map((o, i) => (
          <RadioRow key={o} i={i} title={t(`inv.${o}`)} hint={t(`inv.${o}.sub`)} on={brief.involvement === o} onPress={() => update({ involvement: o })} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { borderBottomWidth: 1, borderBottomColor: color.line },
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink, textDecorationLine: 'underline' },
  note: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.ink2 },
  area: {
    minHeight: 52,
    borderBottomWidth: 1.5,
    borderBottomColor: color.ink,
    fontFamily: font.sansMedium,
    fontSize: 22,
    letterSpacing: -0.44,
    color: color.ink,
    padding: 0,
  },
  tier: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(11,11,11,.18)', paddingVertical: 20, paddingHorizontal: 18, gap: 6 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tierName: { fontFamily: font.sansMedium, fontSize: 28, letterSpacing: -1.1, color: color.ink },
  tierLine: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.ink2 },
  q4sub: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: -4 },
  ring: { borderRadius: 15, borderWidth: 3, borderColor: 'transparent' },
  tile: { flex: 1, borderRadius: 11, overflow: 'hidden', backgroundColor: color.ink },
  tileFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 18, paddingBottom: 7, paddingHorizontal: 6 },
  tileLabel: { fontFamily: font.sansSemi, fontSize: 13, lineHeight: 16, color: color.white },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, borderTopWidth: 1, borderTopColor: color.line, paddingVertical: 8 },
  hTitle: { fontFamily: font.sansSemi, fontSize: 17, letterSpacing: -0.34, color: color.ink },
  hSub: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.ink2 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(11,11,11,.25)', alignItems: 'center', justifyContent: 'center' },
  stepPlus: { backgroundColor: color.ink, borderColor: color.ink },
  count: { width: 28, textAlign: 'center', fontFamily: font.mono, fontSize: 18, color: color.ink },
  switchHit: { minHeight: 44, justifyContent: 'center' },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.white },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  q6foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
