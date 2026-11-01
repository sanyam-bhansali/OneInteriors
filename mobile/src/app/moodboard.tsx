import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Card, ErrorText, Eyebrow, Loading, Meta, Press, Screen, Title } from '../components/ui';
import { api, type MoodRoom } from '../lib/api';
import { useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * Your mood board, in the phone app itself (owner, 1 Nov 2026; customer app
 * Phase 2), room by room: the style and its three materials (shuffle for
 * another), the room's one question, the pieces on the board (tap to take one
 * off, add from what suits you; above-budget ones are marked), and a note for
 * the designer. The same boards as the website; the designer sees them.
 */
export default function MoodBoard() {
  const t = useT();
  const [rooms, setRooms] = useState<MoodRoom[] | null>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    void api.moodboard().then((r) => {
      if (!r.ok) return setError(r.error);
      setOpen(r.data.open);
      setRooms(r.data.rooms);
    });
  useEffect(load, []);

  const save = async (room: MoodRoom, patch: Parameters<typeof api.saveMoodRoom>[1], reload = false) => {
    setError(null);
    const r = await api.saveMoodRoom(room.key, patch);
    if (!r.ok) return setError(r.error);
    if (reload) load();
  };

  const change = (key: string, next: Partial<MoodRoom>) => setRooms((rs) => (rs ?? []).map((r) => (r.key === key ? { ...r, ...next } : r)));

  if (!rooms && !error) return <Loading />;
  return (
    <Screen back>
      <Eyebrow>{t('mood.meta')}</Eyebrow>
      <Title size={34}>{t('design.mood.title')}</Title>
      {!open ? <Body muted>{t('mood.closed')}</Body> : <Body muted>{t('design.mood.body')}</Body>}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {(rooms ?? []).map((room) => (
        <Card key={room.key}>
          <View style={styles.head}>
            <Text style={styles.room}>{room.label}</Text>
            {room.optionCount > 1 ? (
              <Press onPress={() => void save(room, { shuffle: room.shuffle + 1 }, true)} accessibilityLabel={t('mood.shuffle')} style={styles.chip}>
                <Text style={styles.chipText}>{t('mood.shuffle')}</Text>
              </Press>
            ) : null}
          </View>
          <Text style={styles.style}>{room.style}</Text>
          <Meta>{room.materials.join(' · ')}</Meta>

          <Text style={styles.q}>{room.question}</Text>
          {room.options.map((o, i) => (
            <Press
              key={o.label}
              onPress={() => {
                const next = room.chosenOption === i ? null : i;
                change(room.key, { chosenOption: next });
                void save(room, { chosenOption: next });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: room.chosenOption === i }}
              style={[styles.option, room.chosenOption === i && styles.optionOn]}
            >
              <Text style={[styles.optionLabel, room.chosenOption === i && { color: color.white }]}>{o.label}</Text>
              <Text style={[styles.optionNote, room.chosenOption === i && { color: color.onDark2 }]}>{o.note}</Text>
            </Press>
          ))}

          <Text style={styles.q}>{t('mood.onBoard')}</Text>
          <View style={styles.wrap}>
            {room.items.map((it) => (
              <Press
                key={it.slug}
                onPress={() => {
                  const items = room.items.filter((x) => x.slug !== it.slug);
                  change(room.key, { items, picker: [{ slug: it.slug, label: it.label, aboveBand: false }, ...room.picker] });
                  void save(room, { items: items.map((x) => x.slug) });
                }}
                accessibilityLabel={t('mood.remove', { item: it.label })}
                style={[styles.chip, styles.chipOn]}
              >
                <Text style={[styles.chipText, { color: color.white }]}>{it.label} ×</Text>
              </Press>
            ))}
          </View>
          {room.picker.length ? (
            <>
              <Meta>{t('mood.add')}</Meta>
              <View style={styles.wrap}>
                {room.picker.slice(0, 12).map((p) => (
                  <Press
                    key={p.slug}
                    onPress={() => {
                      const items = [...room.items, { slug: p.slug, label: p.label }];
                      change(room.key, { items, picker: room.picker.filter((x) => x.slug !== p.slug) });
                      void save(room, { items: items.map((x) => x.slug) });
                    }}
                    accessibilityLabel={t('mood.addItem', { item: p.label })}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>
                      + {p.label}
                      {p.aboveBand ? ` · ${t('mood.above')}` : ''}
                    </Text>
                  </Press>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.q}>{t('mood.note')}</Text>
          <TextInput
            value={room.note}
            onChangeText={(v) => change(room.key, { note: v })}
            onEndEditing={() => void save(room, { note: room.note })}
            multiline
            maxLength={500}
            aria-label={t('mood.note')}
            style={styles.input}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  room: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink },
  style: { fontFamily: font.sansMedium, fontSize: 15, color: color.accentInk },
  q: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink, marginTop: 8 },
  option: { borderWidth: 1, borderColor: color.line, borderRadius: 12, padding: 12, gap: 2, minHeight: 44 },
  optionOn: { backgroundColor: color.ink, borderColor: color.ink },
  optionLabel: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
  optionNote: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: color.line, justifyContent: 'center', backgroundColor: color.white },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipText: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.ink },
  input: { minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: color.line, padding: 12, fontFamily: font.sans, fontSize: 15, color: color.ink, backgroundColor: color.white, textAlignVertical: 'top' },
});
