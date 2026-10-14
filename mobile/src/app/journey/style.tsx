import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CoinToast } from '../../components/brand';
import { QuizScreen } from '../../components/journey/parts';
import { Body, Button, Eyebrow, Loading, Press, Rise, Title } from '../../components/ui';
import { useBrief } from '../../lib/brief';
import { localityLabel, type Brief, type PropertyType } from '../../lib/brief-types';
import { useHeadline, useT, type T } from '../../lib/i18n';
import { styleDna, stylePhoto } from '../../lib/style-dna';
import { color, font, type } from '../../lib/theme';

/**
 * #10 Your style DNA (designs/StyleDNA.dc.html), between the last question
 * and the matches: their picks as shares ("60% Warm modern, 40%
 * Scandinavian"), worked out on the phone as the website does
 * (lib/style-dna.ts), the leading style's materials, one sentence from the
 * household answers, and a share for the family that carries no name, flat
 * or number. "+100 coins" greets them on arrival.
 */

const HOMES: Record<PropertyType, string> = { BHK_1: '1 BHK', BHK_2: '2 BHK', BHK_3: '3 BHK', BHK_4_PLUS: '4+ BHK', VILLA: 'Villa' };
/** The design's bar: terracotta, then amber, then a pale gold for a third style. */
const BAR = ['#BA5329', '#C98A2B', '#E8B867'];
const LABEL = [color.onDark, '#E8B867', color.onDark2];

/** One plain sentence from who lives there (website: livedIn() in src/app/app/style/page.tsx). Nothing invented. */
function livedIn(brief: Brief, t: T): string | null {
  const h = brief.household;
  if (!h) return null;
  const parts: string[] = [];
  if (h.elderly > 0) parts.push(t(h.elderly === 1 ? 'quiz.style.parent' : 'quiz.style.parents'));
  if (h.children > 0) parts.push(t(h.children === 1 ? 'quiz.style.child' : 'quiz.style.children'));
  if (h.pets) parts.push(t('quiz.style.pet'));
  if (h.worksFromHome) parts.push(t('quiz.style.wfh'));
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} ${t('quiz.style.and')} ${parts[parts.length - 1]}`;
  return t('quiz.style.lived', { list });
}

export default function StyleDnaScreen() {
  const t = useT();
  const h1 = useHeadline(34);
  const { brief, ready } = useBrief();
  const [toast, setToast] = useState(true);
  const [shared, setShared] = useState(false);
  if (!ready) return <Loading />;

  const dna = styleDna(brief.styleLikes);
  if (!dna) {
    return (
      <QuizScreen back="/journey/q/7" footer={<Button label={t('quiz.style.none.cta')} onPress={() => router.replace('/journey/q/4' as Href)} />}>
        <Title size={h1}>{t('quiz.style.none.h1')}</Title>
        <Body muted>{t('quiz.style.none.sub')}</Body>
      </QuizScreen>
    );
  }

  const [lead, second] = dna.shares;
  const name = brief.contactName?.trim();
  const words = [
    (second ? t('style.leans', { lead: lead.label, second: second.label }) : t('style.leansOne', { lead: lead.label })) +
      ' ' +
      t('style.think', { materials: dna.materials.map((m) => m.toLowerCase()).join(', ') }),
    livedIn(brief, t),
  ]
    .filter(Boolean)
    .join(' ');
  const where = [localityLabel(brief.locality), brief.propertyType ? HOMES[brief.propertyType] : null].filter(Boolean).join(' · ');

  const share = async () => {
    try {
      const res = await Share.share({ message: dna.shareText });
      if (res.action !== Share.dismissedAction) setShared(true);
    } catch {
      // They closed the sheet, or the phone cannot share; nothing to say.
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <QuizScreen back="/journey/q/7" footerRule footer={<Button label={t('style.cta')} onPress={() => router.push('/journey/matches' as Href)} />}>
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('style.meta')}</Eyebrow>
          <Title size={h1}>{t('style.h1', { name: name ? `, ${name}` : '' })}</Title>
        </View>

        <Rise delay={180}>
          <View accessible aria-label={`${t('quiz.style.card')}: ${dna.shares.map((s) => `${s.pct}% ${s.label}`).join(', ')}`} style={styles.card}>
            <View style={styles.photos}>
              <Image source={{ uri: stylePhoto(lead.tag) }} style={{ flex: second ? 3 : 1 }} contentFit="cover" transition={200} />
              {second ? <Image source={{ uri: stylePhoto(second.tag) }} style={{ flex: 2 }} contentFit="cover" transition={200} /> : null}
            </View>
            <View style={styles.cardBody}>
              <View style={{ gap: 10 }}>
                <View style={styles.bar}>
                  {dna.shares.map((s, i) => (
                    <View key={s.tag} style={{ flex: s.pct, backgroundColor: BAR[i] }} />
                  ))}
                </View>
                <View style={styles.shares}>
                  {dna.shares.map((s, i) => (
                    <Text key={s.tag} style={[styles.share, { color: LABEL[i] }]}>
                      {s.pct}% {s.label}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.chips}>
                {dna.materials.map((m) => (
                  <Text key={m} style={styles.chip}>
                    {m}
                  </Text>
                ))}
              </View>
              <Text style={styles.words}>{words}</Text>
              <View style={styles.cardFoot}>
                <Text style={styles.where}>{where}</Text>
                <Image
                  source={require('../../../assets/brand/logo-ink.png')}
                  style={{ width: 40, height: 21, opacity: 0.85 }}
                  contentFit="contain"
                  tintColor={color.onDark}
                  accessibilityLabel="One Interiors"
                />
              </View>
            </View>
          </View>
        </Rise>

        <Rise delay={300}>
          <Press onPress={() => void share()} accessibilityLabel={`${shared ? t('style.shared') : t('style.share')}. ${t('style.share.sub')}`} style={styles.shareRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.shareTitle}>{shared ? t('style.shared') : t('style.share')}</Text>
              <Text style={styles.shareSub}>{t('style.share.sub')}</Text>
            </View>
            <View style={styles.shareGo}>
              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                <Path d="M7 17 17 7M8 7h9v9" fill="none" stroke={color.white} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Press>
        </Rise>
      </QuizScreen>
      {toast ? <CoinToast amount={100} onDone={() => setToast(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.ink, borderRadius: 20, overflow: 'hidden' },
  photos: { flexDirection: 'row', height: 190 },
  cardBody: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 14 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  shares: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  share: { fontFamily: font.sansSemi, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontFamily: font.sansMedium,
    fontSize: 13,
    color: color.onDark,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.1)',
    overflow: 'hidden',
  },
  words: { fontFamily: font.sans, fontSize: 15, lineHeight: 22.5, color: color.onDark2 },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.12)',
    paddingTop: 10,
  },
  where: { fontFamily: font.sans, fontSize: 13, color: color.ink3 },
  shareRow: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: color.soft,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareTitle: { ...type.body, fontFamily: font.sansSemi, fontSize: 15 },
  shareSub: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.ink2 },
  shareGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
});
