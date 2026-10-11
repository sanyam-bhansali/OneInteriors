import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChooseFrame, InfoRow, LineIcon } from '../../../../components/journey/choose-parts';
import { PlanCards, type PlanId } from '../../../../components/plan/PlanCards';
import { CameraIcon } from '../../../../components/icons';
import { Body, Button, DarkCard, ErrorText, Eyebrow, Heading, Loading, Press, Rise, Screen, Title } from '../../../../components/ui';
import { useAuth } from '../../../../lib/auth';
import { inr } from '../../../../lib/format';
import { useHeadline, useT } from '../../../../lib/i18n';
import { chooseApi, type FinalQuoteView } from '../../../../lib/journey/choose';
import { useProfile } from '../../../../lib/profile';
import { useProject } from '../../../../lib/project';
import { color, font, radius } from '../../../../lib/theme';

/**
 * #20 Choose 4 · Sign (design Sign.dc.html; the website's
 * src/app/app/choose/sign/[id]/SignScreen.tsx). The locked total, handover,
 * how they pay, the studio's own terms, then the plan (owner decision,
 * 11 Oct 2026: Basic by default; Assured registers interest and our team
 * confirms the fee), the tick, and a 6-digit code to the number on their
 * account. The design's "Sign with Aadhaar OTP" needs a licensed e-sign
 * provider that is not chosen, so the server signs with a phone code and
 * nothing here claims Aadhaar. Signed, it is Stage 2: "Your project is
 * unlocked", then Home.
 */

type State = { status: 'loading' } | { status: 'ready'; q: FinalQuoteView } | { status: 'error'; error: string };

const WAIT = 30;

/** "+91 98220 41736". */
const shown = (phone: string | null | undefined) => {
  const d = (phone ?? '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
};

export default function Sign() {
  const t = useT();
  const h1 = useHeadline(34);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state: auth } = useAuth();
  const user = auth.status === 'signed-in' ? auth.user : null;
  const project = useProject();
  const profile = useProfile();

  const [state, setState] = useState<State>({ status: 'loading' });
  const [plan, setPlan] = useState<PlanId>('basic');
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ assured: boolean } | null>(null);
  const [opening, setOpening] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    const res = await chooseApi.quote(String(id));
    setState(res.ok ? { status: 'ready', q: res.data.quote } : { status: 'error', error: res.error });
  }, [id]);

  useEffect(() => {
    let live = true;
    void chooseApi.quote(String(id)).then((res) => {
      if (live) setState(res.ok ? { status: 'ready', q: res.data.quote } : { status: 'error', error: res.error });
    });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') {
    return (
      <ChooseFrame
        back="/journey/choose"
        step={4}
        footer={
          <Button
            label={t('choose.retry')}
            onPress={() => {
              setState({ status: 'loading' });
              void load();
            }}
          />
        }
      >
        <Title size={h1}>{t('choose.step4')}</Title>
        <ErrorText>{state.error}</ErrorText>
      </ChooseFrame>
    );
  }
  const q = state.q;

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await chooseApi.signCode(q.id);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDevCode(res.data.devCode ?? null);
    setCode('');
    setSent(true);
    setLeft(WAIT);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function sign() {
    setBusy(true);
    setError(null);
    const res = await chooseApi.sign(q.id, code, plan);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSigned({ assured: plan === 'assured' || res.data.assuredRequested });
    // The project now exists: fetch it and the plan, so Home opens on it.
    void project.refresh();
    void profile.refresh();
  }

  async function openProject() {
    setOpening(true);
    await Promise.all([project.refresh(), profile.refresh()]);
    setOpening(false);
    router.replace('/home');
  }

  if (signed) {
    const name = user?.name?.trim().split(/\s+/)[0];
    return (
      <Screen dark footer={<Button label={t('choose.open')} variant="light" busy={opening} onPress={() => void openProject()} />}>
        <StatusBar style="light" />
        <View style={{ paddingTop: 60, gap: 26 }}>
          <Rise>
            <View style={styles.check}>
              <LineIcon name="tick" size={30} tint={color.white} stroke={2.4} />
            </View>
          </Rise>
          <View role="status" aria-live="polite" style={{ gap: 12 }}>
            <Eyebrow onDark>{t('sign.done.eyebrow')}</Eyebrow>
            <Title size={h1 + 6} style={{ color: color.onDark }}>
              {name ? t('sign.done.h1', { name }) : t('sign.done.h1Anon')}
            </Title>
            <Body style={{ color: color.onDark2, fontSize: 16, lineHeight: 24 }}>{t('sign.done.body', { studio: q.studioName })}</Body>
          </View>
          {signed.assured ? (
            <DarkCard style={{ backgroundColor: '#1C1C1B' }}>
              <Eyebrow onDark>{t('sign.done.assured')}</Eyebrow>
              <Text style={styles.doneH}>{t('plan.upgrade.done.h1')}</Text>
              <Body style={{ color: color.onDark2, fontSize: 15 }}>{t('plan.upgrade.done.body')}</Body>
            </DarkCard>
          ) : null}
        </View>
      </Screen>
    );
  }

  const weeks = Math.round(q.handoverDays / 7);
  const phone = shown(user?.phone);

  const footer = !agreed ? (
    <Button label={t('sign.withCode')} disabled reason={t('sign.tick')} />
  ) : sent ? (
    <Button
      label={t('sign.cta', { studio: q.studioName })}
      busy={busy}
      disabled={code.length !== 6}
      reason={t('signin.needCode')}
      onPress={() => void sign()}
    />
  ) : (
    <Button label={t('sign.withCode')} busy={busy} onPress={() => void sendCode()} />
  );

  return (
    <ChooseFrame back={`/journey/choose/quote/${q.id}`} step={4} footer={footer}>
      <Title size={h1}>{t('sign.h1', { studio: q.studioName })}</Title>

      <View style={styles.card}>
        <InfoRow
          first
          icon={<LineIcon name="lock" />}
          title={t('sign.total')}
          line={t('sign.totalLine', {
            amount: inr(q.totalPaise),
            n: q.lineCount,
          })}
        />
        <InfoRow
          icon={<LineIcon name="receipt" />}
          title={t('sign.gst')}
          line={q.gstPaise > 0 ? t('sign.gstIn', { amount: inr(q.gstPaise) }) : t('sign.gstInvoice')}
        />
        <InfoRow icon={<LineIcon name="clock" />} title={t('sign.handover')} line={t('sign.handoverLine', { weeks })} />
        <InfoRow icon={<CameraIcon color={color.ink} size={18} />} title={t('sign.updates')} line={t('sign.updatesLine')} />
      </View>

      <View>
        <Heading style={{ fontSize: 20, marginBottom: 4 }}>{t('sign.pay')}</Heading>
        {q.stages.map((s, i) => (
          <View
            key={`${s.label}-${i}`}
            style={styles.stage}
            accessible
            accessibilityLabel={`${i + 1}. ${s.label}, ${inr(s.amountPaise)}${s.pct !== null ? `, ${s.pct}%` : ''}`}
          >
            <View style={[styles.num, i === 0 && styles.numFirst]}>
              <Text style={[styles.numText, i === 0 && { color: color.white }]}>{i + 1}</Text>
            </View>
            <Text style={styles.stageLabel}>{s.label}</Text>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.stageAmount}>{inr(s.amountPaise)}</Text>
              {s.pct !== null ? <Text style={styles.stagePct}>{s.pct}%</Text> : null}
            </View>
          </View>
        ))}
        <Text style={styles.direct}>{t('sign.direct')}</Text>
      </View>

      {q.terms ? (
        <View style={styles.terms}>
          <Pressable
            role="button"
            aria-expanded={showTerms}
            aria-label={t('sign.terms', { studio: q.studioName })}
            onPress={() => setShowTerms((v) => !v)}
            style={styles.termsHead}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.termsTitle}>{t('sign.terms', { studio: q.studioName })}</Text>
              <Text style={styles.termsSub}>{t('sign.termsSub')}</Text>
            </View>
            <View
              style={{
                transform: [{ rotate: showTerms ? '-90deg' : '90deg' }],
              }}
            >
              <LineIcon name="chevron" tint={color.ink3} />
            </View>
          </Pressable>
          {showTerms ? <Text style={styles.termsText}>{q.terms}</Text> : null}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Heading style={{ fontSize: 20 }}>{t('plan.choose')}</Heading>
        <PlanCards value={plan} onChange={setPlan} />
        {plan === 'assured' ? <Text style={styles.feeNote}>{t('plan.feeNote')}</Text> : null}
      </View>

      <Press
        onPress={() => setAgreed((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        accessibilityLabel={q.terms ? t('sign.agreeTerms') : t('sign.agree')}
        style={styles.tickRow}
      >
        <View style={[styles.box, agreed && styles.boxOn]}>
          {agreed ? <LineIcon name="tick" size={16} tint={color.white} stroke={2.6} /> : null}
        </View>
        <Text style={styles.tickText}>{q.terms ? t('sign.agreeTerms') : t('sign.agree')}</Text>
      </Press>

      {sent ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>{phone ? t('sign.codeTo', { phone }) : t('sign.codeToYou')}</Eyebrow>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            aria-label={phone ? t('sign.codeTo', { phone }) : t('sign.codeToYou')}
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

      {error ? (
        <View aria-live="polite">
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
    </ChooseFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.soft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDEDEA',
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numFirst: { backgroundColor: color.accent },
  numText: { fontFamily: font.sansSemi, fontSize: 13, color: color.ink },
  stageLabel: {
    flex: 1,
    fontFamily: font.sansSemi,
    fontSize: 15.5,
    lineHeight: 22,
    color: color.ink,
    paddingTop: 2,
  },
  stageAmount: {
    fontFamily: font.mono,
    fontSize: 15,
    color: color.ink,
    paddingTop: 3,
  },
  stagePct: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  direct: {
    marginTop: 10,
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 21,
    color: color.ink2,
  },
  terms: {
    backgroundColor: color.soft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
  },
  termsHead: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  termsTitle: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  termsSub: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  termsText: {
    fontFamily: font.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: color.ink,
    paddingBottom: 16,
  },
  feeNote: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 21,
    color: color.ink2,
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B9B7B1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.paper,
  },
  boxOn: { backgroundColor: color.ink, borderColor: color.ink },
  tickText: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.ink,
  },
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
  link: {
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: color.ink,
    textDecorationLine: 'underline',
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneH: {
    fontFamily: font.sansMedium,
    fontSize: 20,
    letterSpacing: -0.4,
    color: color.onDark,
  },
});
