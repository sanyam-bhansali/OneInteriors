import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { CoinChip } from '../brand';
import { BellIcon, ChatIcon } from '../icons';
import { HouseMark } from './marks';
import { blockerLine, stepLine } from '../project/lifecycle';
import { Press, Rise, Stagger } from '../ui';
import { dayLabel, inr, shortDate } from '../../lib/format';
import { oneThingTarget } from '../../lib/chat-merge';
import type { T } from '../../lib/i18n';
import { color, font, warm } from '../../lib/theme';
import { STAGE_SHORT, type Lifecycle, type Project, type Update } from '../../lib/types';

/**
 * Home, as the owner's handoff draws it (Main.dc.html; the warm dark look,
 * 3 Nov 2026): the greeting and how ready the home is, the ring beside the
 * stages, "Your one thing today", the next payment, four shortcuts, and
 * today on site. Every figure is the project's own; with no percentage yet
 * the ring says so rather than showing 0 (unmeasured is not zero).
 */

function go(kind: NonNullable<Lifecycle['blocker']>['kind'], p: Project) {
  const target = oneThingTarget(kind, p.decisions);
  if (target.to === 'decision') return router.push({ pathname: '/decision/[id]', params: { id: target.id } });
  return router.push(target.to === 'snags' ? '/snags' : '/project');
}

function greeting(t: T): string {
  const h = new Date(Date.now() + 330 * 60_000).getUTCHours();
  return t(h < 12 ? 'one.morning' : h < 17 ? 'one.afternoon' : 'one.evening');
}

/** The headline's two halves: the plain words, then the warm ones. */
function headline(pct: number | null, t: T): [string, string] {
  if (pct === null) return [t('main.h1.started'), t('main.h1.started.warm')];
  if (pct >= 100) return [t('main.h1.ready'), t('main.h1.ready.warm')];
  if (pct >= 50) return [t('main.h1.half'), t('main.h1.half.warm')];
  return [t('main.h1.pct'), t('main.h1.pct.warm', { n: pct })];
}

const R = 48;
const C = 2 * Math.PI * R;

function Ring({ pct, t }: { pct: number | null; t: T }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <View style={styles.ring} accessible accessibilityLabel={pct === null ? t('main.ring.none') : t('main.ring.a11y', { n: v })}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={warm.ring[0]} />
            <Stop offset="1" stopColor={warm.ring[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={60} cy={60} r={R} stroke="rgba(255,236,214,.1)" strokeWidth={10} fill="none" />
        {v > 0 ? (
          <Circle cx={60} cy={60} r={R} stroke="url(#ring)" strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={`${(v / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
        ) : null}
      </Svg>
      <View style={styles.ringInner} pointerEvents="none">
        <Text style={styles.ringPct}>{pct === null ? '—' : `${v}%`}</Text>
        <Text style={styles.ringSub}>{pct === null ? t('main.ring.soon') : t('main.ring.done')}</Text>
      </View>
    </View>
  );
}

const Tick = () => (
  <View style={[styles.mark, { backgroundColor: color.ink }]}>
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="m2.5 6.2 2.2 2.2 4.8-5" stroke={color.onDark} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

function StageList({ p, t }: { p: Project; t: T }) {
  /* Five stages around the current one, as the design shows. */
  const at = Math.max(0, p.stages.findIndex((s) => s.state === 'now'));
  const from = Math.max(0, Math.min(at - 1, p.stages.length - 5));
  const shown = p.stages.slice(from, from + 5);
  return (
    <View style={{ flex: 1, gap: 2 }}>
      {shown.map((s, i) => {
        const last = s === p.stages[p.stages.length - 1];
        const first = i === shown.findIndex((x) => x.state !== 'done' && x.state !== 'now');
        return (
          <View key={s.key} style={[styles.stageRow, i < shown.length - 1 && styles.stageLine]}>
            {s.state === 'done' ? (
              <Tick />
            ) : s.state === 'now' ? (
              <View style={[styles.mark, { borderWidth: 2, borderColor: color.ink }]}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color.accentWarm }} />
              </View>
            ) : (
              <View style={[styles.mark, { borderWidth: 1.5, borderColor: color.ink3 }]} />
            )}
            <Text style={styles.stageName} numberOfLines={1}>
              {STAGE_SHORT[s.key] ?? s.label}
            </Text>
            {s.state === 'now' ? (
              <View style={styles.ongoing}>
                <Text style={styles.ongoingText}>{t('main.stage.now')}</Text>
              </View>
            ) : (
              <Text style={styles.stageState}>{s.state === 'done' ? t('one.done') : last ? t('main.stage.last') : first ? t('one.next') : t('main.stage.later')}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A cream card: the handoff's "Your one thing today" and "Next payment". */
function Cream({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <LinearGradient colors={warm.cream} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cream, style]}>
      {children}
    </LinearGradient>
  );
}

const Wallet = () => (
  <Svg width={26} height={26} viewBox="0 0 24 24">
    <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H17v2.5M4 8.5V17a2 2 0 0 0 2 2h12.5a1.5 1.5 0 0 0 1.5-1.5V10a1.5 1.5 0 0 0-1.5-1.5H6.5A2.5 2.5 0 0 1 4 8.5Z" stroke="#C8622E" strokeWidth={1.7} fill="none" strokeLinejoin="round" />
    <Path d="M16 13.5h1.5" stroke="#C8622E" strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

const TileIcon = ({ d }: { d: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24">
    <Path d={d} stroke={color.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const PLAN = 'M7 4v3M17 4v3M4.5 9.5h15M6 6h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6 6Z';
const PHOTO = 'M5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11A1.5 1.5 0 0 1 5.5 5Zm-1 11 4.5-4.5 4 4 2.5-2.5 4 4M15.5 9.5h.01';
const DOC = 'M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5ZM14 3.5V8h4M8.5 12h7M8.5 15.5h7';

export function MainHome({
  p,
  name,
  unread,
  coins,
  latest,
  t,
  refreshing,
  onRefresh,
}: {
  p: Project;
  name: string;
  unread: number;
  coins: number;
  /** The latest from site, in one shape (home.tsx `fromSite`). */
  latest: Update | null;
  t: T;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const life = p.lifecycle ?? null;
  const blocker = life ? blockerLine(life, t) : null;
  const pct = typeof p.progressPct === 'number' ? p.progressPct : null;
  const [plain, warmWords] = headline(pct, t);
  const next = p.money?.next ?? null;
  const thumb = latest?.photos[0] ?? null;
  const tiles: { label: string; d: string | null; to: () => void }[] = [
    { label: t('main.tile.plan'), d: PLAN, to: () => router.push('/project') },
    { label: t('main.tile.site'), d: PHOTO, to: () => router.push('/site') },
    { label: t('main.tile.pay'), d: DOC, to: () => router.push('/project') },
    { label: t('main.tile.expert'), d: null, to: () => router.push('/geio') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />}>
        <View style={styles.head}>
          <View style={styles.brand}>
            <HouseMark color={color.accentWarm} />
            <Text style={styles.brandText}>One Interiors</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {coins > 0 ? <CoinChip balance={coins} onPress={() => router.push('/me')} /> : null}
            <Press onPress={() => router.push('/notifications')} accessibilityLabel={t('one.notifications', { n: unread })} style={styles.bell}>
              <BellIcon color={color.ink} />
              {unread > 0 ? <View style={styles.dot} /> : null}
            </Press>
          </View>
        </View>

        <Rise>
          <Text style={styles.hello}>{name ? `${greeting(t)}, ${name}` : greeting(t)}</Text>
          <Text role="heading" style={styles.h1}>
            {plain} <Text style={{ color: color.accentWarm }}>{warmWords}</Text>
          </Text>
          <Text style={styles.lede}>{t('main.lede')}</Text>
        </Rise>

        {p.stages.length ? (
          <Rise delay={120} style={styles.progress}>
            <Ring pct={pct} t={t} />
            <View style={styles.divider} />
            <StageList p={p} t={t} />
          </Rise>
        ) : null}

        <Rise delay={200}>
          <Press onPress={() => (blocker && life?.blocker ? go(life.blocker.kind, p) : router.push('/project'))} accessibilityRole="link" haptic={false}>
            <Cream style={styles.oneThing}>
              {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" accessibilityLabel={t('one.photo')} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.kicker}>{blocker ? t('main.one') : t('life.nothing')}</Text>
                <Text style={styles.oneTitle} numberOfLines={3}>
                  {blocker ?? (life ? stepLine(life.current, t) : t('one.working', { studio: p.studio }))}
                </Text>
              </View>
              <View style={styles.chev}>
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  <Path d="m6 3.5 4.5 4.5L6 12.5" stroke="#C8622E" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </Cream>
          </Press>
        </Rise>

        {next ? (
          <Rise delay={260}>
            <Cream style={styles.pay}>
              <View style={styles.payIcon}>
                <Wallet />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.payTitle}>{t('home.pay.title')}</Text>
                <Text style={styles.payAmt}>{inr(next.amountPaise)}</Text>
                <Text style={styles.payWhen} numberOfLines={2}>
                  {next.dueOn ? t('main.pay.due', { studio: p.studio, date: shortDate(next.dueOn) }) : t('main.pay.when', { studio: p.studio, stage: next.label })}
                </Text>
              </View>
              <Press onPress={() => router.push('/project')} accessibilityRole="link" style={{ borderRadius: 999, overflow: 'hidden' }}>
                <LinearGradient colors={warm.buttonDeep} style={styles.payBtn}>
                  <Text style={styles.payBtnText}>{t('main.pay.details')}</Text>
                </LinearGradient>
              </Press>
            </Cream>
          </Rise>
        ) : null}

        <View style={styles.tiles}>
          {tiles.map((x, i) => (
            <Stagger key={x.label} i={i} start={300} style={{ flex: 1 }}>
              <Press onPress={x.to} accessibilityRole="link" accessibilityLabel={x.label}>
                <LinearGradient colors={warm.glass} style={styles.tile}>
                  {x.d ? <TileIcon d={x.d} /> : <ChatIcon color={color.ink} size={26} />}
                  <Text style={styles.tileText} numberOfLines={2}>
                    {x.label}
                  </Text>
                </LinearGradient>
              </Press>
            </Stagger>
          ))}
        </View>

        <View style={styles.site}>
          <View style={styles.siteHead}>
            <Text role="heading" style={styles.h2}>
              {t(latest && sameDay(latest.at) ? 'home.site.today' : 'home.site.latest')}
            </Text>
            {latest ? (
              <View style={styles.dayChip}>
                <Text style={styles.dayText}>{dayLabel(latest.at)}</Text>
              </View>
            ) : null}
          </View>
          {latest?.photos.length ? (
            <Press onPress={() => router.push('/site')} haptic={false} accessibilityRole="link" accessibilityLabel={t('home.site.all')} style={styles.photos}>
              {latest.photos.slice(0, 3).map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={styles.photo} contentFit="cover" transition={300} accessibilityLabel={t('home.site.photo', { n: i + 1 })} />
              ))}
            </Press>
          ) : (
            <Text style={styles.lede}>{t('home.site.empty', { studio: p.studio })}</Text>
          )}
          {latest?.note ? (
            <Text style={styles.siteNote} numberOfLines={3}>
              {latest.note}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const sameDay = (iso: string) => {
  const d = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return d(Date.parse(iso)) === d(Date.now());
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: font.sansSemi, fontSize: 19, letterSpacing: -0.4, color: color.ink },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,236,214,.08)', borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: color.accentWarm },
  hello: { fontFamily: font.sans, fontSize: 16, color: color.ink2, marginBottom: 8 },
  h1: { fontFamily: font.sansSemi, fontSize: 34, lineHeight: 37, letterSpacing: 34 * -0.04, color: color.ink },
  lede: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: color.ink2, marginTop: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ringInner: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontFamily: font.sansSemi, fontSize: 28, letterSpacing: -1, color: color.ink },
  ringSub: { fontFamily: font.sans, fontSize: 12.5, color: color.ink2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: color.line },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  stageLine: { borderBottomWidth: 1, borderBottomColor: color.line },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stageName: { flex: 1, fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  stageState: { fontFamily: font.sans, fontSize: 13.5, color: color.ink2 },
  ongoing: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(240,138,75,.22)' },
  ongoingText: { fontFamily: font.sansMedium, fontSize: 13, color: warm.orange },
  cream: { borderRadius: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  oneThing: { minHeight: 104 },
  thumb: { width: 92, height: 76, borderRadius: 14 },
  kicker: { fontFamily: font.sansSemi, fontSize: 14, color: '#B85C2C' },
  oneTitle: { fontFamily: font.sansMedium, fontSize: 17, lineHeight: 22, color: warm.creamText },
  chev: { width: 40, height: 40, borderRadius: 12, backgroundColor: warm.creamIcon, alignItems: 'center', justifyContent: 'center' },
  pay: { paddingVertical: 16 },
  payIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: warm.creamIcon, alignItems: 'center', justifyContent: 'center' },
  payTitle: { fontFamily: font.sansSemi, fontSize: 15, color: warm.creamText },
  payAmt: { fontFamily: font.sansBold, fontSize: 24, letterSpacing: -0.6, color: warm.creamText },
  payWhen: { fontFamily: font.sans, fontSize: 13, color: warm.creamMuted },
  payBtn: { minHeight: 42, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  payBtnText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.white },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { minHeight: 96, borderRadius: 18, borderWidth: 1, borderColor: warm.glassRing, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 12 },
  tileText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink, textAlign: 'center' },
  site: { backgroundColor: '#1E1712', borderRadius: 26, padding: 16, gap: 12, marginHorizontal: -8 },
  siteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.6, color: color.ink },
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: color.line, backgroundColor: 'rgba(255,236,214,.06)' },
  dayText: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink },
  photos: { flexDirection: 'row', gap: 8 },
  photo: { flex: 1, aspectRatio: 0.85, borderRadius: 16, backgroundColor: color.soft },
  siteNote: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 21, color: color.ink2 },
});
