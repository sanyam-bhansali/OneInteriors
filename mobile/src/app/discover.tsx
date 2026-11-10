import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ErrorText, Eyebrow, Loading, Meta, Press, Screen, Title } from '../components/ui';
import { HeartIcon } from '../components/icons';
import { call } from '../lib/api';
import { lakh } from '../lib/format';
import { useHeadline, useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * Discover in the phone app (owner, 7 Nov 2026): the same Pinterest-style
 * feed of real Pune rooms as the website's /discover. Rooms are ranked on the
 * server by the website's rules (POST /discover/next); saves are kept on the
 * Home Profile (POST /discover/saves), so the website, the app and the
 * expert all see one list. After 20 saves the style shows, and "Use this
 * style" puts it in the Home Profile. Opened from Me.
 */

const REVEAL_AT = 20;
const ROOMS = ['living', 'kitchen', 'bedroom', 'mandir'] as const;
type Room = (typeof ROOMS)[number];

type Price = { label: string; lowPaise: number; highPaise: number | null } | null;
type Pin = {
  id: string;
  kind: 'built' | 'example';
  src: string;
  alt: string;
  room: string;
  studioId: string | null;
  credit: string | null;
  price: Price;
};
type Reveal = {
  ready: boolean;
  saves: number;
  shares: { tag: string; label: string; pct: number }[];
  studioIds: string[];
  price: Price;
};
type Start = { hasProfile: boolean; sqft: number; sqftAssumed: boolean; saved: string[] };
type Next = { pins: Pin[]; exhausted: boolean; reveal: Reveal };

export default function DiscoverScreen() {
  const t = useT();
  const size = useHeadline(36);
  const [start, setStart] = useState<Start | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const more = useCallback(
    async (opts: { reset?: boolean; savedNow?: string[]; skippedNow?: string[]; roomNow?: Room | null } = {}) => {
      const s = opts.savedNow ?? saved;
      const k = opts.skippedNow ?? skipped;
      const r = opts.roomNow === undefined ? room : opts.roomNow;
      if (opts.reset) seen.current = new Set();
      setBusy(true);
      const res = await call<Next>('POST', '/discover/next', { saved: s, skipped: k, seen: [...seen.current], room: r, count: 12 });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      res.data.pins.forEach((p) => seen.current.add(p.id));
      setPins((cur) => (opts.reset ? res.data.pins : [...cur, ...res.data.pins]));
      setExhausted(res.data.exhausted);
      setReveal(res.data.reveal);
    },
    [saved, skipped, room],
  );

  useEffect(() => {
    void (async () => {
      const res = await call<Start>('GET', '/discover');
      if (!res.ok) return setError(res.error);
      setStart(res.data);
      setSaved(res.data.saved);
      await more({ reset: true, savedNow: res.data.saved, skippedNow: [], roomNow: null });
    })();
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep saves on the Home Profile, a moment after the last tap.
  useEffect(() => {
    if (!start?.hasProfile) return;
    const timer = setTimeout(() => void call('POST', '/discover/saves', { saved }), 1200);
    return () => clearTimeout(timer);
  }, [saved, start?.hasProfile]);

  if (error && !start) {
    return (
      <Screen back>
        <Title size={size}>{t('me.discover')}</Title>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }
  if (!start) return <Loading />;

  const toggle = (id: string) => setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const skip = (id: string) => {
    setSkipped((cur) => [...cur, id]);
    setSaved((cur) => cur.filter((x) => x !== id));
    setPins((cur) => cur.filter((p) => p.id !== id));
  };
  const pickRoom = (r: Room | null) => {
    setRoom(r);
    void more({ reset: true, roomNow: r });
  };
  const range = (p: NonNullable<Price>) =>
    p.highPaise === null ? t('dc.andUp', { from: lakh(p.lowPaise) }) : `${lakh(p.lowPaise)}–${lakh(p.highPaise)}`;

  const saves = saved.length;
  const ready = Boolean(reveal?.ready) || saves >= REVEAL_AT;
  const columns: [Pin[], Pin[]] = [pins.filter((_, i) => i % 2 === 0), pins.filter((_, i) => i % 2 === 1)];

  const applyStyle = async () => {
    if (!reveal) return;
    const res = await call<{ saved: boolean }>('POST', '/discover/style', {
      styles: reveal.shares.map((s) => s.tag),
      studioIds: reveal.studioIds,
    });
    if (res.ok && res.data.saved) setUsed(true);
  };

  return (
    <Screen back>
      <View style={{ gap: 8 }}>
        <Eyebrow>{t('me.discover')}</Eyebrow>
        <Title size={size}>{t('dc.title')}</Title>
        <Body muted>{t('dc.lede', { n: REVEAL_AT })}</Body>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.count}>{ready ? t('dc.ready') : t('dc.count', { n: saves, total: REVEAL_AT })}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (saves / REVEAL_AT) * 100)}%` }]} />
        </View>
      </View>

      {ready && reveal && reveal.shares.length > 0 ? (
        <Card style={{ gap: 10 }}>
          <Eyebrow>{t('dc.yourStyle')}</Eyebrow>
          <Text style={styles.styleName}>{reveal.shares.map((s) => s.label).join(' + ')}</Text>
          <Meta>{t('dc.from', { n: saves })}</Meta>
          {reveal.shares.map((s) => (
            <View key={s.tag} style={{ gap: 4 }}>
              <View style={styles.shareRow}>
                <Text style={styles.shareLabel}>{s.label}</Text>
                <Text style={styles.shareLabel}>{s.pct}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${s.pct}%` }]} />
              </View>
            </View>
          ))}
          {reveal.price ? <Body>{t('dc.builtAt', { tier: reveal.price.label, range: range(reveal.price) })}</Body> : null}
          {start.hasProfile ? (
            used ? (
              <Body>{t('dc.used')}</Body>
            ) : (
              <Button label={t('dc.use')} onPress={() => void applyStyle()} />
            )
          ) : (
            <>
              <Meta>{t('dc.noProfile')}</Meta>
              <Button label={t('dc.start')} onPress={() => router.push('/journey/name')} />
            </>
          )}
        </Card>
      ) : null}

      {pins.some((p) => p.price) ? (
        <Meta>{t(start.sqftAssumed ? 'dc.priceNoteTypical' : 'dc.priceNote', { sqft: start.sqft })}</Meta>
      ) : null}

      <View style={styles.chips}>
        <Chip label={t('dc.all')} on={room === null} onPress={() => pickRoom(null)} />
        {ROOMS.map((r) => (
          <Chip key={r} label={t(`dc.room.${r}`)} on={room === r} onPress={() => pickRoom(r)} />
        ))}
      </View>

      <View style={styles.grid}>
        {columns.map((col, ci) => (
          <View key={ci} style={styles.column}>
            {col.map((p) => {
              const on = saved.includes(p.id);
              return (
                <View key={p.id} style={styles.card}>
                  <View>
                    <Image source={{ uri: p.src }} style={styles.image} contentFit="cover" accessibilityLabel={p.alt} />
                    <Text style={[styles.badge, p.kind === 'built' ? styles.badgeBuilt : null]}>
                      {p.kind === 'built' ? t('dc.built') : t('dc.example')}
                    </Text>
                    <Press
                      onPress={() => toggle(p.id)}
                      accessibilityLabel={on ? t('dc.saved') : t('dc.save')}
                      style={[styles.heart, on ? styles.heartOn : null]}
                    >
                      <HeartIcon color={on ? '#FFFFFF' : '#1A1A1A'} filled={on} />
                    </Press>
                  </View>
                  <View style={styles.cardFoot}>
                    {p.price ? (
                      <View>
                        <Text style={styles.price}>{range(p.price)}</Text>
                        <Text style={styles.small}>{p.price.label}</Text>
                      </View>
                    ) : p.credit ? (
                      <Text style={styles.small}>{p.credit}, Unsplash</Text>
                    ) : null}
                    <Press onPress={() => skip(p.id)} accessibilityLabel={t('dc.skip')}>
                      <Text style={styles.skip}>{t('dc.skip')}</Text>
                    </Press>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {exhausted ? (
        <Meta style={{ textAlign: 'center' }}>{t('dc.end')}</Meta>
      ) : (
        <Button variant="quiet" label={t('dc.more')} busy={busy} onPress={() => void more()} />
      )}
      <Meta>{t('dc.honest')}</Meta>
    </Screen>
  );
}

const styles = StyleSheet.create({
  count: { color: color.ink, fontFamily: font.sansMedium, fontSize: 14 },
  track: { height: 6, borderRadius: 3, backgroundColor: color.soft, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.accent },
  styleName: { color: color.ink, fontFamily: font.sansSemi, fontSize: 24, lineHeight: 30 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shareLabel: { color: color.ink, fontFamily: font.sans, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 10 },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: color.soft, borderWidth: 1, borderColor: color.line },
  image: { width: '100%', aspectRatio: 4 / 5 },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontFamily: font.sansMedium,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badgeBuilt: { backgroundColor: color.accent },
  heart: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heartOn: { backgroundColor: '#C1582E' },
  cardFoot: { padding: 10, gap: 6 },
  price: { color: color.ink, fontFamily: font.sansMedium, fontSize: 13 },
  small: { color: color.ink2, fontFamily: font.sans, fontSize: 12 },
  skip: { color: color.ink3, fontFamily: font.sans, fontSize: 12 },
});
