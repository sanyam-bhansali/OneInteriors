import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Button, Card, Eyebrow, ErrorText, Loading, Screen, Title } from '../components/ui';
import { api, type AgreementView } from '../lib/api';
import { useT } from '../lib/i18n';
import { useProject } from '../lib/project';
import { color, font } from '../lib/theme';

/**
 * Your agreement (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md):
 * sent by the studio at design closure; read it, then sign with Aadhaar eSign
 * in the browser. Only the person whose home it is signs. Coming back, the
 * screen reads it again.
 */
export default function AgreementScreen() {
  const t = useT();
  const { state } = useProject();
  const projectId = state.status === 'ready' ? state.project.id : null;
  const [view, setView] = useState<AgreementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    const r = await api.agreement(projectId);
    if (r.ok) setView(r.data);
    else setError(r.error);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') return <Loading />;
  const studio = view?.studio ?? '';

  return (
    <Screen back onRefresh={() => void load()} refreshing={false}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('agree.eyebrow')}</Eyebrow>
          <Title size={38}>{t('agree.title')}</Title>
        </View>
        {note ? <Text style={{ fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink }}>{note}</Text> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!view ? (
          state.status === 'ready' && !error ? <Loading /> : null
        ) : view.state === 'none' ? (
          <Body muted>{t('agree.none', { studio })}</Body>
        ) : view.state === 'signed' ? (
          <Card style={{ gap: 12 }}>
            <Body>{t('agree.signed', { studio })}</Body>
            {view.signedUrl ? <Button label={t('agree.openSigned')} onPress={() => void WebBrowser.openBrowserAsync(view.signedUrl!)} /> : null}
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <Body>{view.owner ? t('agree.sent', { studio }) : t('agree.sentFamily')}</Body>
            {view.pdfUrl ? <Button label={t('agree.read')} variant="light" onPress={() => void WebBrowser.openBrowserAsync(view.pdfUrl!)} /> : null}
            {view.signUrl ? (
              <Button
                label={t('agree.sign')}
                onPress={() =>
                  void WebBrowser.openBrowserAsync(view.signUrl!).then(() => {
                    setNote(t('agree.back'));
                    void load();
                  })
                }
              />
            ) : view.owner ? (
              <Body muted>{t('agree.soon', { studio })}</Body>
            ) : null}
          </Card>
        )}
      </View>
    </Screen>
  );
}
