import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GeioOrb } from '../../components/brand';
import { Aura, Composer, Handover, Headset, Mine, NextStep, ReplyCards, SEND, Streamed, Thinking } from '../../components/geio/parts';
import { BackIcon, CheckIcon, FolderIcon, HomeIcon, ListIcon } from '../../components/icons';
import { Button, Press, Rise, Stagger } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { shortDate } from '../../lib/format';
import { LANGS, useHeadline, useLang, useT, type Key } from '../../lib/i18n';
import { usePlan } from '../../lib/plan';
import { useProfile } from '../../lib/profile';
import { useProject } from '../../lib/project';
import { color, font, radius } from '../../lib/theme';
import type { GeioReply, GeioTurn } from '../../lib/types';

/**
 * GEIO, the orb in the middle of the tab bar (designs #30 welcome, #31
 * chat, #33 hand-over): a text chat about their own home, in English,
 * Hindi or Marathi. The AI runs on the server; the app sends the question,
 * the last 8 turns and the language. The server answers whole, so the
 * screen shows "Reading…" while it waits and then lets the words arrive.
 * Price, date and discount questions come back as a hand-over to the
 * expert, which the server records. `/geio?ask=expert` (Ask Meera
 * elsewhere in the app) asks for the expert straight away.
 */

interface Turn {
  id: number;
  ask: string;
  /** Null while GEIO is thinking, or when the call failed. */
  reply: GeioReply | null;
  /** A calm line when the call failed; the question stays so it can be retried. */
  error: Key | null;
  /** Stream this answer in (only answers that arrived on this visit, once). */
  fresh: boolean;
}

const SUGGEST: { key: Key; icon: (c: string) => ReactNode }[] = [
  { key: 'geioApp.s.site', icon: (c) => <HomeIcon color={c} size={16} /> },
  { key: 'geioApp.s.decision', icon: (c) => <ListIcon color={c} size={16} /> },
  { key: 'geioApp.s.handover', icon: (c) => <CheckIcon color={c} size={16} /> },
  { key: 'geioApp.s.term', icon: (c) => <FolderIcon color={c} size={16} /> },
];

const ERRORS: Record<number, Key> = { 429: 'geioApp.err.busy', 503: 'geioApp.err.unavailable', 400: 'geioApp.err.empty' };

function greetKey(hour: number): Key {
  if (hour < 12) return 'geioApp.greet.morning';
  if (hour < 17) return 'geioApp.greet.afternoon';
  return 'geioApp.greet.evening';
}

/**
 * GEIO is part of Assured (owner, 11 Oct 2026). Before signing it stays open,
 * because it helps choose a studio; on Basic the tab shows what GEIO does and
 * the way to Assured instead.
 */
export default function GeioTab() {
  const { plan } = usePlan();
  return plan === 'basic' ? <GeioLocked /> : <GeioChat />;
}

function GeioLocked() {
  const t = useT();
  const { requested } = usePlan();
  return (
    <SafeAreaView style={[styles.safe, { padding: 20, gap: 18, justifyContent: 'center' }]} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <Aura quiet={false} />
      </View>
      <GeioOrb size={64} />
      <Rise>
        <Text role="heading" style={[styles.h1, { fontSize: 34, lineHeight: 36 }]}>{t('plan.geio.h1')}</Text>
      </Rise>
      <Text style={styles.intro}>{t('plan.geio.body')}</Text>
      {requested ? (
        <Text style={[styles.intro, { color: color.ok, fontFamily: font.sansMedium }]}>{t('plan.requested')}</Text>
      ) : (
        <Button label={t('plan.see')} onPress={() => router.push('/plan')} />
      )}
    </SafeAreaView>
  );
}

function GeioChat() {
  const { lang, setLang, t } = useLang();
  const headline = useHeadline(40);
  const { state: auth } = useAuth();
  const { profile } = useProfile();
  const { state: projectState } = useProject();
  const { ask: askParam } = useLocalSearchParams<{ ask?: string }>();

  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const nextId = useRef(1);
  const scroller = useRef<ScrollView>(null);

  const expert = profile.expert.name;
  const firstName = auth.status === 'signed-in' ? auth.user.name?.trim().split(/\s+/)[0] : undefined;
  const project = projectState.status === 'ready' ? projectState.project : null;
  const busy = turns.some((x) => x.reply === null && x.error === null);

  // What GEIO knows about their home, leaving out whatever is missing.
  const facts = useMemo(() => {
    const out: { text: string; now?: boolean }[] = [];
    const home = profile.home;
    const where = [home?.bhk, home?.locality].filter(Boolean).join(', ');
    if (where) out.push({ text: where });
    else if (home?.label) out.push({ text: home.label });
    if (home?.tier) out.push({ text: home.tier.charAt(0).toUpperCase() + home.tier.slice(1) });
    if (project?.studio) out.push({ text: project.studio });
    const now = project?.stages.find((s) => s.state === 'now');
    if (now) out.push({ text: t('geioApp.fact.now', { stage: now.label }), now: true });
    return out;
  }, [profile.home, project, t]);

  // The one next step under an answer: their most pressing open decision.
  const nextDecision = useMemo(() => {
    const open = (project?.decisions ?? []).filter((d) => d.state !== 'chosen');
    open.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    return open[0] ?? null;
  }, [project]);

  const send = useCallback(
    async (raw: string, retryId?: number) => {
      const question = raw.trim();
      if (!question || busy) return;
      const history: GeioTurn[] = turns
        .filter((x) => x.reply && x.id !== retryId)
        .flatMap((x) => [
          { role: 'user' as const, text: x.ask },
          { role: 'assistant' as const, text: x.reply!.paragraphs.join('\n\n') },
        ])
        .slice(-8);
      const id = retryId ?? nextId.current++;
      if (retryId) setTurns((all) => all.map((x) => (x.id === id ? { ...x, error: null } : x)));
      else setTurns((all) => [...all.map((x) => ({ ...x, fresh: false })), { id, ask: question, reply: null, error: null, fresh: true }]);
      setText('');

      const res = await api.geio(question, history, lang);
      if (res.ok) {
        const reply = res.data.reply;
        setTurns((all) => all.map((x) => (x.id === id ? { ...x, reply, fresh: true } : x)));
        setStreaming(true);
        if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(reply.paragraphs.join(' '));
      } else {
        setTurns((all) => all.map((x) => (x.id === id ? { ...x, error: ERRORS[res.status] ?? 'geioApp.err.other' } : x)));
      }
    },
    [busy, turns, lang],
  );

  // "Ask Meera" elsewhere in the app: ask for the expert as soon as GEIO is free.
  const askedExpert = useRef(false);
  useEffect(() => {
    if (askParam !== 'expert') {
      askedExpert.current = false;
      return;
    }
    if (busy || askedExpert.current) return;
    askedExpert.current = true;
    router.setParams({ ask: undefined });
    void send(t('geioApp.askExpert', { expert }));
  }, [askParam, busy, send, t, expert]);

  const scrollDown = useCallback(() => scroller.current?.scrollToEnd({ animated: false }), []);
  const last = turns[turns.length - 1];
  const chips = !busy && !streaming && last?.reply ? last.reply.follow : [];
  const [hour] = useState(() => new Date().getHours());
  const hello = t(greetKey(hour));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* The glow is wider than the phone; clipped in its own layer so the screen can never be scrolled sideways to it. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <Aura quiet={turns.length > 0} />
      </View>
      <View style={styles.header}>
        {turns.length ? (
          <Press
            onPress={() => {
              setTurns([]);
              setStreaming(false);
              scroller.current?.scrollTo({ y: 0, animated: false });
            }}
            disabled={busy}
            accessibilityLabel={t('geioApp.startOver')}
            style={styles.back}
          >
            <BackIcon color={color.ink} size={20} />
          </Press>
        ) : (
          <View style={{ width: 44 }} />
        )}
        <View style={styles.who}>
          <GeioOrb size={18} busy={busy} />
          <Text style={styles.whoText}>GEIO</Text>
        </View>
        <Press
          onPress={() => void send(t('geioApp.askExpert', { expert }))}
          disabled={busy}
          accessibilityLabel={t('geioApp.talkTo', { expert })}
          style={styles.expert}
        >
          <Headset />
          <Text style={styles.expertText}>{expert}</Text>
        </Press>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={turns.length ? styles.chat : styles.welcome}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => turns.length && scrollDown()}
        >
          {turns.length === 0 ? (
            <>
              <View style={{ gap: 14 }}>
                <GeioOrb size={56} />
                <Rise>
                  <Text role="heading" style={[styles.h1, { fontSize: headline, lineHeight: headline * (lang === 'en' ? 1.05 : 1.25), letterSpacing: headline * -0.045 }]}>
                    <Text style={{ color: color.accentInk }}>
                      {firstName ? t('geioApp.hello', { greet: hello, name: firstName }) : t('geioApp.helloAlone', { greet: hello })}
                    </Text>
                    {'\n'}
                    {t('geioApp.ask')}
                  </Text>
                </Rise>
                <Rise delay={120}>
                  <Text style={styles.intro}>{t('geioApp.intro')}</Text>
                </Rise>
                <View role="radiogroup" aria-label={t('geioApp.langs')} style={{ flexDirection: 'row', gap: 6 }}>
                  {LANGS.map((l) => {
                    const on = l.id === lang;
                    return (
                      <Press
                        key={l.id}
                        onPress={() => setLang(l.id)}
                        accessibilityRole="radio"
                        accessibilityLabel={l.label}
                        accessibilityState={{ checked: on }}
                        style={styles.langHit}
                      >
                        <View style={[styles.lang, on && { backgroundColor: color.ink }]}>
                          <Text style={[styles.langText, on && { color: color.onDark }]}>{l.label}</Text>
                        </View>
                      </Press>
                    );
                  })}
                </View>
              </View>

              {facts.length ? (
                <View accessible aria-label={`${t('geioApp.knows')}: ${facts.map((f) => f.text).join(', ')}`} style={styles.facts}>
                  {facts.map((f) => (
                    <Text key={f.text} style={[styles.fact, f.now && { color: color.accentInk }]}>
                      {f.text}
                    </Text>
                  ))}
                </View>
              ) : null}

              <View role="group" aria-label={t('geioApp.suggestions')} style={styles.grid}>
                {SUGGEST.map((s, i) => (
                  <Stagger key={s.key} i={i} start={220} style={styles.cell}>
                    <Press onPress={() => void send(t(s.key))} accessibilityLabel={t(s.key)} style={styles.suggest}>
                      <Text style={styles.suggestText}>{t(s.key)}</Text>
                      <View style={styles.suggestIcon}>{s.icon(color.accentInk)}</View>
                    </Press>
                  </Stagger>
                ))}
              </View>
            </>
          ) : (
            turns.map((x, i) => {
              const latest = i === turns.length - 1;
              const all = x.reply ? x.reply.paragraphs.join('\n\n') : '';
              return (
                <View key={x.id} style={{ gap: 20 }}>
                  <Mine text={x.ask} />
                  <View style={styles.ai}>
                    <GeioOrb size={28} busy={x.reply === null && x.error === null} style={{ marginTop: 2 }} />
                    <View
                      style={styles.aiBody}
                      accessible={!!x.reply}
                      accessibilityLabel={x.reply ? all : undefined}
                      accessibilityLiveRegion="polite"
                      aria-live="polite"
                    >
                      {x.error ? (
                        <View style={{ gap: 10 }}>
                          <Text style={styles.err}>{t(x.error, { expert })}</Text>
                          {latest ? (
                            <Press onPress={() => void send(x.ask, x.id)} disabled={busy} accessibilityLabel={t('geioApp.retry')} style={styles.retry}>
                              <Text style={styles.retryText}>{t('geioApp.retry')}</Text>
                            </Press>
                          ) : null}
                        </View>
                      ) : x.reply === null ? (
                        <Thinking label={t('geioApp.reading')} />
                      ) : (
                        <Streamed
                          paragraphs={x.reply.paragraphs}
                          stream={x.fresh && latest}
                          onGrow={latest ? scrollDown : undefined}
                          onDone={latest ? () => setStreaming(false) : undefined}
                          after={
                            <>
                              <ReplyCards reply={x.reply} />
                              {x.reply.handover ? (
                                <Handover expert={expert} context={x.reply.handover} />
                              ) : latest && nextDecision ? (
                                <NextStep id={nextDecision.id} title={nextDecision.title} date={shortDate(nextDecision.dueOn)} />
                              ) : null}
                            </>
                          }
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <Composer
          value={text}
          onChange={setText}
          onSend={() => void send(text)}
          busy={busy}
          placeholder={turns.length ? t('geioApp.placeholderMore') : t('geioApp.placeholder')}
          chips={chips}
          onChip={(q) => void send(q)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.paper, overflow: 'hidden' },
  header: { paddingTop: 10, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 2 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.6)' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoText: { fontFamily: font.sansBold, fontSize: 17, letterSpacing: 0.34, color: color.ink },
  expert: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.ink, flexDirection: 'row', alignItems: 'center', gap: 6 },
  expertText: { fontFamily: font.sansSemi, fontSize: 13, color: color.onDark },
  welcome: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 22 },
  chat: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, gap: 20 },
  h1: { fontFamily: font.sansMedium, color: color.ink },
  intro: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink2 },
  langHit: { minHeight: 44, justifyContent: 'center' },
  lang: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: color.soft },
  langText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: {
    fontFamily: font.sansMedium,
    fontSize: 13,
    letterSpacing: 13 * 0.07,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.7)',
    color: color.ink2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%', flexGrow: 1 },
  suggest: { minHeight: 116, borderRadius: radius.lg, backgroundColor: color.soft, padding: 14, justifyContent: 'space-between', gap: 10 },
  suggestText: { fontFamily: font.sansMedium, fontSize: 15, lineHeight: 20, color: color.ink },
  suggestIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5E2D8', alignItems: 'center', justifyContent: 'center' },
  ai: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  aiBody: { flex: 1, minWidth: 0, gap: 12 },
  err: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink2 },
  retry: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, borderColor: SEND, justifyContent: 'center' },
  retryText: { fontFamily: font.sansMedium, fontSize: 14, color: color.accentInk },
});
