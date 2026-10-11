import { router } from 'expo-router';
import { useState } from 'react';
import { PlanCards } from '../components/plan/PlanCards';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../components/ui';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePlan } from '../lib/plan';
import { useProfile } from '../lib/profile';
import { useProject } from '../lib/project';

/**
 * Upgrade to Assured, from Me or the locked GEIO tab. Until the fee is set
 * (owner, 11 Oct 2026) this registers interest: the project stays on Basic,
 * our team is told, calls, confirms the fee and switches it. Nothing is
 * charged in the app.
 */
export default function PlanScreen() {
  const t = useT();
  const { assured, requested } = usePlan();
  const { refresh } = useProfile();
  const { refresh: refreshProject } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    const res = await api.requestAssured();
    setBusy(false);
    if (!res.ok) return setError(t('plan.err'));
    setSent(true);
    await Promise.all([refresh(), refreshProject()]);
  }

  const done = sent || requested || assured;
  return (
    <Screen
      back
      footer={
        done ? (
          <Button label={t('kit.back')} variant="ghost" arrow={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
        ) : (
          <Button label={t('plan.upgrade.cta')} onPress={() => void ask()} busy={busy} />
        )
      }
    >
      <Eyebrow>{t('plan.assured')}</Eyebrow>
      <Title size={36}>{done && !assured ? t('plan.upgrade.done.h1') : t('plan.upgrade.h1')}</Title>
      {done && !assured ? <Body muted>{t('plan.upgrade.done.body')}</Body> : null}
      <PlanCards value="assured" />
      {!done ? <Body muted style={{ fontSize: 14 }}>{t('plan.feeNote')}</Body> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
