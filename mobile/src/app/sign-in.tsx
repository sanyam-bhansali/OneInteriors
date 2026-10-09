import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Field, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { color, font } from '../lib/theme';

/**
 * Phone + WhatsApp code: the website's customer sign-in, same rules
 * (modules/auth/otp.ts on the server). The name is asked here because it is
 * what the expert opens the call with.
 */
export default function SignIn() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'number' | 'code'>('number');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await api.requestCode(phone, name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDevCode(res.data.devCode ?? null);
    setCode('');
    setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await api.verifyCode(phone, code, name);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    await signIn(res.data.token);
    router.replace('/home');
  }

  if (step === 'code') {
    return (
      <Screen
        footer={
          <>
            <Button label="Continue" onPress={() => void verify()} busy={busy} disabled={code.trim().length < 4} />
            <Button label="Use a different number" variant="quiet" onPress={() => setStep('number')} />
          </>
        }
      >
        <Eyebrow>Step 2 of 2</Eyebrow>
        <Title>Enter the code</Title>
        <Body>We sent a code on WhatsApp to {phone}.</Body>
        {devCode ? <Body muted>Test build: your code is {devCode}.</Body> : null}
        <Field
          label="Code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={8}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Pressable accessibilityRole="button" onPress={() => void sendCode()} disabled={busy}>
          <Text style={styles.link}>Send the code again</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label="Send code on WhatsApp"
          onPress={() => void sendCode()}
          busy={busy}
          disabled={!name.trim() || phone.replace(/\D/g, '').length < 10}
        />
      }
    >
      <Eyebrow>Step 1 of 2</Eyebrow>
      <Title>Your name and number</Title>
      <Body>No password. We send a one-time code on WhatsApp, and that is your sign-in.</Body>
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        maxLength={80}
      />
      <Field
        label="Mobile number"
        hint="An Indian mobile number, with or without +91."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: font.sansMedium, fontSize: 15, color: color.accentInk, textDecorationLine: 'underline' },
});
