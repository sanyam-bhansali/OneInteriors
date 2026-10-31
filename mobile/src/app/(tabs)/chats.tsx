import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Body, Card, Eyebrow, Loading, Press, Screen, Title } from '../../components/ui';
import { api, type Contact } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { color, font } from '../../lib/theme';

/**
 * Chats (the owner's v1 screens). Chat inside the app is being built (owner,
 * 1 Nov 2026: our own chat, never WhatsApp from us). Clients join first, so
 * until it is ready this says so and lets them call their designer
 * (GET /api/app/v1/contacts).
 */
export default function Chats() {
  const t = useT();
  const [view, setView] = useState<{ studio: string | null; contacts: Contact[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void api.contacts().then((r) => live && setView(r.ok ? { studio: r.data.studio, contacts: r.data.contacts } : { studio: null, contacts: [] }));
      return () => {
        live = false;
      };
    }, []),
  );

  if (!view) return <Loading />;
  return (
    <Screen>
      <Eyebrow>{view.studio ?? t('chats.team')}</Eyebrow>
      <Title>{t('tab.chats')}</Title>
      <Card>
        <Text style={styles.lead}>{t('chats.soon')}</Text>
        <Body muted>{t('chats.soon.body')}</Body>
      </Card>
      {view.contacts.length ? (
        <View style={{ gap: 10 }}>
          {view.contacts.map((c) => (
            <View key={`${c.role}-${c.name}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.role}>{c.role === 'Designer' ? t('chats.designer') : t('chats.pm')}</Text>
              </View>
              {c.phone ? (
                <Press onPress={() => void Linking.openURL(`tel:${c.phone}`).catch(() => {})} accessibilityLabel={t('chats.call', { name: c.name })} style={styles.call}>
                  <Text style={styles.callText}>{t('chats.callShort')}</Text>
                </Press>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Body muted>{t('chats.none')}</Body>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: font.sansSemi, fontSize: 17, color: color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.line },
  name: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  role: { fontFamily: font.sans, fontSize: 13, color: color.ink2, marginTop: 2 },
  call: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  callText: { fontFamily: font.sansSemi, fontSize: 15, color: color.white },
});
