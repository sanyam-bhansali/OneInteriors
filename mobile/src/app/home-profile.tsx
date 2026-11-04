import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Loading, Rise, Screen, Stagger, Title } from '../components/ui';
import { call } from '../lib/api';
import { useHeadline, useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * My Home Profile (owner, 4 Nov 2026): every answer they gave and their style
 * DNA, read from their account (GET /profile), so it is the same here as on
 * the website and comes back after any sign-in. Opened from Me.
 */

type Answer = { label: string; value: string };
type HomeProfile = {
  title: string;
  homeLine: string | null;
  planLine: string | null;
  complete: boolean;
  dna: { shares: { tag: string; label: string; pct: number }[]; palette: string[]; materials: string[] } | null;
  groups: { id: string; title: string; answers: Answer[] }[];
};
type Reply = { profile: HomeProfile | null; contact: { name: string | null; phone: string | null; email: string | null } };
type State = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: Reply };

export default function HomeProfileScreen() {
  const t = useT();
  const size = useHeadline(40);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await call<Reply>('GET', '/profile');
    setState(res.ok ? { status: 'ready', data: res.data } : { status: 'error', error: res.error });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') {
    return (
      <Screen back>
        <Title size={size}>{t('me.profile')}</Title>
        <ErrorText>{state.error}</ErrorText>
      </Screen>
    );
  }

  const { profile, contact } = state.data;
  const lines = profile ? [profile.homeLine, profile.planLine].filter(Boolean).join(' · ') : '';
  const details = [
    contact.name ? { label: t('hp.name'), value: contact.name } : null,
    contact.phone ? { label: t('hp.mobile'), value: contact.phone } : null,
    contact.email ? { label: t('hp.email'), value: contact.email } : null,
  ].filter((d): d is Answer => d !== null);

  return (
    <Screen
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      footer={<Button label={profile?.complete ? t('hp.change') : t('hp.start')} onPress={() => router.push('/journey/name')} />}
    >
      <Rise style={{ gap: 8 }}>
        <Eyebrow>{t('me.profile')}</Eyebrow>
        <Title size={size}>{profile?.title ?? t('me.profile')}</Title>
        {lines ? <Body muted>{profile?.complete ? lines : `${lines} · ${t('hp.unfinished')}`}</Body> : null}
        {!profile ? <Body muted>{t('hp.empty')}</Body> : null}
      </Rise>

      {profile?.dna ? (
        <Stagger i={1} start={80}>
          <View style={styles.card}>
            <Eyebrow>{t('hp.dna')}</Eyebrow>
            <Text style={styles.dna}>{profile.dna.shares.map((s) => `${s.pct}% ${s.label}`).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }} aria-hidden>
              {profile.dna.palette.map((c) => (
                <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
              ))}
            </View>
            <Body muted style={{ fontSize: 14 }}>
              {t('hp.materials', { list: profile.dna.materials.join(', ') })}
            </Body>
          </View>
        </Stagger>
      ) : null}

      {profile?.groups.map((g, i) => (
        <Stagger key={g.id} i={i + 2} start={80}>
          <Group title={g.title} answers={g.answers} />
        </Stagger>
      ))}

      {details.length > 0 ? <Group title={t('hp.details')} answers={details} /> : null}
    </Screen>
  );
}

function Group({ title, answers }: { title: string; answers: Answer[] }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {answers.map((a) => (
        <View key={a.label} style={{ gap: 2 }}>
          <Text style={styles.label}>{a.label}</Text>
          <Text style={styles.value}>{a.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, gap: 12, padding: 18, borderRadius: 20, backgroundColor: color.soft },
  dna: { fontFamily: font.sansMedium, fontSize: 19, lineHeight: 26, color: color.ink },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: color.ring },
  group: { marginTop: 24, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, paddingTop: 16 },
  groupTitle: { fontFamily: font.sansMedium, fontSize: 17, color: color.ink },
  label: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: color.ink2 },
  value: { fontFamily: font.sans, fontSize: 15, lineHeight: 21, color: color.ink },
});
