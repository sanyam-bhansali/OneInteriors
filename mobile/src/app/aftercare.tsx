import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Eyebrow, ErrorText, Field, Loading, OptionPill, Screen, Title } from '../components/ui';
import { api, type Aftercare } from '../lib/api';
import { inr } from '../lib/format';
import { useT } from '../lib/i18n';
import { useProject } from '../lib/project';
import { color, font } from '../lib/theme';

/**
 * Warranty and service after the handover (owner, 20 Nov 2026;
 * docs/studio-os/AFTERCARE.md). Two options, always open:
 *
 * - Warranty claim: the area, a line, up to four photos. The server checks
 *   the project is 100% paid first, then decides from the warranty's
 *   coverage list and the photos: covered becomes a warranty snag, not
 *   covered says so and offers a service visit.
 * - Service visit: a kind of work with the studio's visiting charge, a
 *   2-hour slot from 5 days ahead, paid on Razorpay in the browser; booked
 *   once paid. Coming back, the screen reads the visit again.
 */
export default function AftercareScreen() {
  const t = useT();
  const { state } = useProject();
  const projectId = state.status === 'ready' ? state.project.id : null;
  const [view, setView] = useState<Aftercare | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [tab, setTab] = useState<'warranty' | 'service'>('warranty');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    const r = await api.aftercare(projectId);
    if (r.ok) setView(r.data);
    else setClosed(r.status === 404 ? t('after.closed') : r.error);
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') return <Loading />;

  return (
    <Screen back onRefresh={() => void load()} refreshing={false}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('after.eyebrow')}</Eyebrow>
          <Title size={38}>{t('after.title')}</Title>
        </View>
        {state.status !== 'ready' ? (
          <Body muted>{t('after.closed')}</Body>
        ) : closed ? (
          <Body muted>{closed}</Body>
        ) : !view ? (
          <Loading />
        ) : (
          <>
            <View role="tablist" style={{ flexDirection: 'row', gap: 8 }}>
              <OptionPill label={t('after.tabWarranty')} on={tab === 'warranty'} onPress={() => setTab('warranty')} role="button" />
              <OptionPill label={t('after.tabService')} on={tab === 'service'} onPress={() => setTab('service')} role="button" />
            </View>
            {msg ? (
              <View role="status" aria-live="polite" accessibilityLiveRegion="polite">
                {msg.ok ? <Text style={styles.toast}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>}
              </View>
            ) : null}
            {tab === 'warranty' ? (
              <WarrantyClaim
                view={view}
                onResult={(m, toService) => {
                  setMsg(m);
                  if (toService) setTab('service');
                  void load();
                }}
              />
            ) : (
              <ServiceVisit
                view={view}
                onResult={(m) => {
                  setMsg(m);
                  void load();
                }}
              />
            )}
            {view.requests.length ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>{t('after.visits')}</Eyebrow>
                {view.requests.map((r) => (
                  <Card key={r.id} style={{ gap: 6 }}>
                    <Text style={styles.rowTitle}>{r.category}</Text>
                    <Text style={styles.mono}>
                      {`${r.when} · `}
                      {r.chargePaise === 0 && r.listPaise ? <Text style={styles.struck}>{inr(r.listPaise)}</Text> : null}
                      {`${r.chargePaise === 0 ? `${r.listPaise ? ' ' : ''}${t('after.free')}` : inr(r.chargePaise)} · ${t(`after.${r.state}`)}`}
                    </Text>
                    {r.payUrl ? (
                      <Button
                        label={t('after.payNow', { amount: inr(r.chargePaise) })}
                        variant="light"
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(r.payUrl!).then(() => {
                            setMsg({ ok: true, text: t('after.paid') });
                            void load();
                          })
                        }
                      />
                    ) : null}
                  </Card>
                ))}
              </View>
            ) : null}
            {view.claims.length ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>{t('after.claims')}</Eyebrow>
                {view.claims.map((c) => (
                  <Card key={c.id} style={{ gap: 6 }}>
                    <Text style={styles.rowTitle}>{c.area}</Text>
                    <Text style={styles.mono}>{c.covered ? t('after.covered') : t('after.notCovered')}</Text>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

type Result = { ok: boolean; text: string };

function WarrantyClaim({ view, onResult }: { view: Aftercare; onResult: (m: Result, toService: boolean) => void }) {
  const t = useT();
  const [area, setArea] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const ready = Boolean(area) && text.trim().length >= 5 && photos.length > 0;

  const add = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: false, allowsMultipleSelection: true, selectionLimit: 4 - photos.length });
    if (!r.canceled) setPhotos([...photos, ...r.assets].slice(0, 4));
  };

  const send = async () => {
    setBusy(true);
    const form = new FormData();
    form.append('projectId', view.projectId);
    form.append('area', area);
    form.append('description', text);
    photos.forEach((p, i) => form.append('photos', { uri: p.uri, name: `claim-${i}.jpg`, type: p.mimeType ?? 'image/jpeg' } as unknown as Blob));
    const r = await api.warrantyClaim(form);
    setBusy(false);
    if (!r.ok) return onResult({ ok: false, text: r.error }, false);
    if (r.data.covered) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setArea('');
      setText('');
      setPhotos([]);
      return onResult({ ok: true, text: r.data.message }, false);
    }
    return onResult({ ok: false, text: r.data.message }, true);
  };

  return (
    <Card style={{ gap: 14 }}>
      <Body>{view.warranty.open ? t('after.warrantyIntro') : (view.warranty.message ?? '')}</Body>
      <Eyebrow>{t('after.area')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {view.warranty.areas.map((a) => (
          <OptionPill key={a.key} label={a.label} on={area === a.key} onPress={() => setArea(a.key)} />
        ))}
      </View>
      <Field label={t('after.what')} value={text} onChangeText={setText} placeholder={t('after.whatHint')} maxLength={500} multiline />
      {photos.length ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {photos.map((p) => (
            <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
          ))}
        </View>
      ) : null}
      {photos.length < 4 ? <Button label={`${t('after.addPhoto')} · ${t('after.photos', { n: photos.length })}`} variant="quiet" onPress={() => void add()} /> : null}
      <Button label={t('after.raise')} onPress={() => void send()} busy={busy} disabled={!ready} reason={ready ? undefined : t('after.raiseReason')} />
    </Card>
  );
}

function ServiceVisit({ view, onResult }: { view: Aftercare; onResult: (m: Result) => void }) {
  const t = useT();
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [day, setDay] = useState(view.service.days[0]?.date ?? '');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const picked = view.service.categories.find((c) => c.key === category);
  const slots = view.service.days.find((d) => d.date === day)?.slots ?? [];
  const ready = Boolean(picked) && Boolean(start) && text.trim().length >= 5 && view.service.ready;

  if (view.service.categories.length === 0) return <Body muted>{t('after.noCharges', { studio: view.studio })}</Body>;

  const book = async () => {
    setBusy(true);
    const form = new FormData();
    form.append('projectId', view.projectId);
    form.append('category', category);
    form.append('description', text);
    form.append('day', day);
    form.append('start', start);
    const r = await api.bookService(form);
    setBusy(false);
    if (!r.ok) return onResult({ ok: false, text: r.error });
    if (!r.data.payUrl) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCategory('');
      setText('');
      setStart('');
      return onResult({ ok: true, text: t('after.bookedFree', { when: r.data.when }) });
    }
    await WebBrowser.openBrowserAsync(r.data.payUrl);
    onResult({ ok: true, text: t('after.paid') });
  };

  return (
    <Card style={{ gap: 14 }}>
      <Body>{view.service.free ? t('after.freeIntro') : t('after.serviceIntro')}</Body>
      <Eyebrow>{t('after.kind')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {view.service.categories.map((c) => (
          <OptionPill key={c.key} label={`${c.label} · ${c.chargePaise === 0 ? t('after.free') : inr(c.chargePaise)}`} on={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </View>
      {/* The free month: the studio's visiting charge for the picked work, struck out. */}
      {picked && picked.chargePaise === 0 && picked.listPaise ? (
        <Text style={styles.mono}>
          <Text style={styles.struck}>{inr(picked.listPaise)}</Text>
          {` ${t('after.free')}`}
        </Text>
      ) : null}
      <Field label={t('after.needs')} value={text} onChangeText={setText} placeholder={t('after.needsHint')} maxLength={500} multiline />
      <Eyebrow>{t('after.day')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {view.service.days.map((d) => (
          <OptionPill
            key={d.date}
            label={d.label}
            on={day === d.date}
            onPress={() => {
              setDay(d.date);
              setStart('');
            }}
          />
        ))}
      </View>
      <Eyebrow>{t('after.time')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {slots.map((s) => (
          <OptionPill key={s.start} label={s.left === 0 ? `${s.label} · ${t('after.full')}` : s.label} on={start === s.start} onPress={s.left === 0 ? undefined : () => setStart(s.start)} />
        ))}
      </View>
      {!view.service.ready ? <Body muted>{t('after.payOff')}</Body> : null}
      <Button
        label={view.service.free ? t('after.bookFree') : picked ? t('after.pay', { amount: inr(picked.chargePaise) }) : t('after.tabService')}
        onPress={() => void book()}
        busy={busy}
        disabled={!ready}
        reason={ready ? undefined : t('after.payReason')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  toast: {
    backgroundColor: color.ink,
    color: color.onDark,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
    fontFamily: font.sansMedium,
    fontSize: 14.5,
    lineHeight: 20,
  },
  rowTitle: { fontFamily: font.sansSemi, fontSize: 17, lineHeight: 21, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: color.ink2 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
});
