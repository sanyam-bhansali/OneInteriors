import * as WebBrowser from 'expo-web-browser';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { QuizScreen } from '../../components/journey/parts';
import { Tick } from '../../components/journey-quote/Confetti';
import { Body, Button, ErrorText, Eyebrow, Loading, Press, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useBrief } from '../../lib/brief';
import { useHeadline, useT } from '../../lib/i18n';
import { quoteApi, useChosenMatches } from '../../lib/journey/quote';
import { color, font } from '../../lib/theme';

/**
 * #12 Phone and consent (designs/Phone.dc.html; the website's /app/verify).
 * The number is asked for once, when the quotes are ready: a fixed +91, the
 * 6-digit code on the same screen with a 30-second wait before a new one,
 * then two boxes. The first (share the brief with these studios, with the
 * privacy policy) is required and the button says so until it is ticked;
 * the second (tips and offers) is optional and never mentions WhatsApp:
 * customers never get it. Verifying signs them in and saves the brief,
 * name, number and consent on the account in one call; then the chosen
 * studios are kept as the shortlist, and the quotes open. Someone already
 * signed in never sees this screen.
 */
const WAIT = 30;
const PRIVACY_URL = 'https://oneinteriors.in/privacy';

/** "98220 41736", as the design writes a number. */
const spaced = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

export default function PhoneScreen() {
  const t = useT();
  const h1 = useHeadline(38);
  const { state, signIn } = useAuth();
  const { brief, ready } = useBrief();
  const chosen = useChosenMatches();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);
  const [share, setShare] = useState(false);
  const [offers, setOffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);
  /** Set once this screen signs them in, so the signed-in skip below does not race the shortlist. */
  const verifying = useRef(false);

  const digits = phone.replace(/\D/g, '');
  const n = chosen.matches.length || 3;

  // A returning customer who is already signed in goes straight to the quotes.
  useEffect(() => {
    if (state.status === 'signed-in' && !verifying.current) router.replace('/journey/quote' as Href);
  }, [state.status]);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await api.requestCode(`+91${digits}`, brief.contactName ?? '');
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
    verifying.current = true;
    const res = await quoteApi.verifyWithBrief(`+91${digits}`, code.trim(), brief.contactName ?? '', brief, { share, offers });
    if (!res.ok) {
      verifying.current = false;
      setBusy(false);
      return setError(res.error);
    }
    await signIn(res.data.token);
    // The shortlist is what ops and the expert read. If it fails the quotes
    // still open: the expert call falls back to the brief's own matches.
    await quoteApi.submit(chosen.matches.map((m) => m.slug));
    setBusy(false);
    router.replace('/journey/quote' as Href);
  }

  const footer = !share ? (
    <Button label={t('verify.tick')} disabled />
  ) : (
    <Button
      label={t('verify.cta')}
      onPress={() => void verify()}
      busy={busy && sent}
      disabled={!sent || code.trim().length !== 6}
      reason={sent ? t('signin.needCode') : t('phone.needSend')}
    />
  );

  if (!ready || state.status === 'loading' || state.status === 'signed-in' || chosen.status === 'loading') return <Loading />;

  return (
    <QuizScreen back={'/journey/matches' as Href} meta={t('verify.meta')} footer={footer}>
      <View style={{ gap: 12 }}>
        <Title size={h1} style={{ lineHeight: h1 * 0.98 }}>
          {t('verify.h1', { n })}
        </Title>
        <Body muted style={{ fontSize: 15 }}>
          {t('verify.sub')}
        </Body>
      </View>

      <View style={{ gap: 8 }}>
        <Eyebrow>{t('verify.mobile')}</Eyebrow>
        <View style={styles.phoneRow}>
          <Text style={styles.prefix} aria-hidden>
            +91
          </Text>
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
        {!sent ? (
          <View style={{ marginTop: 12 }}>
            <Button
              label={t('phone.send')}
              variant="ghost"
              onPress={() => void sendCode()}
              busy={busy}
              disabled={digits.length !== 10}
              reason={t('signin.needNumber')}
            />
          </View>
        ) : null}
      </View>

      {sent ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>{t('phone.code')}</Eyebrow>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            aria-label={t('phone.code')}
            style={styles.code}
          />
          {left > 0 ? (
            <Text style={styles.wait} aria-live="polite">
              {t('verify.wait', { s: String(left).padStart(2, '0') })}
            </Text>
          ) : (
            <Pressable role="button" aria-label={t('verify.resend')} onPress={() => void sendCode()} disabled={busy} style={styles.linkHit}>
              <Text style={styles.link}>{t('verify.resend')}</Text>
            </Pressable>
          )}
          <Pressable
            role="button"
            aria-label={t('signin.other')}
            onPress={() => {
              setSent(false);
              setCode('');
              setError(null);
            }}
            style={styles.linkHit}
          >
            <Text style={styles.link}>{t('signin.other')}</Text>
          </Pressable>
          {devCode ? <Body muted>{t('signin.dev', { code: devCode })}</Body> : null}
        </View>
      ) : null}

      <View style={styles.boxes}>
        <Box on={share} onToggle={() => setShare((v) => !v)} label={`${t('verify.consent')} ${t('verify.privacy')}.`}>
          <Text style={styles.boxText} onPress={() => setShare((v) => !v)}>
            {t('verify.consent')}{' '}
            <Text
              role="link"
              aria-label={`${t('verify.privacy')}. ${t('phone.privacyHint')}`}
              style={styles.privacy}
              onPress={(e) => {
                e.stopPropagation?.();
                void WebBrowser.openBrowserAsync(PRIVACY_URL);
              }}
            >
              {t('verify.privacy')}
            </Text>
            .
          </Text>
        </Box>
        <Box on={offers} onToggle={() => setOffers((v) => !v)} label={t('phone.offers')}>
          <Text style={[styles.boxText, { color: color.ink2 }]} onPress={() => setOffers((v) => !v)}>
            {t('phone.offers')}
          </Text>
        </Box>
      </View>

      {error ? (
        <View role="alert">
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
    </QuizScreen>
  );
}

/** A consent row: a 22 px box (in a 44 px target) that fills with ink and a terracotta tick, then its words. */
function Box({ on, onToggle, label, children }: { on: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <View style={styles.boxRow}>
      <Press onPress={onToggle} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} style={styles.boxHit}>
        <View style={[styles.box, on && styles.boxOn]}>{on ? <Tick size={15} /> : null}</View>
      </Press>
      <View style={{ flex: 1, paddingTop: 11 }}>{children}</View>
    </View>
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
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink, textDecorationLine: 'underline' },
  boxes: { borderTopWidth: 1, borderTopColor: color.line },
  boxRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.line },
  boxHit: { width: 44, height: 44, marginLeft: -11, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(11,11,11,.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.paper,
  },
  boxOn: { backgroundColor: color.accent, borderColor: color.accent },
  boxText: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 22, color: color.ink, paddingBottom: 10 },
  privacy: { fontFamily: font.sansMedium, color: color.accentInk, textDecorationLine: 'underline' },
});
