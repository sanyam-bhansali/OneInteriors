import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Eyebrow, Loading, Press, Screen, Title } from '../../components/ui';
import { api, type ChatHit, type ChatRow, type Contact } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { color, font } from '../../lib/theme';

/**
 * Chats (the owner's v1 screens; owner, 1 Nov 2026: our own chat, never
 * WhatsApp from us). The client's conversations: their designer, the home
 * team, One Interiors; refreshed every ten seconds while open. A call button
 * stays for the designer.
 */
export default function Chats() {
  const t = useT();
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [studio, setStudio] = useState<string | null>(null);
  const [designer, setDesigner] = useState<Contact | null>(null);
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ChatHit[] | null>(null);

  /* Search as they type, a moment after they stop. */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setHits(null);
    let live = true;
    const id = setTimeout(() => void api.chatSearch(term).then((r) => live && setHits(r.ok ? r.data.hits : [])), 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q]);

  const archive = (c: ChatRow) =>
    Alert.alert(c.title, undefined, [
      {
        text: c.archived ? t('chats.unarchive') : t('chats.archive'),
        onPress: () => void api.chatArchive(c.projectId, c.kind, !c.archived).then(() => setRows((rs) => (rs ?? []).filter((x) => x !== c))),
      },
      { text: t('chat.cancel'), style: 'cancel' },
    ]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const load = () =>
        void api.chats(archived).then((r) => {
          if (!live) return;
          setRows(r.ok ? r.data.chats : (rows ?? []));
        });
      load();
      void api.contacts().then((r) => {
        if (!live || !r.ok) return;
        setStudio(r.data.studio);
        setDesigner(r.data.contacts.find((c) => c.role === 'Designer' && c.phone) ?? null);
      });
      const id = setInterval(load, 10_000);
      return () => {
        live = false;
        clearInterval(id);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archived]),
  );

  if (!rows) return <Loading />;
  return (
    <Screen>
      <Eyebrow>{studio ?? t('chats.team')}</Eyebrow>
      <Title>{t('tab.chats')}</Title>
      <View style={styles.tools}>
        <TextInput value={q} onChangeText={setQ} placeholder={t('chats.search')} placeholderTextColor={color.ink3} aria-label={t('chats.search')} style={styles.search} />
        <Press onPress={() => setArchived((a) => !a)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={styles.toggle}>{archived ? t('chats.back') : t('chats.archived')}</Text>
        </Press>
      </View>
      {hits ? (
        <View>
          {hits.length === 0 ? <Body muted>{t('chats.noHits')}</Body> : null}
          {hits.map((h, i) => (
            <Press
              key={`${h.projectId}:${h.kind}:${h.at}:${i}`}
              onPress={() => router.push({ pathname: '/chat/[projectId]/[kind]', params: { projectId: h.projectId, kind: h.kind } })}
              accessibilityRole="link"
              style={styles.row}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.line}>
                  <Text style={styles.title} numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text style={styles.time}>{when(h.at)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={2}>
                  {`${h.from.split(' ')[0]}: ${h.preview}`}
                </Text>
              </View>
            </Press>
          ))}
        </View>
      ) : null}
      {!hits && rows.length === 0 ? <Body muted>{archived ? t('chats.noArchived') : t('chats.empty')}</Body> : null}
      <View>
        {(hits ? [] : rows).map((c) => (
          <Press
            key={`${c.projectId}:${c.kind}`}
            onLongPress={() => (c.last ? archive(c) : undefined)}
            onPress={() => router.push({ pathname: '/chat/[projectId]/[kind]', params: { projectId: c.projectId, kind: c.kind } })}
            accessibilityRole="link"
            accessibilityLabel={`${c.title}${c.unread ? `, ${c.unread} new` : ''}`}
            style={styles.row}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.kind === 'ONE_INTERIORS' ? 'OI' : c.kind === 'TEAM' ? '⌂' : (c.title.trim()[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.line}>
                <Text style={styles.title} numberOfLines={1}>
                  {c.title}
                </Text>
                {c.last ? <Text style={styles.time}>{when(c.last.at)}</Text> : null}
              </View>
              <View style={styles.line}>
                <Text style={styles.preview} numberOfLines={1}>
                  {c.last ? `${c.last.mine ? t('chats.you') : c.last.from.split(' ')[0]}: ${c.last.preview}` : t('chats.start')}
                </Text>
                {c.unread ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Press>
        ))}
      </View>
      <Body muted>{t('chats.private')}</Body>
      {designer?.phone ? (
        <Press onPress={() => void Linking.openURL(`tel:${designer.phone}`).catch(() => {})} accessibilityLabel={t('chats.call', { name: designer.name })} style={styles.call}>
          <Text style={styles.callText}>{t('chats.call', { name: designer.name.split(' ')[0] ?? designer.name })}</Text>
        </Press>
      ) : null}
    </Screen>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const same = d.toDateString() === new Date().toDateString();
  return same
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.line, minHeight: 64 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F1E3DA', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.sansSemi, fontSize: 16, color: color.accent },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  time: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  preview: { flex: 1, fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, fontFamily: font.sans, fontSize: 15, color: color.ink, backgroundColor: color.white },
  toggle: { fontFamily: font.sansMedium, fontSize: 14, color: color.ink, textDecorationLine: 'underline' },
  call: { minHeight: 48, borderRadius: 999, borderWidth: 1.5, borderColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  callText: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
});
