import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useHeadline, useT } from '../../lib/i18n';
import { color, font } from '../../lib/theme';

import { spacedMobile } from '../../lib/chat-merge';

/**
 * "Good to see you again" (the owner's v1 screens), with the password the
 * studio gave in place of the WhatsApp code (owner, 1 Nov 2026). A one-time
 * password goes on to choosing their own (/password) before anything else.
 */
export function PasswordSignIn() {
  const { signIn } = useAuth();
  const t = useT();
  const h1 = useHeadline(38);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, '');
  const ready = digits.length === 10 && password.length > 0;

  async function go() {
    setBusy(true);
    setError(null);
    const res = await api.passwordSignIn(`+91${digits}`, password);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    await signIn(res.data.token);
    router.replace(res.data.mustChange ? '/password' : '/home');
  }

  return (
    <Screen footer={<Button label={t('pw.cta')} onPress={() => void go()} busy={busy} disabled={!ready} reason={t('pw.need')} />}>
      <Eyebrow>{t('signin.meta')}</Eyebrow>
      <Title size={h1}>{t('pw.h1')}</Title>
      <Body muted style={{ fontSize: 15 }}>
        {t('pw.sub')}
      </Body>

      <View style={{ gap: 8, marginTop: 10 }}>
        <Eyebrow>{t('verify.mobile')}</Eyebrow>
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(spacedMobile(v))}
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            aria-label={t('verify.mobile')}
            placeholder="98220 41736"
            placeholderTextColor={color.ink3}
            style={styles.phone}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Eyebrow>{t('pw.password')}</Eyebrow>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          aria-label={t('pw.password')}
          onSubmitEditing={() => ready && void go()}
          style={styles.password}
        />
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
      <Body muted>{t('pw.forgot')}</Body>
    </Screen>
  );
}

export const passwordStyles = StyleSheet.create({
  input: { minHeight: 52, borderBottomWidth: 1.5, borderBottomColor: color.ink, fontFamily: font.mono, fontSize: 20, color: color.ink, padding: 0 },
});

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: color.ink },
  prefix: { fontFamily: font.mono, fontSize: 20, paddingBottom: 13, color: color.ink2 },
  phone: { flex: 1, minHeight: 52, fontFamily: font.mono, fontSize: 20, color: color.ink, padding: 0 },
  password: passwordStyles.input,
});
