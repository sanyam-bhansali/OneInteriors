import * as WebBrowser from 'expo-web-browser';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Confetti } from '../../components/journey-quote/Confetti';
import { PanelHead, PanelPage, useTopInset } from '../../components/journey-quote/Page';
import { Body, Button, DarkPanel, ErrorText, Loading, Meta, Press, Stagger, Title } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { dayLabel } from '../../lib/format';
import { useHeadline, useT } from '../../lib/i18n';
import { quoteApi, useChosenMatches, type ExpertSlots } from '../../lib/journey/quote';
import { color, font, radius, space, type } from '../../lib/theme';

/**
 * #15 Expert call (designs/Expert.dc.html; the website's /app/expert). Who
 * the expert is and who pays her, said first and in the promised words;
 * then a day and a time from her open half-hours (GET /expert/slots), and
 * one tap books it about the three studios they were shown. If somebody
 * took the time meanwhile (409), the times are fetched again and the screen
 * says so. Booked, the page turns ink, the confetti bursts, and the next
 * steps lead on to meeting the studios. The call is free for everyone and
 * is never taken from a plan's calls (owner, 11 Oct).
 */

const TZ = 'Asia/Kolkata';
const DAYS_SHOWN = 4;
const TIMES_SHOWN = 6;
const EXPERT_FORM = 'https://oneinteriors.in/expert';

/** Up to `n` times spread across the day, so the grid is a choice and not a list (as the website does). */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]!);
}

const dayPart = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, ...o });
const longDay = (iso: string) => dayPart(iso, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');

/** "+91 98220 41736" */
function prettyPhone(p: string | null | undefined): string | null {
  const d = (p ?? '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
}

type Load = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: ExpertSlots };

export default function ExpertScreen() {
  const t = useT();
  const h1 = useHeadline(36);
  const top = useTopInset();
  const { state: auth } = useAuth();
  const chosen = useChosenMatches();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  /** Keeps the answer; a 401 means the number is not verified yet, so back to the phone screen. */
  const take = useCallback((res: Awaited<ReturnType<typeof quoteApi.slots>>): ExpertSlots | null => {
    if (res.ok) {
      setLoad({ status: 'ready', data: res.data });
      return res.data;
    }
    if (res.status === 401) router.replace('/journey/phone' as Href);
    else setLoad({ status: 'error', error: res.error });
    return null;
  }, []);
  const fetchSlots = useCallback(async () => take(await quoteApi.slots()), [take]);

  useEffect(() => {
    let live = true;
    void quoteApi.slots().then((res) => {
      if (live) take(res);
    });
    return () => {
      live = false;
    };
  }, [take]);

  const days = useMemo(
    () =>
      load.status === 'ready'
        ? load.data.days
            .filter((d) => d.slots.length > 0)
            .slice(0, DAYS_SHOWN)
            .map((d) => ({ ...d, slots: spread(d.slots, TIMES_SHOWN) }))
        : [],
    [load],
  );

  if (load.status === 'loading' || chosen.status === 'loading') return <Loading />;

  const expert = load.status === 'ready' ? load.data.expert.name : 'Meera';
  const n = chosen.matches.length;
  const slugs = chosen.matches.map((m) => m.slug);
  const today = days[Math.min(day, Math.max(days.length - 1, 0))];
  const picked = today?.slots.find((s) => s.startsAt === slot) ?? null;

  async function book() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const res = await quoteApi.book(picked.startsAt, slugs);
    setBusy(false);
    if (res.ok) return setBooked(res.data.booking.startsAt);
    if (res.status === 401) return router.replace('/journey/phone' as Href);
    if (res.status === 409) {
      const fresh = await fetchSlots();
      const still = fresh?.days.some((d) => d.slots.some((s) => s.startsAt === picked.startsAt));
      if (!still) {
        setSlot(null);
        return setError(t('expert.gone'));
      }
    }
    setError(res.error);
  }

  if (booked) {
    const phone = prettyPhone(auth.status === 'signed-in' ? auth.user.phone : null);
    const time = picked?.label ?? new Date(booked).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    const steps = [n > 1 ? t('expert.next1', { n, name: expert }) : t('expert.next1Any', { name: expert }), t('expert.next2'), t('expert.next3')];
    return (
      <PanelPage dark footer={<Button variant="light" label={t('expert.nextCta')} onPress={() => router.push('/journey/choose' as Href)} />}>
        <View style={[styles.booked, { paddingTop: top + 64 }]}>
          <Confetti />
          <View role="status" aria-live="polite" aria-label={t('expert.booked')} style={{ gap: 12 }}>
            <Title size={bookedSize(h1)} style={{ color: color.onDark, lineHeight: h1 * 1.05 }}>
              {t('expert.seeYou', { when: `${longDay(booked)}, ${time}` })}
            </Title>
            <Text style={styles.bookedSub}>
              {phone ? t('expert.calls', { name: expert, phone }) : t('expert.callsNoPhone', { name: expert })}
            </Text>
          </View>
          <View role="list" style={styles.steps}>
            {steps.map((s, i) => (
              <Stagger key={s} i={i} start={300}>
                <View role="listitem" style={styles.step}>
                  <Text style={[styles.stepNum, i === 0 && { color: color.accentWarm }]}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={[styles.stepText, i > 0 && { color: color.onDark2 }]}>{s}</Text>
                </View>
              </Stagger>
            ))}
          </View>
        </View>
      </PanelPage>
    );
  }

  const footer =
    load.status === 'error' ? (
      <Button label={t('quoteApp.retry')} onPress={() => void fetchSlots()} />
    ) : days.length === 0 ? (
      <Button label={t('expert.none.cta')} onPress={() => void WebBrowser.openBrowserAsync(EXPERT_FORM)} />
    ) : (
      <>
        <Button
          label={picked ? t('expert.book', { when: `${dayLabel(picked.startsAt)}, ${picked.label}` }) : t('expert.time')}
          onPress={() => void book()}
          busy={busy}
          disabled={!picked}
        />
        <Meta style={{ textAlign: 'center' }}>{t('compare.ctaNote')}</Meta>
      </>
    );

  return (
    <PanelPage footer={footer}>
      <DarkPanel style={{ paddingTop: top + 12, paddingLeft: 12, gap: 18, paddingBottom: 26 }}>
        <PanelHead back={'/journey/compare' as Href} meta={t('expert.meta')} />
        <View style={{ paddingLeft: 8, gap: 14 }}>
          <Title size={h1} style={{ color: color.onDark, lineHeight: h1 * 0.98 }}>
            {t('expert.h1')}
          </Title>
          <View style={styles.who}>
            <View style={styles.avatar} aria-hidden>
              <Text style={styles.avatarText}>{expert.charAt(0)}</Text>
            </View>
            <Text style={styles.whoText}>
              {[n > 0 ? t('expert.reads', { name: expert, n }) : null, t('expert.same')].filter(Boolean).join(' ')}
            </Text>
          </View>
          <Text style={styles.free}>{t('expert.free')}</Text>
        </View>
      </DarkPanel>

      <View style={styles.body}>
        {load.status === 'error' ? (
          <ErrorText>{t('expert.error')}</ErrorText>
        ) : days.length === 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={type.section}>{t('expert.none.h')}</Text>
            <Body muted>{t('expert.none.sub')}</Body>
          </View>
        ) : (
          <>
            <View style={{ gap: 12 }}>
              <Text style={type.eyebrow}>{t('expert.day')}</Text>
              <View role="radiogroup" aria-label={t('expert.day')} style={styles.days}>
                {days.map((d, i) => {
                  const on = i === day;
                  const first = d.slots[0]!.startsAt;
                  return (
                    <Stagger key={d.date} i={i} start={220} style={{ flex: 1 }}>
                      <Press
                        onPress={() => {
                          setDay(i);
                          setSlot(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={dayPart(first, { weekday: 'long', day: 'numeric', month: 'long' })}
                        accessibilityState={{ checked: on }}
                        style={[styles.day, on && styles.on]}
                      >
                        <Text style={[type.eyebrow, { color: on ? color.white : color.ink }]}>{dayPart(first, { weekday: 'short' })}</Text>
                        <Text style={[styles.dayNum, on && { color: color.white }]}>{dayPart(first, { day: 'numeric' })}</Text>
                      </Press>
                    </Stagger>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <Text style={type.eyebrow}>{t('expert.time')}</Text>
              <View role="radiogroup" aria-label={t('expert.time')} style={styles.times}>
                {(today?.slots ?? []).map((s, i) => {
                  const on = s.startsAt === slot;
                  return (
                    <Stagger key={s.startsAt} i={i} start={280} style={styles.timeCell}>
                      <Press
                        onPress={() => setSlot(s.startsAt)}
                        accessibilityRole="radio"
                        accessibilityLabel={s.label}
                        accessibilityState={{ checked: on }}
                        style={[styles.time, on && styles.on]}
                      >
                        <Text style={[styles.timeText, on && { color: color.white }]}>{s.label}</Text>
                      </Press>
                    </Stagger>
                  );
                })}
              </View>
            </View>
            {error ? (
              <View role="alert">
                <ErrorText>{error}</ErrorText>
              </View>
            ) : null}
          </>
        )}
      </View>
    </PanelPage>
  );
}

/** The booked headline is 40 in English, as the design sets it; Hindi and Marathi keep their smaller size. */
function bookedSize(h1: number): number {
  return h1 === 36 ? 40 : h1;
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#BA5329', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.sansSemi, fontSize: 18, color: color.white },
  whoText: { flex: 1, fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: '#D6D4CE' },
  free: { fontFamily: font.sansMedium, fontSize: 14, lineHeight: 20, color: color.gold },
  body: { paddingHorizontal: space.lg, paddingTop: 22, paddingBottom: 8, gap: 22 },
  days: { flexDirection: 'row', gap: 6 },
  day: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: color.ring, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNum: { fontFamily: font.sansMedium, fontSize: 24, letterSpacing: -0.96, color: color.ink },
  on: { backgroundColor: color.ink, borderColor: color.ink },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeCell: { width: '48%', flexGrow: 1 },
  time: { minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: color.ring, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontFamily: font.mono, fontSize: 14.5, color: color.ink },
  booked: { paddingHorizontal: 24, gap: 28 },
  bookedSub: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.onDark2 },
  steps: { borderTopWidth: 1, borderTopColor: '#2A2A28' },
  step: { flexDirection: 'row', gap: 8, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A28' },
  stepNum: { width: 36, fontFamily: font.mono, fontSize: 13, color: color.ink3, paddingTop: 3 },
  stepText: { flex: 1, fontFamily: font.sans, fontSize: 16, lineHeight: 23, color: color.onDark },
});
