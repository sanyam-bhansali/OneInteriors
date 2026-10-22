'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/modules/studio/profile';
import type { HomePrefs } from '@/modules/studio/home-prefs';
import { LANG_COOKIE, LANGS, asLang, type Lang } from '@/modules/i18n/site';
import { STUDIO_LANG_LABEL } from '@/modules/i18n/studio';
import { setLang } from '@/components/app/i18n';
import { myProfileAction, saveHomePrefsAction } from '../profile-actions';
import { initials } from './brand';
import { AppIcon, LineIcon, SealIcon } from './icons';
import { THEME_KEY } from './theme-script';

/**
 * The profile icon at the top right (owner, 12 Oct 2026): who is signed in,
 * their role and what it lets them do, their own settings (theme, language,
 * their home's tiles, order and landing page), and Sign out.
 *
 * The details are read when the menu opens, for the signed-in member only.
 * Home settings change only how their own home looks; what they may open is
 * still decided on the server.
 */
export function ProfileMenu({ name, signOut, size = 42 }: { name: string | null; signOut: () => Promise<void>; size?: number }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        className="av avbtn"
        style={{ width: size, height: size }}
        aria-label="Your profile and settings"
        aria-expanded={open}
        title={name ?? 'Your profile'}
        onClick={() => setOpen(true)}
      >
        {initials(name)}
      </button>
      {open ? <ProfileSheet signOut={signOut} onClose={close} /> : null}
    </>
  );
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function currentLang(): Lang {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${LANG_COOKIE}=`));
  return asLang(hit ? hit.slice(LANG_COOKIE.length + 1) : 'en');
}

function ProfileSheet({ signOut, onClose }: { signOut: () => Promise<void>; onClose: () => void }) {
  const router = useRouter();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<HomePrefs | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLangState] = useState<Lang>('en');
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    setTheme(currentTheme());
    setLangState(currentLang());
    let live = true;
    myProfileAction()
      .then((r) => {
        if (!live) return;
        setP(r);
        setPrefs(r?.prefs ?? null);
      })
      .catch(() => live && setP(null));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const pickTheme = (t: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event('oi-theme'));
    setTheme(t);
  };

  const pickLang = (l: Lang) => {
    setLang(l);
    setLangState(l);
    router.refresh();
  };

  const edit = (next: HomePrefs) => {
    setPrefs(next);
    setSaved(null);
  };

  const order = p && prefs ? orderOf(p, prefs) : [];
  const move = (key: string, by: -1 | 1) => {
    if (!prefs) return;
    const keys = order.map((a) => a.key);
    const i = keys.indexOf(key as (typeof keys)[number]);
    const j = i + by;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    edit({ ...prefs, order: keys });
  };
  const toggle = (key: (typeof order)[number]['key']) => {
    if (!prefs) return;
    const hidden = prefs.hidden.includes(key) ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key];
    edit({ ...prefs, hidden });
  };

  const save = () => {
    if (!prefs) return;
    start(async () => {
      const r = await saveHomePrefsAction(prefs);
      if (r.ok) {
        setPrefs(r.prefs);
        setSaved('Saved. Your home now shows it.');
        router.refresh();
      } else setSaved(r.error);
    });
  };

  return (
    <div className="overlay pfover" role="dialog" aria-modal="true" aria-label="Your profile">
      <button type="button" className="scrim" aria-label="Close your profile" onClick={onClose} />
      <div className="palette pfsheet">
        {p === undefined ? (
          <div className="pfhead">
            <span className="muted">Loading your profile…</span>
          </div>
        ) : p === null ? (
          <div className="pfhead">
            <span className="muted">Your profile could not be read. Sign out and back in.</span>
          </div>
        ) : (
          <>
            <div className="pfhead">
              <span className="av" style={{ width: 56, height: 56, fontSize: 20 }}>
                {initials(p.name)}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 18 }}>{p.name ?? 'You'}</b>
                <span className="hstack" style={{ gap: 6 }}>
                  <span className="chip ink">{p.roleName}</span>
                  <span className="muted sm">{p.studio}</span>
                  {p.verified ? (
                    <span className="ver" title="Checked by One Interiors">
                      <SealIcon />
                      One Verified
                    </span>
                  ) : null}
                </span>
              </span>
              <button type="button" className="btn ghost sm" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="pfbody">
              <section className="pfsec" aria-labelledby="pf-you">
                <h3 id="pf-you">About you</h3>
                <dl className="pfkv">
                  <dt>Mobile</dt>
                  <dd className="mono">{p.phone ?? 'Not added'}</dd>
                  <dt>Email</dt>
                  <dd>{p.email ?? 'Not added'}</dd>
                  <dt>Role</dt>
                  <dd>{p.roleName}</dd>
                  <dt>Studio</dt>
                  <dd>{p.studio}</dd>
                  <dt>Studio plan</dt>
                  <dd>{p.planName}</dd>
                  <dt>Language</dt>
                  <dd>{p.language}</dd>
                  <dt>On the team since</dt>
                  <dd>{p.memberSince}</dd>
                  {p.lastActive ? (
                    <>
                      <dt>Last active</dt>
                      <dd>{p.lastActive}</dd>
                    </>
                  ) : null}
                  {p.sites ? (
                    <>
                      <dt>Your sites</dt>
                      <dd>{p.sites.length === 0 ? 'None picked yet. Ask your studio owner.' : p.sites.join(', ')}</dd>
                    </>
                  ) : null}
                </dl>
                <p className="muted sm" style={{ margin: 0 }}>
                  {p.role === 'OWNER'
                    ? 'Names, numbers and roles for your team are changed in Team.'
                    : 'Your name, number and role are set by your studio owner in Team.'}
                </p>
              </section>

              <section className="pfsec" aria-labelledby="pf-role">
                <h3 id="pf-role">What your role does</h3>
                <p style={{ margin: 0 }}>{p.roleLine}</p>
                {p.can.length > 0 ? (
                  <div className="hstack" style={{ gap: 6 }}>
                    {p.can.map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="pfsec" aria-labelledby="pf-look">
                <h3 id="pf-look">Look and language</h3>
                <div className="pfrow">
                  <span>Theme</span>
                  <div className="seg" role="group" aria-label="Theme">
                    <button type="button" aria-pressed={theme === 'light'} onClick={() => pickTheme('light')}>
                      Light
                    </button>
                    <button type="button" aria-pressed={theme === 'dark'} onClick={() => pickTheme('dark')}>
                      Dark
                    </button>
                  </div>
                </div>
                <div className="pfrow">
                  <span>Language</span>
                  <div className="seg" role="group" aria-label="Language">
                    {LANGS.map(({ id }) => (
                      <button key={id} type="button" aria-pressed={lang === id} aria-label={STUDIO_LANG_LABEL[id].full} onClick={() => pickLang(id)}>
                        {STUDIO_LANG_LABEL[id].short}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {prefs && p.apps.length > 0 ? (
                <section className="pfsec" aria-labelledby="pf-home">
                  <h3 id="pf-home">Your home</h3>
                  <p className="muted sm" style={{ margin: 0 }}>
                    Choose which apps show on your home and in what order. Hidden apps stay in the apps menu and search.
                  </p>
                  <ul className="pfapps">
                    {order.map((a, i) => {
                      const shown = !prefs.hidden.includes(a.key);
                      return (
                        <li key={a.key} className={shown ? '' : 'off'}>
                          <span className="appico" style={{ width: 32, height: 32, borderRadius: 9, background: a.bg, color: a.fg }}>
                            <AppIcon name={a.icon} size={16} />
                          </span>
                          <span style={{ flex: 1 }}>{a.name}</span>
                          <button type="button" className="iconbtn pfmini" aria-label={`Move ${a.name} up`} disabled={i === 0} onClick={() => move(a.key, -1)}>
                            ↑
                          </button>
                          <button type="button" className="iconbtn pfmini" aria-label={`Move ${a.name} down`} disabled={i === order.length - 1} onClick={() => move(a.key, 1)}>
                            ↓
                          </button>
                          <label className="pftoggle">
                            <input type="checkbox" checked={shown} onChange={() => toggle(a.key)} />
                            <span>{shown ? 'Shown' : 'Hidden'}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="pfrow">
                    <span>Show &ldquo;Right now&rdquo; under the greeting</span>
                    <label className="pftoggle">
                      <input type="checkbox" checked={prefs.strip} onChange={(e) => edit({ ...prefs, strip: e.target.checked })} />
                      <span>{prefs.strip ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  <div className="pfrow">
                    <label htmlFor="pf-landing">After signing in, open</label>
                    <select id="pf-landing" className="fld" style={{ maxWidth: 220 }} value={prefs.landing} onChange={(e) => edit({ ...prefs, landing: e.target.value as HomePrefs['landing'] })}>
                      <option value="home">My home</option>
                      {p.apps.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <span className="sm muted" role="status">
                      {saved}
                    </span>
                    <span className="hstack">
                      <button type="button" className="btn ghost sm" onClick={() => edit({ order: [], hidden: [], strip: true, landing: 'home' })}>
                        Reset
                      </button>
                      <button type="button" className="btn pri sm" disabled={saving} onClick={save}>
                        {saving ? 'Saving…' : 'Save my home'}
                      </button>
                    </span>
                  </div>
                </section>
              ) : null}
            </div>
          </>
        )}
        <div className="pffoot">
          <form action={signOut}>
            <button type="submit" className="btn sec">
              <LineIcon name="arrow" size={16} />
              Sign out
            </button>
          </form>
          <span className="muted sm">Signs you out on this device.</span>
        </div>
      </div>
    </div>
  );
}

/** The member's apps in the order the editor shows: their saved order, then the rest. */
function orderOf(p: Profile, prefs: HomePrefs): Profile['apps'] {
  const out: Profile['apps'] = [];
  for (const k of prefs.order) {
    const a = p.apps.find((x) => x.key === k);
    if (a && !out.includes(a)) out.push(a);
  }
  for (const a of p.apps) if (!out.includes(a)) out.push(a);
  return out;
}
