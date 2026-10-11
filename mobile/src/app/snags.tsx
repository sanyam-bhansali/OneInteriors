import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SnapIcon } from '../components/project/parts';
import { Body, Button, Card, DarkCard, Eyebrow, ErrorText, Field, Loading, Press, Screen, Stagger, Title } from '../components/ui';
import { api } from '../lib/api';
import { dayLabel, shortDate } from '../lib/format';
import { useHeadline, useLang, useT, type T } from '../lib/i18n';
import { usePlan } from '../lib/plan';
import { useProject } from '../lib/project';
import { color, font } from '../lib/theme';
import type { Snag } from '../lib/types';

/**
 * Snags (design #24): "Photograph a problem" opens the camera; the photo, a
 * few words and the room go to the studio, which sets a fix-by date and
 * fixes it with an after photo. Open and Fixed tabs with counts, then the
 * handover walk-through note.
 *
 * Studio workspace Phase 4: only the customer closes a snag. A fix waiting
 * for them sits on top: before and after side by side, the studio's
 * sentence, and two clear buttons, Confirm and Not fixed, with the date it
 * closes by itself if they never answer. A studio's "not a defect" reply
 * shows its reason and an Agree button. Older servers send no `progress`;
 * then the screen is as it was.
 */
export default function Snags() {
  const t = useT();
  const { assured } = usePlan();
  const { lang } = useLang();
  const size = useHeadline(42);
  const { state, refresh, refreshing } = useProject();
  const [tab, setTab] = useState<'OPEN' | 'FIXED'>('OPEN');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const titleStyle = { letterSpacing: size * -0.05, lineHeight: lang === 'en' ? size * 0.98 : size * 1.25 };

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen back>
        {/* Promises Assured-plan service (FLOWS.md): flagged for Sanyam, kept. */}
        <Eyebrow>{assured ? t('snags.eyebrow') : t('plan.basic.snags')}</Eyebrow>
        <Title size={size} style={titleStyle}>
          {t('snags.title')}
        </Title>
        <Body muted>{t('snags.none')}</Body>
      </Screen>
    );
  }
  const p = state.project;
  // Fixes (and studio replies) waiting for the owner's answer sit on top, out of the tabs while they wait.
  const toCheck = p.snags.filter((s) => s.progress?.canAnswer);
  const waiting = new Set(toCheck.map((s) => s.id));
  const tabOf = (s: Snag): 'OPEN' | 'FIXED' => (s.progress ? (s.progress.state === 'closed' ? 'FIXED' : 'OPEN') : s.status);
  const inTabs = p.snags.filter((s) => !waiting.has(s.id));
  const openCount = inTabs.filter((s) => tabOf(s) === 'OPEN').length;
  const fixedCount = inTabs.length - openCount;
  const list = inTabs.filter((s) => tabOf(s) === tab);
  const handover = p.stages.find((s) => s.key === 'HANDOVER') ?? p.stages[p.stages.length - 1];

  const take = async (from: 'camera' | 'library') => {
    setMsg(null);
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setMsg({ ok: false, text: t('snags.permission') });
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
    const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0]);
  };

  const send = async () => {
    if (!photo) return;
    setBusy(true);
    const form = new FormData();
    form.append('projectId', p.id);
    form.append('title', title);
    if (room.trim()) form.append('room', room);
    // React Native's FormData takes a file as { uri, name, type }.
    form.append('photos', { uri: photo.uri, name: 'snag.jpg', type: photo.mimeType ?? 'image/jpeg' } as unknown as Blob);
    const res = await api.raiseSnag(form);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhoto(null);
    setTitle('');
    setRoom('');
    setMsg({ ok: true, text: t('snags.sent', { studio: p.studio }) });
    void refresh();
  };

  return (
    <Screen back onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          {/* Promises Assured-plan service (FLOWS.md): flagged for Sanyam, kept. */}
          <Eyebrow>{assured ? t('snags.eyebrow') : t('plan.basic.snags')}</Eyebrow>
          <Title size={size} style={titleStyle}>
            {t('snags.title')}
          </Title>
        </View>

        {photo ? (
          <Card style={{ gap: 14 }}>
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" accessibilityLabel={t('snags.photo')} />
            <Field label={t('snags.what')} value={title} onChangeText={setTitle} placeholder={t('snags.whatHint')} maxLength={120} />
            <Field label={t('snags.where')} value={room} onChangeText={setRoom} placeholder={t('snags.whereHint')} maxLength={40} />
            <Button
              label={t('snags.send')}
              onPress={() => void send()}
              busy={busy}
              disabled={title.trim().length < 3}
              reason={title.trim().length < 3 ? t('snags.sendReason') : undefined}
            />
            <Button label={t('snags.cancel')} variant="quiet" onPress={() => setPhoto(null)} />
          </Card>
        ) : (
          <View style={{ gap: 4 }}>
            <Press onPress={() => void take('camera')} style={styles.camera} accessibilityLabel={t('snags.photograph')}>
              <SnapIcon color={color.white} />
              <Text style={styles.cameraText}>{t('snags.photograph')}</Text>
            </Press>
            <Button label={t('snags.library')} variant="quiet" onPress={() => void take('library')} />
          </View>
        )}
        {msg ? (
          <View role="status" aria-live="polite" accessibilityLiveRegion="polite">
            {msg.ok ? <Text style={styles.toast}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>}
          </View>
        ) : null}

        {toCheck.length ? (
          <View style={{ gap: 12 }}>
            <Eyebrow>{toCheck.length === 1 ? t('snags.check') : t('snags.checkMany', { n: toCheck.length })}</Eyebrow>
            {toCheck.map((s) => (
              <CheckFix
                key={s.id}
                snag={s}
                studio={p.studio}
                t={t}
                onDone={(text) => {
                  setMsg({ ok: true, text });
                  void refresh();
                }}
              />
            ))}
          </View>
        ) : null}

        <View role="tablist" aria-label={t('snags.filter')} style={{ flexDirection: 'row', gap: 8 }}>
          <Tab label={t('snags.open')} count={openCount} on={tab === 'OPEN'} onPress={() => setTab('OPEN')} i={0} />
          <Tab label={t('snags.fixed')} count={fixedCount} on={tab === 'FIXED'} onPress={() => setTab('FIXED')} i={1} />
        </View>

        <View role="tabpanel" style={list.length ? styles.list : null}>
          {list.map((s, i) => (
            <SnagRow key={s.id} snag={s} i={i} t={t} />
          ))}
          {list.length === 0 ? <Body muted>{tab === 'OPEN' ? t('snags.emptyOpen') : t('snags.emptyFixed')}</Body> : null}
        </View>

        <DarkCard style={styles.walk}>
          <Eyebrow onDark>{handover ? t('snags.walk', { date: shortDate(handover.targetOn) }) : t('snags.walkNoDate')}</Eyebrow>
          <Text style={styles.walkBody}>{assured ? t('snags.walkBody') : t('plan.basic.walk')}</Text>
        </DarkCard>
      </View>
    </Screen>
  );
}

function Tab({ label, count, on, onPress, i }: { label: string; count: number; on: boolean; onPress: () => void; i: number }) {
  return (
    <Stagger i={i} start={220}>
      <Press
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label} ${count}`}
        style={[styles.tab, on ? { backgroundColor: color.ink, borderColor: color.ink } : null]}
      >
        <Text style={[styles.tabText, on && { color: color.white }]}>
          {label} <Text style={[styles.tabCount, on && { color: color.white }]}>{count}</Text>
        </Text>
      </Press>
    </Stagger>
  );
}

/** The status line: from the snag's progress when the server sends it, else the server's English line, in the app's language. */
function statusLine(s: Snag, t: T): { text: string; tone: string } {
  const g = s.progress;
  if (g) {
    switch (g.state) {
      case 'accepted':
        return g.fixBy ? { text: t('snags.fixBy', { day: shortDate(g.fixBy) }), tone: color.accentInk } : { text: t('snags.stateRaised'), tone: color.ink2 };
      case 'raised':
        return { text: t('snags.stateRaised'), tone: color.ink2 };
      case 'reopened':
        return { text: t('snags.stateReopened'), tone: color.accentInk };
      case 'disputed':
        return { text: t('snags.stateDisputed'), tone: color.ink2 };
      case 'fixed':
        return { text: t('snags.stateFixed'), tone: color.ok };
      case 'closed':
        return {
          text: g.closedBy === 'auto' ? t('snags.closedAuto') : g.daysToFix !== null ? t('snags.closedYou', { n: g.daysToFix }) : t('snags.closedYouNoDays'),
          tone: color.ok,
        };
    }
  }
  const line = s.line ?? '';
  if (s.status === 'FIXED') {
    const day = line.startsWith('Fixed ') ? line.slice(6) : null;
    const text = [day ? t('snags.fixedOn', { day }) : t('snags.fixed'), s.fixedNote].filter(Boolean).join(' · ');
    return { text, tone: color.ok };
  }
  if (line.startsWith('Fix by ')) return { text: t('snags.fixBy', { day: line.slice(7) }), tone: color.accentInk };
  return { text: line || t('snags.withStudio'), tone: color.ink2 };
}

function SnagRow({ snag: s, i, t }: { snag: Snag; i: number; t: T }) {
  const img = s.status === 'FIXED' ? (s.fixedPhotos[0] ?? s.photos[0]) : s.photos[0];
  const raised = s.room ? t('snags.roomRaised', { room: s.room, day: dayLabel(s.raisedAt) }) : t('snags.raised', { day: dayLabel(s.raisedAt) });
  const status = statusLine(s, t);
  return (
    <Stagger i={Math.min(i, 8)} start={280} style={styles.snag}>
      {img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" accessibilityLabel={t('snags.photoOf', { title: s.title })} /> : <View style={[styles.thumb, { backgroundColor: color.soft }]} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.snagTitle}>{s.title}</Text>
        <Text style={styles.mono}>{raised}</Text>
        <Text style={[styles.mono, { color: status.tone }]}>{status.text}</Text>
      </View>
    </Stagger>
  );
}

/**
 * One fix to answer: before and after side by side, the studio's sentence,
 * Confirm and Not fixed (with an optional line), and when it closes by
 * itself. Or, for a studio's "not a defect" reply, its reason and Agree.
 */
function CheckFix({ snag: s, studio, t, onDone }: { snag: Snag; studio: string; t: T; onDone: (text: string) => void }) {
  const g = s.progress!;
  const [busy, setBusy] = useState<'confirm' | 'back' | null>(null);
  const [telling, setTelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const disputed = g.state === 'disputed';

  const confirm = async () => {
    setBusy('confirm');
    setError(null);
    const r = await api.confirmSnag(s.id);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(t('snags.confirmed'));
  };
  const sendBack = async () => {
    setBusy('back');
    setError(null);
    const r = await api.snagNotFixed(s.id, reason.trim());
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onDone(t('snags.sentBack', { studio }));
  };

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={styles.snagTitle}>{s.title}</Text>
        {s.room ? <Text style={styles.mono}>{s.room}</Text> : null}
      </View>
      {disputed ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.mono, { color: color.ink2 }]}>{t('snags.studioSays', { studio })}</Text>
          <Text style={styles.sentence}>{`\u201C${g.studioReason ?? ''}\u201D`}</Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pair uri={s.photos[0]} caption={s.raisedByStudio ? t('snags.beforeStudio') : t('snags.before')} t={t} />
            <Pair uri={s.fixedPhotos[0]} caption={g.fixedAt ? t('snags.after', { day: dayLabel(g.fixedAt) }) : t('snags.afterNoDay')} t={t} />
          </View>
          {g.fixSentence ? <Text style={styles.sentence}>{`\u201C${g.fixSentence}\u201D`}</Text> : null}
        </>
      )}

      {telling ? (
        <View style={{ gap: 10 }}>
          <Field label={t('snags.notFixedWhat')} value={reason} onChangeText={setReason} placeholder={t('snags.notFixedHint')} maxLength={300} />
          <Button label={t('snags.sendBack')} onPress={() => void sendBack()} busy={busy === 'back'} />
          <Button label={t('snags.cancel')} variant="quiet" onPress={() => setTelling(false)} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button label={disputed ? t('snags.agree') : t('snags.confirm')} onPress={() => void confirm()} busy={busy === 'confirm'} />
          {disputed ? null : <Button label={t('snags.notFixed')} variant="light" arrow={false} onPress={() => setTelling(true)} />}
        </View>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Text style={[styles.mono, { color: color.ink2 }]}>
        {disputed ? t('snags.disputeHelp') : g.autoClosesOn ? t('snags.autoClose', { day: shortDate(g.autoClosesOn) }) : ''}
      </Text>
    </Card>
  );
}

function Pair({ uri, caption, t }: { uri: string | undefined; caption: string; t: T }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      {uri ? (
        <Image source={{ uri }} style={styles.pair} contentFit="cover" accessibilityLabel={caption} />
      ) : (
        <View style={[styles.pair, { backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.mono}>{t('snags.noPhoto')}</Text>
        </View>
      )}
      <Text style={styles.mono}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14 },
  sentence: { fontFamily: font.sansMedium, fontSize: 16, lineHeight: 23, color: color.ink },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  camera: {
    minHeight: 60,
    borderRadius: 999,
    backgroundColor: color.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    shadowColor: color.ink,
    shadowOpacity: 0.45,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  cameraText: { fontFamily: font.sansMedium, fontSize: 16, color: color.white },
  toast: {
    backgroundColor: color.ink,
    color: color.onDark,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
    overflow: 'hidden',
    fontFamily: font.sansMedium,
    fontSize: 14.5,
    lineHeight: 20,
  },
  tab: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: color.ring, justifyContent: 'center' },
  tabText: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  tabCount: { fontFamily: font.mono, fontSize: 13, color: color.ink },
  list: { borderBottomWidth: 1, borderBottomColor: color.line },
  snag: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.line },
  thumb: { width: 84, height: 84, borderRadius: 12 },
  snagTitle: { fontFamily: font.sansSemi, fontSize: 17, lineHeight: 21, letterSpacing: -0.34, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: color.ink2 },
  walk: { borderRadius: 18, padding: 18, gap: 8 },
  walkBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 22.5, color: '#D6D4CE' },
});
