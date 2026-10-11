import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowIcon } from '../../components/icons';
import { ChevronBack, Pop, TickIcon } from '../../components/project/parts';
import { Body, Button, ErrorText, Loading, Press, Rise, Stagger } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayLabel, inr } from '../../lib/format';
import { useHeadline, useLang, useT, type T } from '../../lib/i18n';
import { usePlan } from '../../lib/plan';
import { useProfile } from '../../lib/profile';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import type { Decision } from '../../lib/types';

/**
 * A decision with a deadline (design #23): the photo, when it is due and
 * what waiting costs, each option with its swatch or photo and its price
 * against the quote, then confirm. Once chosen, the button becomes a status
 * pill; picking another option before the due date brings the button back.
 *
 * Phase 5 (studio workspace): the options come as rows (`choices`) with the
 * studio's photo and a price change that can go down as well as up; the
 * screen says what the pick does to the last payment before it is
 * confirmed, and the server changes the quote, the final payment and the
 * locker at once. A first pick after the date is still taken, and says the
 * plan moves by the days it is late. Family vote with one tap; the owner's
 * pick decides. Older servers (no `choices`) work as before.
 */

/** One option, whichever shape the server sent. */
type Opt = { key: string; id: string | null; name: string; note: string | null; swatch: string | null; photo: string | null; deltaPaise: number };

function optionsOf(d: Decision): Opt[] {
  if (d.choices?.length) {
    return d.choices.map((c) => ({ key: c.id, id: c.id, name: c.label, note: c.detail, swatch: c.swatch, photo: c.photo, deltaPaise: c.deltaPaise }));
  }
  return d.options.map((o, i) => ({ key: `${o.name}-${i}`, id: null, name: o.name, note: o.note || null, swatch: o.swatch, photo: null, deltaPaise: o.extraPaise }));
}

function priceText(paise: number, t: T): string {
  if (paise > 0) return `+${inr(paise)}`;
  if (paise < 0) return t('decision.less', { amount: inr(-paise) });
  return t('decision.inQuote');
}

/* The design's own tints (Decision.dc.html), not theme tokens. */
const DUE_ON_PHOTO = '#F5C3A9';
const VOTE_COLORS = [color.ok, '#8E6A3A', color.accent, color.ink2];

export default function DecisionScreen() {
  const t = useT();
  const plan = usePlan();
  const { lang } = useLang();
  const size = useHeadline(36);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refresh } = useProject();
  const { profile } = useProfile();
  const { state: auth } = useAuth();
  const [pick, setPick] = useState<number | null>(null);
  const [confirmedIndex, setConfirmedIndex] = useState<number | null>(null);
  const [lateMessage, setLateMessage] = useState<string | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  const d = state.status === 'ready' ? state.project.decisions.find((x) => x.id === id) : undefined;
  if (!d || state.status !== 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.paper, padding: 20, gap: 18 }}>
        <Body>{t('decision.gone')}</Body>
        <Button label={t('decision.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/project'))} />
      </SafeAreaView>
    );
  }

  const options = optionsOf(d);
  const studio = state.project.studio;
  const expert = profile.expert.name;
  const family = state.project.role === 'family';
  const past = d.daysLeft < 0 || d.state === 'overdue';
  const serverPick = d.pickedOptionId ? options.findIndex((o) => o.id === d.pickedOptionId) : d.chosenIndex;
  const confirmed = confirmedIndex ?? (serverPick !== null && serverPick >= 0 ? serverPick : null);
  // A first pick after the date is still taken (and is the customer's delay); a pick made can change only until the date.
  const closed = past && confirmed !== null;
  const late = past && confirmed === null;
  const locked = closed;
  const selected = pick ?? confirmed ?? 0;
  const chosen = options[selected];
  const showPill = confirmed !== null && selected === confirmed;
  const votes = d.votes ?? [];
  const firstName = auth.status === 'signed-in' ? (auth.user.name ?? '').trim() : '';
  const canVote = family && !past && confirmed === null && chosen?.id !== null && chosen?.id !== undefined;

  const confirm = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const res = chosen.id ? await api.pick(d.id, chosen.id) : await api.choose(d.id, selected);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmedIndex(selected);
    const message = (res.data as { message?: string | null }).message;
    setLateMessage(message ?? null);
    void refresh();
  };

  const vote = async () => {
    if (!chosen?.id) return;
    setBusy(true);
    setError(null);
    const res = await api.vote(d.id, chosen.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVoted(selected);
    void refresh();
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/project'));
  const effect = chosen
    ? chosen.deltaPaise > 0
      ? t('decision.adds', { option: chosen.name, amount: inr(chosen.deltaPaise) })
      : chosen.deltaPaise < 0
        ? t('decision.saves', { option: chosen.name, amount: inr(-chosen.deltaPaise) })
        : t('decision.same', { option: chosen.name })
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[styles.hero, { height: 230 + insets.top }]}>
          {chosen?.photo ? (
            <Image source={{ uri: chosen.photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={chosen.name} transition={180} />
          ) : (
            /* No photo for this option: the studio's kitchen render stands in. */
            <Image
              source={require('../../../assets/app/kitchen.webp')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={t('decision.photo')}
            />
          )}
          <LinearGradient
            colors={['rgba(11,11,11,.55)', 'rgba(11,11,11,.1)', 'rgba(11,11,11,.8)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroInner, { paddingTop: 18 + insets.top }]}>
            <Press onPress={back} style={styles.back} accessibilityLabel={t('decision.back')}>
              <ChevronBack color={color.white} />
            </Press>
            <Text style={styles.heroMeta}>
              {closed ? t('decision.closedOn', { day: dayLabel(d.dueOn) }) : late ? t('decision.lateDue', { day: dayLabel(d.dueOn) }) : t('decision.due', { day: dayLabel(d.dueOn) })}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={{ gap: 10 }}>
            <Rise>
              <Text
                role="heading"
                style={[styles.h1, { fontSize: size, lineHeight: lang === 'en' ? size * 0.98 : size * 1.25, letterSpacing: size * -0.045 }]}
              >
                {d.title}
              </Text>
            </Rise>
            <Rise delay={120}>
              <Text style={styles.why}>{d.why}</Text>
            </Rise>
            {late && !family ? <Text style={styles.lateNote}>{t('decision.lateOpen')}</Text> : null}
          </View>

          <View role="radiogroup" aria-label={t('decision.options')} aria-disabled={locked} style={styles.options}>
            {options.map((o, i) => {
              const on = i === selected;
              const price = priceText(o.deltaPaise, t);
              return (
                <Stagger key={o.key} i={i} start={220}>
                  <Press
                    disabled={locked}
                    haptic={!locked}
                    onPress={() => {
                      setPick(i);
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on, disabled: locked }}
                    accessibilityLabel={`${o.name}. ${o.note ? `${o.note}. ` : ''}${price}`}
                    style={styles.option}
                  >
                    <Pop on={on}>
                      <View style={[styles.swatchRing, { borderColor: on ? color.ink : 'transparent' }]}>
                        {o.photo ? (
                          <Image source={{ uri: o.photo }} style={styles.swatch} contentFit="cover" accessibilityIgnoresInvertColors />
                        ) : (
                          <View style={[styles.swatch, { backgroundColor: o.swatch ?? color.soft }]} />
                        )}
                      </View>
                    </Pop>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.optName}>{o.name}</Text>
                      {o.note ? <Text style={styles.optNote}>{o.note}</Text> : null}
                    </View>
                    <Text style={[styles.price, o.deltaPaise <= 0 && { color: color.ok }]}>{price}</Text>
                  </Press>
                </Stagger>
              );
            })}
          </View>

          {effect && !family && !locked ? <Text style={styles.effect}>{effect}</Text> : null}

          {votes.length ? (
            <View style={styles.votes}>
              <View style={styles.votesHead}>
                <Text style={styles.votesTitle}>{t('decision.votes')}</Text>
                <Text style={styles.votesCount}>{t('decision.votedCount', { n: votes.length })}</Text>
              </View>
              <View style={{ gap: 8 }}>
                {votes.map((v, i) => {
                  const option = options[v.optionIndex]?.name ?? '';
                  return (
                    <View key={`${v.name}-${i}`} style={styles.voteRow}>
                      <Avatar letter={v.name} tone={VOTE_COLORS[i % VOTE_COLORS.length]!} />
                      <Text style={styles.voteText}>
                        <Bolded
                          template={v.mine ? t('decision.youVoted', { option: '\u0000' }) : t('decision.voted', { name: v.name, option: '\u0000' })}
                          bold={option}
                        />
                        {v.note ? `: “${v.note}”` : ''}
                      </Text>
                    </View>
                  );
                })}
                {!family ? (
                  <View style={styles.voteRow}>
                    <Avatar letter={firstName || '·'} tone={color.accent} />
                    <Text style={[styles.voteText, { color: color.ink2 }]}>{t('decision.yourCall')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* The expert is Assured's (and the open pre-sign stage's); Basic has no one to ask here. */}
          {plan.plan !== 'basic' ? (
            <View style={{ gap: 2 }}>
              <Text style={styles.ask}>{t('decision.notSure', { name: expert, day: dayLabel(d.dueOn) })}</Text>
              <Press
                onPress={() => router.push({ pathname: '/geio', params: { ask: 'expert' } })}
                haptic={false}
                accessibilityRole="link"
                style={styles.askLink}
              >
                <Text style={styles.askLinkText}>{t('decision.ask', { name: expert })}</Text>
                <ArrowIcon color={color.ink} size={14} />
              </Press>
            </View>
          ) : null}

          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        {showPill && chosen ? (
          <View role="status" aria-live="polite" accessibilityLiveRegion="polite" style={{ gap: 8 }}>
            <View style={styles.pill}>
              <TickIcon color={color.accentWarm} />
              <Text style={styles.pillText} numberOfLines={2}>
                {t('decision.confirmed', { option: chosen.name, studio })}
              </Text>
            </View>
            {lateMessage ? <Text style={styles.familyNote}>{lateMessage}</Text> : null}
          </View>
        ) : family ? (
          canVote && voted !== selected ? (
            <Button label={t('decision.vote', { option: lowerFirst(chosen?.name ?? '', lang) })} onPress={() => void vote()} busy={busy} />
          ) : (
            <Text style={styles.familyNote}>{voted !== null ? t('decision.voted.done') : t('decision.family')}</Text>
          )
        ) : (
          <Button
            label={closed ? t('decision.closed') : t('decision.confirm', { option: lowerFirst(chosen?.name ?? '', lang) })}
            onPress={() => void confirm()}
            busy={busy}
            disabled={closed}
            reason={closed ? t('decision.closedReason', { name: expert }) : undefined}
          />
        )}
      </View>
    </View>
  );
}

/** "Confirm walnut grain": lower-cases the first letter in English only. */
function lowerFirst(s: string, lang: string) {
  return lang === 'en' ? s.replace(/^./, (c) => c.toLowerCase()) : s;
}

/** A translated line with one part in semibold, wherever the language puts it. */
function Bolded({ template, bold }: { template: string; bold: string }) {
  const [before, after = ''] = template.split('\u0000');
  return (
    <>
      {before}
      <Text style={{ fontFamily: font.sansSemi }}>{bold}</Text>
      {after}
    </>
  );
}

function Avatar({ letter, tone }: { letter: string; tone: string }) {
  return (
    <View aria-hidden style={[styles.avatar, { backgroundColor: tone }]}>
      <Text style={styles.avatarText}>{letter.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: color.ink, overflow: 'hidden' },
  heroInner: { flex: 1, paddingLeft: 12, paddingRight: 20, paddingBottom: 18, justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  heroMeta: { paddingLeft: 8, fontFamily: font.sansMedium, fontSize: 13, letterSpacing: 13 * 0.07, textTransform: 'uppercase', color: DUE_ON_PHOTO },
  body: { paddingTop: 22, paddingHorizontal: 20, gap: 18 },
  h1: { fontFamily: font.sansMedium, color: color.ink },
  why: { fontFamily: font.sans, fontSize: 15, lineHeight: 22.5, color: color.ink2 },
  lateNote: { fontFamily: font.sansMedium, fontSize: 14, lineHeight: 21, color: color.accentInk },
  options: { borderBottomWidth: 1, borderBottomColor: color.line },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line },
  swatchRing: { padding: 0, borderWidth: 3, borderRadius: 13 },
  swatch: { width: 56, height: 68, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(11,11,11,.12)' },
  optName: { fontFamily: font.sansSemi, fontSize: 18, letterSpacing: -0.36, color: color.ink },
  optNote: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  price: { fontFamily: font.mono, fontSize: 13, color: color.ink },
  effect: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.ink2, marginTop: -6 },
  votes: { backgroundColor: color.soft, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  votesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  votesTitle: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  votesCount: { fontFamily: font.sans, fontSize: 13.5, color: color.ink2 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voteText: { flex: 1, fontFamily: font.sans, fontSize: 14.5, lineHeight: 20, color: color.ink },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  ask: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.ink2 },
  askLink: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  askLinkText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink },
  footer: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.paper },
  pill: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  pillText: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 15, color: color.onDark, textAlign: 'center' },
  familyNote: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: color.ink2, textAlign: 'center', paddingVertical: 8 },
});
