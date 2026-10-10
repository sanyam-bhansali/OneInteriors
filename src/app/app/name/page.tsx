'use client';

/** 2 Your name (the owner's v1 screens). Kept on the brief; nothing else asked yet. */

import { useRouter } from 'next/navigation';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';
import { useT } from '@/components/app/i18n';

export default function AppName() {
  const router = useRouter();
  const t = useT();
  const [brief, update] = useBrief();
  const name = brief?.contactName ?? '';

  return (
    <Frame>
      <Head back="/app" meta={t('name.meta')} />
      <Body>
        <h1 className="oa-title">{t('name.h1')}</h1>
        <label className="oa-label" htmlFor="oa-name">
          {t('name.label')}
        </label>
        <input
          id="oa-name"
          className="oa-input"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={40}
          placeholder="Priya"
          value={name}
          onChange={(e) => update({ contactName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) router.push('/app/q/1');
          }}
        />
        <p className="oa-note">{t('name.note')}</p>
      </Body>
      <Foot>
        <Cta href="/app/q/1" disabled={!name.trim()}>
          {t('common.continue')}
        </Cta>
      </Foot>
    </Frame>
  );
}
