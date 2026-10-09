import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowIcon } from '../../components/icons';
import { Body, Loading, Meta, Press, Rise, Screen, Title } from '../../components/ui';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';
import { DOC_KINDS } from '../../lib/types';

/** Home locker (the v1 design): every document about the home, searchable, opened in the phone's browser. */
export default function Locker() {
  const { state, refresh, refreshing } = useProject();
  const [q, setQ] = useState('');
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'none') {
    return (
      <Screen>
        <Meta>For as long as you live there</Meta>
        <Title>Home locker</Title>
        <Body muted>Your agreement, drawings, receipts and warranties are kept here once your project starts.</Body>
      </Screen>
    );
  }
  const p = state.project;
  const term = q.trim().toLowerCase();
  const docs = p.documents.filter((d) => !term || `${d.title} ${DOC_KINDS[d.kind]} ${d.meta}`.toLowerCase().includes(term));

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Meta>Your home, for as long as you live there</Meta>
      <Title size={40}>Home locker</Title>
      <TextInput value={q} onChangeText={setQ} placeholder="Search, for example warranty" placeholderTextColor={color.ink3} style={styles.search} />
      <Text style={styles.h2}>Documents</Text>
      {p.documents.length === 0 ? <Body muted>Nothing filed yet. Documents appear here as {p.studio} adds them.</Body> : null}
      <View>
        {docs.map((d, i) => (
          <Rise key={d.id} delay={Math.min(i, 8) * 60}>
            <Press
              haptic={false}
              disabled={!d.url}
              onPress={() => {
                // Signed links last minutes; pull to refresh makes fresh ones.
                if (d.url) void WebBrowser.openBrowserAsync(d.url);
              }}
              style={styles.doc}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{d.title}</Text>
                <Text style={styles.docMeta}>
                  {DOC_KINDS[d.kind]} · {d.meta}
                </Text>
              </View>
              <ArrowIcon color={color.ink2} />
            </Press>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: color.line, paddingHorizontal: 18, fontFamily: font.sans, fontSize: 15, color: color.ink },
  h2: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.7, color: color.ink },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  docTitle: { fontFamily: font.sansSemi, fontSize: 17, color: color.ink },
  docMeta: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2, marginTop: 3 },
});
