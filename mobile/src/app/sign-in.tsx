import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { projectsOnly } from '../lib/config';
import { PasswordSignIn } from '../components/sign-in/PasswordSignIn';
import { useAuth } from '../lib/auth';
import { useHeadline, useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * A returning customer's sign-in (the phone screen, #12, without the quote
 * consent: that belongs to the first visit, when the brief is shared). The
 * number with a fixed +91, then the 6-digit WhatsApp code on the same
 * screen, a 30-second wait before a new code (the server's cooldown), and
 * a button that says what is missing while it cannot be pressed.
 */
const WAIT = 30;

/** "98220 41736", as the design writes a number. */
const spaced = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

/** Password while only the project app is open (owner, 1 Nov 2026); the WhatsApp code once codes are live. */
export default function SignIn() {
  return projectsOnly() ? <PasswordSignIn /> : <CodeSignIn />;
}

function CodeSignIn() {
  const { signIn } = useAuth();
  const t = useT();
  const h1 = useHeadline(38);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);

  const digits = phone.replace(/\D/g, '');
  const ready = digits.length === 10;

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await api.requestCode(`+91${digits}`, '');
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDevCode(res.data.devCode ?? null);
    setCode('');
    setSent(true);
    setLeft(WAIT);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await api.verifyCode(`+91${digits}`, code.trim(), '');
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    await signIn(res.data.token);
    router.replace('/home');
  }

  const footer = sent ? (
    <>
      <Button label={t('signin.cta')} onPress={() => void verify()} busy={busy} disabled={code.trim().length !== 6} reason={t('signin.needCode')} />
      <Button
        label={t('signin.other')}
        variant="quiet"
        onPress={() => {
          setSent(false);
          setCode('');
          setError(null);
        }}
      />
    </>
  ) : (
    <Button label={t('verify.sendThis')} onPress={() => void sendCode()} busy={busy} disabled={!ready} reason={t('signin.needNumber')} />
  );

  return (
    <Screen back footer={footer}>
      <Eyebrow>{t('signin.meta')}</Eyebrow>
      <Title size={h1}>{t('signin.h1')}</Title>
      <Body muted style={{ fontSize: 15 }}>
        {t('signin.sub')}
      </Body>

      <View style={{ gap: 8, marginTop: 10 }}>
        <Eyebrow>{t('verify.mobile')}</Eyebrow>
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(spaced(v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '').slice(0, 10)))}
            editable={!sent}
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            aria-label={t('verify.mobile')}
            placeholder="98220 41736"
            placeholderTextColor={color.ink3}
            style={[styles.phone, sent && { color: color.ink2 }]}
          />
        </View>
      </View>

      {sent ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('verify.code')}</Eyebrow>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            aria-label={t('verify.code')}
            style={styles.code}
          />
          {left > 0 ? (
            <Text style={styles.wait}>{t('verify.wait', { s: String(left).padStart(2, '0') })}</Text>
          ) : (
            <Pressable role="button" onPress={() => void sendCode()} disabled={busy} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={styles.link}>{t('verify.resend')}</Text>
            </Pressable>
          )}
          {devCode ? <Body muted>{t('signin.dev', { code: devCode })}</Body> : null}
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {!sent ? (
        <Pressable
          role="link"
          onPress={() => router.push('/journey/name')}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={styles.link}>{t('signin.new')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: color.ink },
  prefix: { fontFamily: font.mono, fontSize: 20, paddingBottom: 13, color: color.ink2 },
  phone: { flex: 1, minHeight: 52, fontFamily: font.mono, fontSize: 20, color: color.ink, padding: 0 },
  code: {
    minHeight: 56,
    borderBottomWidth: 2,
    borderBottomColor: color.accent,
    fontFamily: font.mono,
    fontSize: 28,
    letterSpacing: 28 * 0.4,
    color: color.ink,
    padding: 0,
  },
  wait: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  link: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink, textDecorationLine: 'underline' },
});
