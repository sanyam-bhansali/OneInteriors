import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraIcon } from '../../components/icons';
import { Body, Button, Chip, DarkCard, ErrorText, Field, Loading, Meta, Press, Rise, Screen, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { dayLabel } from '../../lib/format';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';

/**
 * Snags (the v1 design): fixed by a date, or we chase it. "Photograph a
 * problem" opens the camera; the photo, a few words and the room go to the
 * studio, which sets a fix-by date and closes it with a photo.
 */
export default function Snags() {
  const { state, refresh, refreshing } = useProject();
  const [tab, setTab] = useState<'OPEN' | 'FIXED'>('OPEN');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen>
        <Meta>Fixed by a date, or we chase it</Meta>
        <Title>Snags</Title>
        <Body muted>Once your project starts, photograph anything wrong and it goes straight to the studio.</Body>
      </Screen>
    );
  }
  const p = state.project;
  const list = p.snags.filter((s) => s.status === tab);

  const take = async (from: 'camera' | 'library') => {
    setMsg(null);
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setMsg({ ok: false, text: 'Allow access in your phone’s settings to add a photo.' });
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
    setMsg({ ok: true, text: `Sent to ${p.studio}. You will hear when it has a fix-by date.` });
    void refresh();
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Meta>Fixed by a date, or we chase it</Meta>
      <Title size={40}>Snags</Title>

      {photo ? (
        <View style={styles.card}>
          <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
          <Field label="What is wrong" value={title} onChangeText={setTitle} placeholder="Gap between wardrobe and ceiling" maxLength={120} />
          <Field label="Where (optional)" value={room} onChangeText={setRoom} placeholder="Bedroom 1" maxLength={40} />
          <Button label="Send to the studio" onPress={() => void send()} busy={busy} disabled={title.trim().length < 3} />
          <Button label="Cancel" variant="quiet" onPress={() => setPhoto(null)} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Press onPress={() => void take('camera')} style={styles.camera}>
            <CameraIcon color={color.white} />
            <Text style={styles.cameraText}>Photograph a problem</Text>
          </Press>
          <Button label="Choose from photos" variant="quiet" onPress={() => void take('library')} />
        </View>
      )}
      {msg ? (msg.ok ? <Body style={styles.toast}>{msg.text}</Body> : <ErrorText>{msg.text}</ErrorText>) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={`Open ${p.snags.filter((s) => s.status === 'OPEN').length}`} on={tab === 'OPEN'} onPress={() => setTab('OPEN')} />
        <Chip label={`Fixed ${p.snags.filter((s) => s.status === 'FIXED').length}`} on={tab === 'FIXED'} onPress={() => setTab('FIXED')} />
      </View>

      <View>
        {list.map((s, i) => {
          const img = tab === 'FIXED' ? (s.fixedPhotos[0] ?? s.photos[0]) : s.photos[0];
          return (
            <Rise key={s.id} delay={Math.min(i, 8) * 60} style={styles.snag}>
              {img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.snagTitle}>{s.title}</Text>
                <Text style={styles.mono}>{[s.room, `raised ${dayLabel(s.raisedAt)}`].filter(Boolean).join(', ')}</Text>
                <Text style={[styles.mono, tab === 'OPEN' && s.line?.startsWith('Fix by') && { color: color.accentInk }]}>
                  {tab === 'FIXED' ? [s.line, s.fixedNote].filter(Boolean).join(' · ') : (s.line ?? 'With the studio')}
                </Text>
              </View>
            </Rise>
          );
        })}
        {list.length === 0 ? <Body muted>{tab === 'OPEN' ? 'Nothing open. Good.' : 'Nothing fixed yet.'}</Body> : null}
      </View>

      <DarkCard>
        <Text style={styles.cardMeta}>Handover walk-through</Text>
        <Text style={styles.cardBody}>We walk the flat with you room by room and add everything here. The last payment is due only once these are closed.</Text>
      </DarkCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 16, borderRadius: 18, backgroundColor: color.white, borderWidth: 1, borderColor: '#e2e0da' },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  camera: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: color.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: color.accent,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cameraText: { fontFamily: font.sansSemi, fontSize: 16.5, color: color.white },
  toast: { backgroundColor: color.dark, color: color.onDark, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, textAlign: 'center', overflow: 'hidden' },
  snag: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  thumb: { width: 84, height: 84, borderRadius: 12 },
  snagTitle: { fontFamily: font.sansSemi, fontSize: 17, lineHeight: 21, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2 },
  cardMeta: { fontFamily: font.mono, fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase', color: '#f08a5d' },
  cardBody: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: 'rgba(255,255,255,.85)' },
});
