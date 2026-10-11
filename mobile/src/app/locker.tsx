import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DocArrowIcon, SearchIcon } from '../components/me/icons';
import { Body, Eyebrow, Loading, Meta, Press, Rise, Screen, Stagger, Title } from '../components/ui';
import { shortDate } from '../lib/format';
import { useHeadline, useT } from '../lib/i18n';
import { useProfile } from '../lib/profile';
import { useProject } from '../lib/project';
import { color, font } from '../lib/theme';
import { DOC_KINDS, type Doc } from '../lib/types';

/**
 * Home locker (Locker.dc.html, screen 28, opened from Me): every document
 * about the home, searchable, grouped by kind, opened through its signed
 * link in the phone's browser. The design's "What your home is made of"
 * section waits for materials data the backend does not have yet.
 */
export default function Locker() {
  const t = useT();
  const size = useHeadline(42);
  const { profile } = useProfile();
  const { state, refresh, refreshing } = useProject();
  const [q, setQ] = useState('');
  if (state.status === 'loading') return <Loading />;

  const home = profile.home?.label;
  const header = (
    <Rise style={{ gap: 8 }}>
      <Eyebrow>{home ? t('locker.eyebrow.home', { home }) : t('locker.eyebrow')}</Eyebrow>
      <Title size={size}>
        {t('me.locker')}
      </Title>
    </Rise>
  );

  if (state.status === 'none') {
    return (
      <Screen back>
        <View style={styles.body}>
          {header}
          <Body muted>{t('locker.none')}</Body>
        </View>
      </Screen>
    );
  }

  const p = state.project;
  const kindName = (k: Doc['kind']) => t(`locker.kind.${k}`);
  const term = q.trim().toLowerCase();
  const docs = p.documents.filter((d) => !term || `${d.title} ${DOC_KINDS[d.kind]} ${kindName(d.kind)} ${d.meta}`.toLowerCase().includes(term));
  const kinds = (Object.keys(DOC_KINDS) as Doc['kind'][])
    .map((k) => ({ kind: k, docs: docs.filter((d) => d.kind === k) }))
    .filter((g) => g.docs.length)
    .map((g, i, all) => ({ ...g, start: all.slice(0, i).reduce((n, x) => n + x.docs.length, 0) }));
  // Warranties arrive at handover; until then the design shows the shelf, greyed, with its date.
  const handover = p.stages.find((s) => s.key === 'HANDOVER');
  const warrantyLater = !term && !p.documents.some((d) => d.kind === 'WARRANTY') && handover?.state !== 'done';

  return (
    <Screen back onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={styles.body}>
        {header}

        <Rise delay={120}>
          <View style={styles.search}>
            <SearchIcon color={color.ink2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('locker.search.placeholder')}
              placeholderTextColor={color.ink3}
              accessibilityLabel={t('locker.search')}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        </Rise>

        <View>
          <Text role="heading" style={styles.h2}>
            {t('locker.docs')}
          </Text>
          {p.documents.length === 0 ? <Body muted>{t('locker.empty', { studio: p.studio })}</Body> : null}
          {term && docs.length === 0 ? <Body muted>{t('locker.noMatch', { q: q.trim() })}</Body> : null}
          {kinds.map((g) => (
            <View key={g.kind}>
              <Eyebrow style={styles.kind}>{kindName(g.kind)}</Eyebrow>
              {g.docs.map((d, j) => (
                <Stagger key={d.id} i={Math.min(g.start + j, 8)} start={160}>
                  <Press
                    haptic={false}
                    disabled={!d.url}
                    accessibilityRole="link"
                    accessibilityLabel={t('locker.open', { title: d.title })}
                    onPress={() => {
                      // Signed links last minutes; pull to refresh makes fresh ones.
                      if (d.url) void WebBrowser.openBrowserAsync(d.url);
                    }}
                    style={styles.doc}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.docTitle}>{d.title}</Text>
                      {d.meta ? <Text style={styles.docMeta}>{d.meta}</Text> : null}
                    </View>
                    <DocArrowIcon color={color.ink2} />
                  </Press>
                </Stagger>
              ))}
            </View>
          ))}
          {warrantyLater ? (
            <View style={[styles.doc, styles.later]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.docTitle, { color: color.ink3 }]}>{kindName('WARRANTY')}</Text>
                <Text style={[styles.docMeta, { color: color.ink3 }]}>
                  {handover ? t('locker.warranty.later', { date: shortDate(handover.targetOn) }) : t('locker.warranty.laterNoDate')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ borderTopWidth: 1, borderTopColor: color.line }} />
          )}
        </View>
        {p.documents.length ? <Meta style={{ color: color.ink3 }}>{t('locker.hint')}</Meta> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 22, paddingTop: 2 },
  search: {
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.ring,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, minHeight: 44, fontFamily: font.sans, fontSize: 15, color: color.ink, paddingVertical: 0 },
  h2: { fontFamily: font.sansMedium, fontSize: 22, letterSpacing: 22 * -0.03, color: color.ink, marginBottom: 10 },
  kind: { paddingTop: 14, paddingBottom: 4 },
  doc: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line },
  later: { borderBottomWidth: 1, borderBottomColor: color.line },
  docTitle: { fontFamily: font.sansMedium, fontSize: 16, color: color.ink },
  docMeta: { fontFamily: font.mono, fontSize: 13, color: color.ink2 },
});
