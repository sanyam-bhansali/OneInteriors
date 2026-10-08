'use client';

/** 2 Your name (the owner's v1 screens). Kept on the brief; nothing else asked yet. */

import { useRouter } from 'next/navigation';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';

export default function AppName() {
  const router = useRouter();
  const [brief, update] = useBrief();
  const name = brief?.contactName ?? '';

  return (
    <Frame>
      <Head back="/app" meta="Before we start" />
      <Body>
        <h1 className="oa-title">First, what should we call you?</h1>
        <label className="oa-label" htmlFor="oa-name">
          Your first name
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
        <p className="oa-note">No phone number or email yet. We only ask for those when your quotes are ready.</p>
      </Body>
      <Foot>
        <Cta href="/app/q/1" disabled={!name.trim()}>
          Continue
        </Cta>
      </Foot>
    </Frame>
  );
}
