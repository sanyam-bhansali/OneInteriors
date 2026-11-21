import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Loading, Rise, Screen, Title } from '../components/ui';
import { call } from '../lib/api';
import { useHeadline, useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * Design your home (owner, 4 Nov 2026), the app's half of /account/design:
 * the Design DNA card, a mood board per room (tap to add or remove), and AI
 * room ideas with a yes / no under each. Everything is the same account, so
 * a board started on the laptop is here, and an answer here reshapes the DNA
 * the website shows.
 */

const REASONS = ['too_dark', 'too_light', 'too_busy', 'too_plain', 'wrong_colours', 'too_expensive'] as const;
type Reason = (typeof REASONS)[number];

type Mockup = { id: string; round: number; variant: string; caption: string; url: string | null; verdict: 'up' | 'down' | null; reason: Reason | null; sample: boolean };
type Dna = {
  shares: { tag: string; label: string; pct: number }[];
  palette: string[];
  materials: string[];
  moods: string[];
  confidence: string;
  budget: { aboveBand: number; total: number; stretching: boolean };
  evidence: { likes: number; boardItems: number; answers: number };
};
type Choice = { slug: string; label: string; category: string; colours: string[]; aboveBudget: boolean };
type Board = { room: string; label: string; items: string[]; choices: Choice[] };
type Reply =
  | { design: { open: false; why: string } }
  | { design: { open: true; dna: Dna; left: number; rooms: { room: string; label: string; mockups: Mockup[] }[] }; boards: Board[] };

export default function DesignScreen() {
  const t = useT();
  const size = useHeadline(40);
  const [data, setData] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await call<Reply>('GET', '/design');
    if (res.ok) setData(res.data);
    else setError(res.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!data && !error) return <Loading />;
  if (!data) {
    return (
      <Screen back>
        <Title size={size}>{t('dd.title')}</Title>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  if (!data.design.open) {
    return (
      <Screen back>
        <Eyebrow>{t('dd.title')}</Eyebrow>
        <Title size={size}>{t('dd.h1')}</Title>
        <Body muted>{data.design.why === 'no_call' ? t('dd.closed.call') : t('dd.closed.profile')}</Body>
      </Screen>
    );
  }

  const { dna, rooms, left } = data.design;
  const boards = 'boards' in data ? data.boards : [];
  const openBoard = boards.find((b) => b.room === (room ?? boards[0]?.room)) ?? null;

  async function toggle(board: Board, slug: string) {
    const items = board.items.includes(slug) ? board.items.filter((s) => s !== slug) : [...board.items, slug];
    const res = await call<object>('PUT', '/design/board', { room: board.room, items });
    if (!res.ok) return setError(res.error);
    setError(null);
    void load();
  }

  async function draw(r: string) {
    setDrawing(r);
    setError(null);
    const res = await call<{ drawn: number }>('POST', '/design/round', { room: r });
    setDrawing(null);
    if (!res.ok) return setError(res.error);
    void load();
  }

  async function answer(id: string, verdict: 'up' | 'down', reason: Reason | null) {
    const res = await call<object>('POST', `/design/mockups/${encodeURIComponent(id)}`, { verdict, reason });
    setAsking(null);
    if (!res.ok) return setError(res.error);
    void load();
  }

  return (
    <Screen
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Rise style={{ gap: 8 }}>
        <Eyebrow>{t('dd.title')}</Eyebrow>
        <Title size={size}>{t('dd.h1')}</Title>
        <Body muted>{t('dd.lede')}</Body>
      </Rise>

      <View style={styles.card}>
        <Text style={styles.small}>{dna.confidence}</Text>
        <Text style={styles.dna}>{dna.shares.map((s) => `${s.pct}% ${s.label}`).join(' · ')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }} aria-hidden>
          {dna.palette.map((c, i) => (
            <View key={`${c}-${i}`} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.value}>{dna.moods.join(', ')}</Text>
        <Text style={styles.small}>{t('dd.materials', { list: dna.materials.join(', ') })}</Text>
        {dna.budget.stretching ? <Text style={styles.small}>{t('dd.stretch', { above: dna.budget.aboveBand, total: dna.budget.total })}</Text> : null}
        <Text style={styles.small}>{t('dd.evidence', { likes: dna.evidence.likes, items: dna.evidence.boardItems, answers: dna.evidence.answers })}</Text>
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.section}>
        <Text style={styles.h}>{t('dd.board.h')}</Text>
        <Body muted style={{ fontSize: 14 }}>{t('dd.board.sub')}</Body>
        <View style={styles.wrap}>
          {boards.map((b) => (
            <Pressable key={b.room} onPress={() => setRoom(b.room)} style={[styles.tab, openBoard?.room === b.room && styles.tabOn]}>
              <Text style={[styles.tabText, openBoard?.room === b.room && styles.tabTextOn]}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
        {openBoard ? (
          <View style={styles.wrap}>
            {openBoard.choices.map((c) => {
              const on = openBoard.items.includes(c.slug);
              return (
                <Pressable key={c.slug} onPress={() => void toggle(openBoard, c.slug)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
                  <View style={[styles.dot, { backgroundColor: c.colours[0] }]} />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {c.label}
                    {c.aboveBudget ? ` · ${t('dd.board.above')}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.h}>{t('dd.ideas.h')}</Text>
        <Text style={styles.small}>{t('dd.ideas.note', { n: left })}</Text>
        {rooms.map((r) => {
          const latest = r.mockups.length ? Math.max(...r.mockups.map((m) => m.round)) : 0;
          const current = r.mockups.filter((m) => m.round === latest);
          return (
            <View key={r.room} style={{ gap: 10, marginTop: 14 }}>
              <Text style={styles.roomLabel}>{r.label}</Text>
              {current.some((m) => m.verdict === null) ? <Text style={styles.small}>{t('dd.ideas.ask')}</Text> : null}
              {current.map((m) => (
                <View key={m.id} style={styles.idea}>
                  {m.url ? <Image source={{ uri: m.url }} style={styles.pic} accessibilityLabel={m.caption} /> : <View style={styles.pic} />}
                  <Text style={styles.value}>{m.caption}</Text>
                  {m.sample ? <Text style={styles.small}>{t('dd.sample')}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => void answer(m.id, 'up', null)} style={[styles.chip, m.verdict === 'up' && styles.chipOn]}>
                      <Text style={[styles.chipText, m.verdict === 'up' && styles.chipTextOn]}>👍 {t('dd.yes')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setAsking(asking === m.id ? null : m.id)} style={[styles.chip, m.verdict === 'down' && styles.chipOn]}>
                      <Text style={[styles.chipText, m.verdict === 'down' && styles.chipTextOn]}>👎 {t('dd.no')}</Text>
                    </Pressable>
                  </View>
                  {m.verdict === 'down' && m.reason ? <Text style={styles.small}>{t(`dd.reason.${m.reason}` as never)}</Text> : null}
                  {asking === m.id ? (
                    <View style={styles.wrap}>
                      <Text style={[styles.small, { width: '100%' }]}>{t('dd.why')}</Text>
                      {REASONS.map((reason) => (
                        <Pressable key={reason} onPress={() => void answer(m.id, 'down', reason)} style={styles.chip}>
                          <Text style={styles.chipText}>{t(`dd.reason.${reason}` as never)}</Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => void answer(m.id, 'down', null)} style={styles.chip}>
                        <Text style={styles.chipText}>{t('dd.justNo')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
              <Button
                label={drawing === r.room ? t('dd.ideas.drawing') : latest === 0 ? t('dd.ideas.first') : t('dd.ideas.more')}
                variant={latest === 0 ? undefined : 'ghost'}
                busy={drawing === r.room}
                disabled={drawing !== null || left < 3}
                onPress={() => void draw(r.room)}
              />
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, gap: 10, padding: 18, borderRadius: 20, backgroundColor: color.soft },
  dna: { fontFamily: font.sansMedium, fontSize: 19, lineHeight: 26, color: color.ink },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: color.ring },
  section: { marginTop: 26, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, paddingTop: 16 },
  h: { fontFamily: font.sansMedium, fontSize: 18, color: color.ink },
  roomLabel: { fontFamily: font.sansMedium, fontSize: 16, color: color.ink },
  small: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.ink2 },
  value: { fontFamily: font.sans, fontSize: 15, lineHeight: 21, color: color.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: color.ring },
  tabOn: { backgroundColor: color.ink, borderColor: color.ink },
  tabText: { fontFamily: font.sans, fontSize: 13.5, color: color.ink },
  tabTextOn: { color: color.paper },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: color.ring },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontFamily: font.sans, fontSize: 13, color: color.ink },
  chipTextOn: { color: color.onAccent },
  dot: { width: 12, height: 12, borderRadius: 6 },
  idea: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: color.soft },
  pic: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: color.soft2 },
});
