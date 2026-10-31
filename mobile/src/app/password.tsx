import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { passwordStyles } from '../components/sign-in/PasswordSignIn';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { useHeadline, useT } from '../lib/i18n';

/** After the studio's one-time password (owner, 1 Nov 2026): the client chooses their own before anything else. */
export default function ChoosePassword() {
  const t = useT();
  const h1 = useHeadline(36);
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (next !== again) return setError(t('pw.mismatch'));
    setBusy(true);
    setError(null);
    const res = await api.choosePassword(next);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace('/home');
  }

  const field = (value: string, set: (v: string) => void, label: string) => (
    <View style={{ gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        value={value}
        onChangeText={set}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        aria-label={label}
        style={passwordStyles.input}
      />
    </View>
  );

  return (
    <Screen footer={<Button label={t('pw.save')} onPress={() => void save()} busy={busy} disabled={next.length < 12 || !again} reason={t('pw.short')} />}>
      <Title size={h1}>{t('pw.choose.h1')}</Title>
      <Body muted style={{ fontSize: 15 }}>
        {t('pw.choose.sub')}
      </Body>
      {field(next, setNext, t('pw.new'))}
      {field(again, setAgain, t('pw.again'))}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
