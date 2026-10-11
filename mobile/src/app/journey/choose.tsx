import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChooseFrame, InfoRow, LineIcon } from '../../components/journey/choose-parts';
import { Body, Button, ErrorText, Loading, Press, Stagger, Title } from '../../components/ui';
import { dayLabel, inr, timeLabel } from '../../lib/format';
import { useHeadline, useT } from '../../lib/i18n';
import { chooseApi, type ApiChooseView, type ApiChooseVisit } from '../../lib/journey/choose';
import { useProfile } from '../../lib/profile';
import { color, font, radius } from '../../lib/theme';

/**
 * #18 Choose 2 · Meet studios (design Visits.dc.html; the website's
 * src/app/app/choose/ChooseScreen.tsx). The studios the expert introduced
 * after the call, each with its visits. A time a studio proposed is
 * confirmed, or turned down, here; once a studio has measured and issued its
 * final quote, it opens from here. The expert's note shows only when there
 * is one (there is none yet). Nothing here promises a date the expert has
 * not set.
 */

type Studio = ApiChooseView['studios'][number];
type State = { status: 'loading' } | { status: 'ready'; view: ApiChooseView | null } | { status: 'error'; error: string };

const when = (iso: string) => `${dayLabel(iso)}, ${timeLabel(iso)}`;

export default function MeetStudios() {
  const t = useT();
  const h1 = useHeadline(34);
  const expert = useProfile().profile.expert.name;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await chooseApi.view();
    setState(res.ok ? { status: 'ready', view: res.data.view } : { status: 'error', error: res.error });
  }, []);

  // Reloaded on coming back from the quote, so a signed studio shows as signed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (state.status === 'loading') return <Loading />;

  if (state.status === 'error') {
    return (
      <ChooseFrame back="/home" step={2} footer={<Button label={t('choose.retry')} onPress={() => void refresh()} busy={refreshing} />}>
        <Title size={h1}>{t('choose.h1')}</Title>
        <ErrorText>{state.error}</ErrorText>
      </ChooseFrame>
    );
  }

  const view = state.view;
  const studios = view?.studios ?? [];
  const quoted = studios.find((s) => s.finalQuote);
  const names = studios.map((s) => s.name);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('choose.and')} ${names[names.length - 1]}` : (names[0] ?? '');

  const footer = view?.signedWith ? (
    <Button label={t('choose.open')} onPress={() => router.replace('/home')} />
  ) : quoted?.finalQuote ? (
    <>
      {!quoted.finalQuote.accepted ? <Text style={styles.arrived}>{t('choose.arrived', { studio: quoted.name })}</Text> : null}
      <Button
        label={quoted.finalQuote.accepted ? t('choose.seeSigned') : t('choose.seeQuote')}
        onPress={() =>
          router.push({
            pathname: '/journey/choose/quote/[id]',
            params: { id: quoted.finalQuote!.id },
          })
        }
      />
    </>
  ) : (
    <Button label={t('choose.ask', { expert })} variant="ghost" onPress={() => router.push('/geio?ask=expert')} />
  );

  return (
    <ChooseFrame back="/home" step={2} footer={footer} onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={{ gap: 10 }}>
        <Title size={h1}>{t('choose.h1')}</Title>
        <Body muted>
          {studios.length
            ? t('choose.sub', { expert, names: joined.replace(/\.$/, '') })
            : view?.call?.scheduledFor
              ? t('choose.empty.call', {
                  expert,
                  when: when(view.call.scheduledFor),
                })
              : t('choose.empty', { expert })}
        </Body>
      </View>

      {view?.signedWith ? (
        <View style={[styles.chip, styles.chipOk, { alignSelf: 'flex-start' }]}>
          <LineIcon name="tick" size={13} tint={color.ok} stroke={2.6} />
          <Text style={[styles.chipText, { color: color.ok }]}>{t('choose.signedWith', { studio: view.signedWith })}</Text>
        </View>
      ) : null}

      {studios.map((s, i) => (
        <Stagger key={s.introId} i={i} start={220}>
          <StudioCard s={s} onChanged={load} />
        </Stagger>
      ))}

      {view?.expertNote ? (
        <View style={styles.note}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{expert.charAt(0)}</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.noteWho}>{t('choose.expert.title', { expert })}</Text>
            <Text style={styles.noteText}>{view.expertNote}</Text>
          </View>
        </View>
      ) : null}

      {studios.length ? (
        <View style={styles.note}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{expert.charAt(0)}</Text>
          </View>
          <View style={[styles.bubble, { gap: 8 }]}>
            <Text style={styles.noteWho}>{t('choose.expert.title', { expert })}</Text>
            <Text style={styles.noteText}>{t('choose.expert.body')}</Text>
            {quoted ? (
              <Press
                onPress={() => router.push('/geio?ask=expert')}
                accessibilityRole="link"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={styles.link}>{t('choose.ask', { expert })}</Text>
              </Press>
            ) : null}
          </View>
        </View>
      ) : null}
    </ChooseFrame>
  );
}

function StudioCard({ s, onChanged }: { s: Studio; onChanged: () => Promise<void> }) {
  const t = useT();
  const proposed = s.visits.some((v) => v.state === 'proposed');
  const chip = s.finalQuote
    ? s.finalQuote.accepted
      ? t('choose.chip.signed')
      : t('choose.chip.quote')
    : proposed
      ? t('choose.chip.pick')
      : s.visits.length
        ? t('choose.chip.booked')
        : t('choose.chip.waiting');
  const good = !!s.finalQuote || (!proposed && s.visits.length > 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text role="heading" style={styles.name}>
          {s.name}
        </Text>
        <View style={[styles.chip, good ? styles.chipOk : proposed ? styles.chipPick : styles.chipWait]}>
          {good ? <LineIcon name="tick" size={13} tint={color.ok} stroke={2.6} /> : null}
          <Text
            style={[
              styles.chipText,
              {
                color: good ? color.ok : proposed ? color.accentInk : color.ink2,
              },
            ]}
          >
            {chip}
          </Text>
        </View>
      </View>

      {s.visits.length === 0 ? <Text style={styles.wait}>{t('choose.noVisits', { studio: s.name })}</Text> : null}

      {s.visits.map((v, i) =>
        v.state === 'proposed' ? (
          <Proposed key={v.id} v={v} studio={s.name} first={i === 0} onChanged={onChanged} />
        ) : (
          <InfoRow
            key={v.id}
            first={i === 0}
            icon={<LineIcon name={v.kind === 'site_visit' ? 'ruler' : 'calendar'} />}
            title={t(`choose.kind.${v.kind}`)}
            line={`${when(v.at)}${v.location ? ` · ${v.location}` : ''}`}
            right={<Text style={styles.state}>{t(`choose.state.${v.state}`)}</Text>}
          />
        ),
      )}

      {s.finalQuote ? (
        <Press
          onPress={() =>
            router.push({
              pathname: '/journey/choose/quote/[id]',
              params: { id: s.finalQuote!.id },
            })
          }
          accessibilityRole="link"
          accessibilityLabel={`${s.finalQuote.accepted ? t('choose.quoteSigned') : t('choose.quoteIn')}, ${t('choose.beforeGst', { amount: inr(s.finalQuote.totalPaise) })}`}
          style={styles.quoteRow}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.quoteTitle}>{s.finalQuote.accepted ? t('choose.quoteSigned') : t('choose.quoteIn')}</Text>
            <Text style={styles.quoteLine}>
              <Text style={styles.mono}>{inr(s.finalQuote.totalPaise)}</Text>
              {` ${t('choose.gstNote')}`}
            </Text>
          </View>
          <LineIcon name="chevron" tint={color.ink3} />
        </Press>
      ) : null}
    </View>
  );
}

/** A time the studio proposed: confirm it, or say it does not work. */
function Proposed({ v, studio, first, onChanged }: { v: ApiChooseVisit; studio: string; first: boolean; onChanged: () => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = async (a: 'confirm' | 'cancel') => {
    setBusy(a);
    setError(null);
    const res = await chooseApi.answerVisit(v.id, a);
    if (!res.ok) {
      setBusy(null);
      return setError(res.error);
    }
    await onChanged();
    setBusy(null);
  };
  return (
    <View style={{ gap: 10, paddingBottom: 6 }}>
      <InfoRow
        first={first}
        icon={<LineIcon name={v.kind === 'site_visit' ? 'ruler' : 'calendar'} />}
        title={t(`choose.kind.${v.kind}`)}
        line={`${when(v.at)}${v.location ? ` · ${v.location}` : ''}`}
      />
      <Text style={styles.wait}>{t('choose.proposed', { studio })}</Text>
      <Button
        label={t('choose.confirm', { when: when(v.at) })}
        arrow={false}
        busy={busy === 'confirm'}
        disabled={busy === 'cancel'}
        onPress={() => void answer('confirm')}
      />
      <Button
        label={t('choose.cantMake')}
        variant="quiet"
        busy={busy === 'cancel'}
        disabled={busy === 'confirm'}
        onPress={() => void answer('cancel')}
      />
      {error ? (
        <View aria-live="polite">
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.soft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: font.sansSemi,
    fontSize: 19,
    letterSpacing: -0.38,
    color: color.ink,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  chipOk: { backgroundColor: '#E3EDE5' },
  chipPick: { backgroundColor: color.peach },
  chipWait: { backgroundColor: color.soft2 },
  chipText: { fontFamily: font.sansSemi, fontSize: 13 },
  wait: {
    fontFamily: font.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: color.ink2,
    paddingBottom: 10,
  },
  state: { fontFamily: font.sansMedium, fontSize: 13, color: color.ink2 },
  quoteRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: color.paper,
  },
  quoteTitle: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  quoteLine: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  mono: { fontFamily: font.mono, fontSize: 14, color: color.ink },
  arrived: {
    fontFamily: font.sansMedium,
    fontSize: 14,
    color: color.ok,
    textAlign: 'center',
  },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.sansSemi, fontSize: 15, color: color.white },
  bubble: {
    flex: 1,
    backgroundColor: color.soft,
    borderTopLeftRadius: 6,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  noteWho: { fontFamily: font.sansSemi, fontSize: 13, color: color.ok },
  noteText: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.ink,
  },
  link: {
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: color.ink,
    textDecorationLine: 'underline',
  },
});
