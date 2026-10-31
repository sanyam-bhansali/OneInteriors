import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { passwordStyles } from '../components/sign-in/PasswordSignIn';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { useHeadline, useT } from '../lib/i18n';
import { useProject } from '../lib/project';

/**
 * "Connect your project" (the owner's v1 screens, 1 Nov 2026): paste the
 * link or type the code the designer sent. The project is already on the
 * account for the invited number; this checks the code is theirs and opens
 * it, or says which number to sign in with.
 */
export default function Connect() {
  const t = useT();
  const h1 = useHeadline(38);
  const { refresh } = useProject();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const res = await api.join(code.trim());
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    await refresh();
    router.replace('/home');
  }

  return (
    <Screen back footer={<Button label={t('connect.cta')} onPress={() => void open()} busy={busy} disabled={code.trim().length < 4} reason={t('connect.need')} />}>
      <Eyebrow>{t('connect.meta')}</Eyebrow>
      <Title size={h1}>{t('connect.h1')}</Title>
      <Body muted style={{ fontSize: 15 }}>
        {t('connect.sub')}
      </Body>
      <View style={{ gap: 8 }}>
        <Eyebrow>{t('connect.label')}</Eyebrow>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          aria-label={t('connect.label')}
          onSubmitEditing={() => code.trim().length >= 4 && void open()}
          style={passwordStyles.input}
        />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : <Body muted>{t('connect.none')}</Body>}
    </Screen>
  );
}
