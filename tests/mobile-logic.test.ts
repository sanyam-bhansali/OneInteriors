import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clock, mergeFresh, oneThingTarget, spacedMobile } from '../mobile/src/lib/chat-merge';
import { routeFor } from '../mobile/src/lib/route-for';

/**
 * The phone app's own logic (customer app plan, Phase 3: tests for sign-in,
 * the project screen and approvals), run here: these files import no Expo
 * modules, which CI does not install.
 */

describe('phone sign-in', () => {
  it('writes the number as the design does, whatever was typed', () => {
    expect(spacedMobile('9822041736')).toBe('98220 41736');
    expect(spacedMobile('+91 98220-41736')).toBe('98220 41736');
    expect(spacedMobile('09822041736')).toBe('98220 41736');
    expect(spacedMobile('982')).toBe('982');
  });

  it('opens on sign-in, not the quiz, when only projects are open', () => {
    const index = readFileSync('mobile/src/app/index.tsx', 'utf8');
    expect(index).toMatch(/signed-out' && projectsOnly\(\)\) return <Redirect href="\/sign-in"/);
    const signIn = readFileSync('mobile/src/app/sign-in.tsx', 'utf8');
    expect(signIn).toMatch(/projectsOnly\(\) \? <PasswordSignIn \/> : <CodeSignIn \/>/);
  });

  it('builds the store app for app.oneinteriors.in with only projects open', () => {
    const eas = JSON.parse(readFileSync('mobile/eas.json', 'utf8')) as { build: Record<string, { env?: Record<string, string> }> };
    for (const profile of ['preview', 'production']) {
      expect(eas.build[profile]!.env).toEqual({ EXPO_PUBLIC_API_URL: 'https://app.oneinteriors.in', EXPO_PUBLIC_PROJECTS_ONLY: '1' });
    }
  });
});

describe('the home screen’s one thing', () => {
  const decisions = [
    { id: 'old', state: 'chosen' },
    { id: 'd1', state: 'due-soon' },
  ];

  it('opens the decision waiting, the snags, or the project', () => {
    expect(oneThingTarget('decide', decisions)).toEqual({ to: 'decision', id: 'd1' });
    expect(oneThingTarget('decide', [])).toEqual({ to: 'project' });
    expect(oneThingTarget('confirm_snag', decisions)).toEqual({ to: 'snags' });
    expect(oneThingTarget('sign_off', decisions)).toEqual({ to: 'snags' });
    expect(oneThingTarget('answer_drawing', decisions)).toEqual({ to: 'project' });
    expect(oneThingTarget('sign_design_final', decisions)).toEqual({ to: 'project' });
  });
});

describe('a tapped notification', () => {
  it('opens the screen it is about', () => {
    expect(routeFor('/app/project')).toBe('/project');
    expect(routeFor('/app/decision?id=d1')).toEqual({ pathname: '/decision/[id]', params: { id: 'd1' } });
    expect(routeFor('/app/chats/designer?project=p1')).toEqual({ pathname: '/chat/[projectId]/[kind]', params: { projectId: 'p1', kind: 'DESIGNER' } });
    expect(routeFor('/app/chats/team')).toBe('/chats');
    expect(routeFor('/app/whatever')).toBe('/home');
    expect(routeFor('/studio/chats')).toBeNull();
    expect(routeFor(undefined)).toBeNull();
  });
});

describe('chat on the phone', () => {
  const m = (id: string, body: string, o: { mine?: boolean; pending?: boolean } = {}) => ({ id, body, kind: 'TEXT', mine: o.mine ?? false, pending: o.pending });

  it('adds new messages once, and replaces my stand-in with the saved one', () => {
    const screen = [m('a', 'hi'), m('pending-1', 'see you', { mine: true, pending: true })];
    const server = [m('a', 'hi'), m('b', 'see you', { mine: true }), m('c', 'ok')];
    expect(mergeFresh(screen, server).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a stand-in the server has not answered yet', () => {
    const screen = [m('pending-1', 'sending…', { mine: true, pending: true })];
    expect(mergeFresh(screen, [m('x', 'other')]).map((x) => x.id)).toEqual(['pending-1', 'x']);
  });

  it('times voice notes like the website', () => {
    expect(clock(42_000)).toBe('0:42');
    expect(clock(65_400)).toBe('1:05');
  });
});

describe('approvals on the phone', () => {
  it('signs in the app with the hash of what it showed', () => {
    const screen = readFileSync('mobile/src/app/signoff/[id].tsx', 'utf8');
    expect(screen).toMatch(/api\.signSignoff\(d\.id, \{ agreed, name, hash: d\.hash \}\)/);
    const card = readFileSync('mobile/src/components/project/extras.tsx', 'utf8');
    expect(card).toMatch(/pathname: '\/signoff\/\[id\]'/);
    expect(card).not.toMatch(/\/app\/signoff\//);
  });

  it('answers visits and asks for other options through the API', () => {
    const api = readFileSync('mobile/src/lib/api.ts', 'utf8');
    expect(api).toMatch(/'POST', `\/visits\/\$\{encodeURIComponent\(visitId\)\}`/);
    expect(api).toMatch(/'POST', `\/decisions\/\$\{encodeURIComponent\(decisionId\)\}\/redo`/);
  });
});
