import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../../../components/icons';
import { api, type ChatKind, type ChatMsg, type ChatThread } from '../../../lib/api';
import { listen } from '../../../lib/live-socket';
import { clock, mergeFresh } from '../../../lib/chat-merge';
import { useT } from '../../../lib/i18n';
import { color, font } from '../../../lib/theme';

/**
 * One conversation, as on WhatsApp (owner, 1 Nov 2026; the website's
 * components/chat/ChatRoom.tsx): names, times and read ticks; long-press a
 * message to reply or take it back; a photo from the camera or gallery; hold
 * the mic to record a voice note, release to send. New messages are asked
 * for every three seconds while the screen is open, and a sent one shows at
 * once.
 */
const POLL_MS = 3000;
/** With Realtime connected, the check every few seconds becomes a slow safety net. */
const LIVE_POLL_MS = 20_000;
const KINDS: ChatKind[] = ['DESIGNER', 'TEAM', 'ONE_INTERIORS'];

export default function ChatScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ projectId: string; kind: string }>();
  const kind = (KINDS.includes(String(params.kind).toUpperCase() as ChatKind) ? String(params.kind).toUpperCase() : 'DESIGNER') as ChatKind;
  const projectId = String(params.projectId);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [recStart, setRecStart] = useState<number | null>(null);
  const [, tick] = useState(0);
  const cursor = useRef<string | null>(null);
  const connected = useRef(false);
  const lastPoll = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);

  const load = useCallback(async () => {
    const r = await api.chatThread(projectId, kind);
    if (!r.ok) return setError(r.error);
    cursor.current = r.data.cursor;
    setThread(r.data);
    toEnd();
  }, [projectId, kind]);

  const poll = useCallback(async (now = false) => {
    if (AppState.currentState !== 'active') return;
    if (!now && connected.current && Date.now() - lastPoll.current < LIVE_POLL_MS) return;
    lastPoll.current = Date.now();
    const since = cursor.current;
    if (!since) return void load();
    const r = await api.chatThread(projectId, kind, since);
    if (!r.ok || !r.data.messages.length) return;
    cursor.current = r.data.cursor;
    setThread((th) => (th ? { ...th, messages: mergeFresh(th.messages, r.data.messages) } : th));
    toEnd();
  }, [projectId, kind, load]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [load, poll]);

  /* Realtime: a ping means something new; fetch it now. */
  const live = thread?.live ?? null;
  const liveKey = live ? live.topic : null;
  useEffect(() => {
    if (!live) return;
    return listen(
      live,
      () => void poll(true),
      (on) => {
        connected.current = on;
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, poll]);

  useEffect(() => {
    if (recStart === null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [recStart]);

  const standIn = (m: Partial<ChatMsg>): ChatMsg => ({
    id: `pending-${Date.now()}`,
    from: t('chats.you'),
    role: '',
    side: '',
    mine: true,
    kind: 'TEXT',
    body: '',
    url: null,
    fileName: null,
    durationMs: null,
    replyTo: reply ? { id: reply.id, from: reply.from, preview: reply.body || reply.kind.toLowerCase() } : null,
    at: new Date().toISOString(),
    tick: 'sent',
    taken: false,
    canTakeBack: false,
    pending: true,
    ...m,
  });

  const fail = (id: string, why: string) => setThread((th) => (th ? { ...th, messages: th.messages.map((m) => (m.id === id ? { ...m, failed: why } : m)) } : th));

  async function sendText() {
    const body = text.trim();
    if (!body) return;
    const s = standIn({ body });
    setText('');
    setReply(null);
    setThread((th) => (th ? { ...th, messages: [...th.messages, s] } : th));
    toEnd();
    const r = await api.chatSend(projectId, kind, body, s.replyTo?.id ?? null);
    if (!r.ok) return fail(s.id, r.error);
    void poll(true);
  }

  async function sendFile(file: { uri: string; name: string; type: string }, kindOf: ChatMsg['kind'], durationMs?: number) {
    const s = standIn({ kind: kindOf, url: kindOf === 'PHOTO' ? file.uri : null, durationMs: durationMs ?? null, body: text.trim() });
    setText('');
    setReply(null);
    setThread((th) => (th ? { ...th, messages: [...th.messages, s] } : th));
    toEnd();
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    form.append('body', s.body);
    if (durationMs) form.append('durationMs', String(durationMs));
    if (s.replyTo) form.append('replyToId', s.replyTo.id);
    const r = await api.chatSendFile(projectId, kind, form);
    if (!r.ok) return fail(s.id, r.error);
    void poll(true);
  }

  async function pickPhoto(from: 'camera' | 'library') {
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('snags.permission'));
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
    const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = !r.canceled ? r.assets[0] : null;
    if (a) void sendFile({ uri: a.uri, name: 'photo.jpg', type: a.mimeType ?? 'image/jpeg' }, 'PHOTO');
  }

  function attach() {
    const options = [t('chat.camera'), t('chat.gallery'), t('chat.cancel')];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => (i === 0 ? void pickPhoto('camera') : i === 1 ? void pickPhoto('library') : undefined));
    } else {
      Alert.alert(t('chat.attach'), undefined, [
        { text: options[0]!, onPress: () => void pickPhoto('camera') },
        { text: options[1]!, onPress: () => void pickPhoto('library') },
        { text: options[2]!, style: 'cancel' },
      ]);
    }
  }

  async function startVoice() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return setError(t('chat.mic'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecStart(Date.now());
  }

  async function stopVoice() {
    if (recStart === null) return;
    const ms = Date.now() - recStart;
    setRecStart(null);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri || ms < 800) return;
    void sendFile({ uri, name: 'voice.m4a', type: 'audio/mp4' }, 'VOICE', ms);
  }

  function menu(m: ChatMsg) {
    if (m.taken || m.pending) return;
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [{ text: t('chat.reply'), onPress: () => setReply(m) }];
    if (m.canTakeBack) {
      actions.push({
        text: t('chat.takeBack'),
        style: 'destructive',
        onPress: () =>
          void api.chatTakeBack(m.id).then((r) => {
            if (r.ok) setThread((th) => (th ? { ...th, messages: th.messages.map((x) => (x.id === m.id ? { ...x, taken: true, body: '', url: null, canTakeBack: false } : x)) } : th));
          }),
      });
    }
    actions.push({ text: t('chat.cancel'), style: 'cancel' });
    Alert.alert(m.from, undefined, actions);
  }

  let lastDay = '';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.head}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} accessibilityLabel={t('kit.back')} style={styles.back}>
          <BackIcon color={color.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle} numberOfLines={1}>
            {thread?.title ?? ''}
          </Text>
          <Text style={styles.headSub} numberOfLines={1}>
            {thread?.people.map((p) => `${p.name} · ${p.role}`).join(', ') || t('chats.private')}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: WALL }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 12, gap: 6 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {!thread && !error ? <Text style={styles.empty}>{t('chat.opening')}</Text> : null}
          {thread && thread.messages.length === 0 ? <Text style={styles.empty}>{t('chat.first')}</Text> : null}
          {thread?.messages.map((m) => {
            const d = dayLabel(m.at, t);
            const showDay = d !== lastDay;
            lastDay = d;
            return (
              <View key={m.id}>
                {showDay ? <Text style={styles.day}>{d}</Text> : null}
                <Pressable onLongPress={() => menu(m)} style={[styles.bubble, m.mine ? styles.mine : styles.theirs, m.failed ? { opacity: 0.7 } : null]}>
                  {!m.mine ? <Text style={styles.from}>{`${m.from}${m.role ? ` · ${m.role}` : ''}`}</Text> : null}
                  {m.replyTo ? (
                    <View style={[styles.quote, m.mine && { backgroundColor: 'rgba(255,255,255,.12)' }]}>
                      <Text style={[styles.quoteText, m.mine && { color: color.white }]} numberOfLines={2}>
                        <Text style={{ fontFamily: font.sansSemi }}>{m.replyTo.from}</Text> {m.replyTo.preview}
                      </Text>
                    </View>
                  ) : null}
                  {m.taken ? (
                    <Text style={[styles.body, styles.italic, m.mine && { color: color.white }]}>{t('chat.taken')}</Text>
                  ) : (
                    <>
                      {m.kind === 'PHOTO' && m.url ? (
                        <Pressable onPress={() => m.url && !m.pending && void Linking.openURL(m.url)}>
                          <Image source={{ uri: m.url }} style={styles.photo} contentFit="cover" accessibilityLabel={m.body || t('chat.photo')} />
                        </Pressable>
                      ) : null}
                      {m.kind === 'VOICE' ? <Voice url={m.pending ? null : m.url} ms={m.durationMs} mine={m.mine} /> : null}
                      {m.kind === 'FILE' ? (
                        <Text style={[styles.body, { textDecorationLine: 'underline' }, m.mine && { color: color.white }]} onPress={() => m.url && void Linking.openURL(m.url)}>
                          PDF · {m.fileName ?? 'file'}
                        </Text>
                      ) : null}
                      {m.body ? <Text style={[styles.body, m.mine && { color: color.white }]}>{m.body}</Text> : null}
                    </>
                  )}
                  <Text style={[styles.meta, m.mine && { color: 'rgba(255,255,255,.7)' }]}>
                    {time(m.at)}
                    {m.mine ? (m.pending ? '  ◷' : m.tick === 'sent' ? '  ✓' : '') : ''}
                    {m.mine && !m.pending && m.tick !== 'sent' ? <Text style={{ color: m.tick === 'read' ? '#F08A5D' : undefined }}>{'  ✓✓'}</Text> : null}
                  </Text>
                  {m.failed ? <Text style={styles.failed}>{m.failed}</Text> : null}
                </Pressable>
              </View>
            );
          })}
          {error ? <Text style={[styles.empty, { color: '#B3261E' }]}>{error}</Text> : null}
        </ScrollView>
        {reply ? (
          <View style={styles.replying}>
            <Text style={{ flex: 1, fontFamily: font.sans, fontSize: 13, color: color.ink2 }} numberOfLines={1}>
              {t('chat.replyingTo', { name: reply.from })}: {reply.body || reply.kind.toLowerCase()}
            </Text>
            <Pressable onPress={() => setReply(null)} accessibilityLabel={t('chat.cancel')} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18 }}>×</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.compose}>
          <Pressable onPress={attach} accessibilityLabel={t('chat.attach')} style={styles.round}>
            <Text style={{ fontSize: 24, color: color.ink }}>+</Text>
          </Pressable>
          {recStart !== null ? (
            <View style={[styles.input, { justifyContent: 'center' }]}>
              <Text style={{ fontFamily: font.sansMedium, fontSize: 15, color: color.accent }}>{t('chat.recording', { time: clock(Date.now() - recStart) })}</Text>
            </View>
          ) : (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('chat.message')}
              placeholderTextColor={color.ink3}
              multiline
              maxLength={4000}
              aria-label={t('chat.message')}
              style={styles.input}
            />
          )}
          {text.trim() ? (
            <Pressable onPress={() => void sendText()} accessibilityLabel={t('chat.send')} style={[styles.round, styles.send]}>
              <Text style={{ fontSize: 18, color: color.white }}>➤</Text>
            </Pressable>
          ) : (
            <Pressable
              onPressIn={() => void startVoice()}
              onPressOut={() => void stopVoice()}
              accessibilityLabel={t('chat.hold')}
              style={[styles.round, styles.send, recStart !== null && { backgroundColor: color.accent, transform: [{ scale: 1.12 }] }]}
            >
              <Text style={{ fontSize: 18, color: color.white }}>🎙</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A voice note: play and pause, with its length. */
function Voice({ url, ms, mine }: { url: string | null; ms: number | null; mine: boolean }) {
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  return (
    <Pressable
      onPress={() => {
        if (!url) return;
        if (playing) player.pause();
        else {
          if (status.didJustFinish || (status.duration && status.currentTime >= status.duration)) void player.seekTo(0);
          player.play();
        }
      }}
      accessibilityLabel={playing ? 'Pause' : 'Play voice note'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 170, minHeight: 36 }}
    >
      <Text style={{ fontSize: 20, color: mine ? color.white : color.ink }}>{playing ? '❚❚' : '▶'}</Text>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: mine ? 'rgba(255,255,255,.3)' : color.line }}>
        <View
          style={{
            width: `${status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%`,
            height: 3,
            borderRadius: 2,
            backgroundColor: mine ? color.white : color.accent,
          }}
        />
      </View>
      <Text style={{ fontFamily: font.mono, fontSize: 13, color: mine ? color.white : color.ink2 }}>{ms ? clock(ms) : ''}</Text>
    </Pressable>
  );
}

const WALL = '#F3EFE7';
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
function dayLabel(iso: string, t: ReturnType<typeof useT>): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return t('chat.today');
  if (d.toDateString() === new Date(today.getTime() - 86_400_000).toDateString()) return t('chat.yesterday');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontFamily: font.sansSemi, fontSize: 17, color: color.ink },
  headSub: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  empty: { fontFamily: font.sans, fontSize: 14, color: color.ink2, textAlign: 'center', marginVertical: 16, paddingHorizontal: 24 },
  day: { alignSelf: 'center', marginVertical: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFFFFF', fontFamily: font.sans, fontSize: 13, color: color.ink2, overflow: 'hidden' },
  bubble: { maxWidth: '82%', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, gap: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 14, borderBottomLeftRadius: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: color.ink, borderRadius: 14, borderBottomRightRadius: 4 },
  from: { fontFamily: font.sansSemi, fontSize: 13, color: color.accent },
  quote: { borderLeftWidth: 3, borderLeftColor: color.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,.05)' },
  quoteText: { fontFamily: font.sans, fontSize: 13, color: color.ink },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 22, color: color.ink },
  italic: { fontStyle: 'italic', opacity: 0.8 },
  photo: { width: 240, height: 240, borderRadius: 10 },
  meta: { alignSelf: 'flex-end', fontFamily: font.sans, fontSize: 12, color: color.ink2 },
  failed: { fontFamily: font.sans, fontSize: 13, color: '#FFB4A2' },
  replying: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: color.line },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, backgroundColor: WALL },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: color.ink },
  input: { flex: 1, minHeight: 46, maxHeight: 140, borderRadius: 23, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: font.sans, fontSize: 16, color: color.ink },
});
