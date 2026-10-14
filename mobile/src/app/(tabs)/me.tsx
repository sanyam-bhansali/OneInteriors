import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BellLineIcon, LockerIcon, LogoutIcon, MailIcon, QuestionIcon, ShieldIcon, TrashIcon } from '../../components/me/icons';
import { Row, RowGroup, SwitchRow } from '../../components/me/parts';
import { Body, Rise, Screen, Stagger } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LANGS, useLang, useT } from '../../lib/i18n';
import { lockEnabled, setLock } from '../../lib/lock';
import { usePlan } from '../../lib/plan';
import { useProfile } from '../../lib/profile';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';

/**
 * Me (Me.dc.html, screen 27): who is signed in, their home, the Locker and
 * notifications, the language, the daily-update switch, help, privacy,
 * account deletion and signing out. Coins, Family, Dream board and Refer
 * are v1.1 and not here yet. Customers get no WhatsApp notices, so there is
 * no WhatsApp switch or row.
 */

const SUPPORT_EMAIL = 'hello@oneinteriors.in';
const PRIVACY_URL = 'https://oneinteriors.in/privacy';
/** Kept on the phone only: there is no notification-preferences endpoint yet. */
const DAILY_KEY = 'oi.pref.dailyUpdate';

/** "+919822041736" → "+91 98220 41736". */
function phoneLabel(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ''));
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export default function Me() {
  const t = useT();
  const plan = usePlan();
  const { lang, setLang } = useLang();
  const { state, signOut } = useAuth();
  const { profile, refresh } = useProfile();
  const { state: project } = useProject();
  const [daily, setDaily] = useState(true);
  const [lock, setLockState] = useState(false);
  const [lockNote, setLockNote] = useState(false);

  // The unread count stays live: read again whenever Me comes into view.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    void lockEnabled().then(setLockState);
    void AsyncStorage.getItem(DAILY_KEY)
      .then((v) => {
        if (v === '0') setDaily(false);
      })
      .catch(() => {});
  }, []);

  const user = state.status === 'signed-in' ? state.user : null;
  const home = profile.home;
  const studio = project.status === 'ready' ? project.project.studio : null;
  const homeLine = home
    ? [home.bhk, home.carpetSqft ? t('meApp.sqft', { n: home.carpetSqft.toLocaleString('en-IN') }) : null, home.tier ? home.tier[0].toUpperCase() + home.tier.slice(1) : null, studio]
        .filter(Boolean)
        .join(' · ')
    : '';
  const version = Constants.expoConfig?.version ?? '1.0';

  return (
    <Screen>
      <View style={styles.body}>
        <Rise style={styles.who}>
          <View style={styles.avatar} aria-hidden>
            <Text style={styles.avatarText}>{(user?.name ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text role="heading" style={styles.name}>
              {user?.name ?? t('me.h1')}
            </Text>
            {user?.phone ? <Text style={styles.phone}>{phoneLabel(user.phone)}</Text> : null}
          </View>
        </Rise>

        {home?.label ? (
          <Stagger i={0} start={120}>
            <View style={styles.homeCard} accessible accessibilityLabel={`${home.label}. ${homeLine}`}>
              <Text style={styles.homeTitle}>{home.label}</Text>
              {homeLine ? <Text style={styles.homeSub}>{homeLine}</Text> : null}
            </View>
          </Stagger>
        ) : null}

        <Stagger i={1} start={120}>
          <RowGroup>
            {plan.plan ? (
              <Row
                title={`${t('plan.current')}: ${t(plan.assured ? 'plan.assured' : 'plan.basic')}`}
                sub={
                  plan.assured
                    ? plan.expertCalls
                      ? t('plan.calls', { used: plan.expertCalls.used, total: plan.expertCalls.total })
                      : t('plan.assured.line')
                    : plan.requested
                      ? t('plan.requested')
                      : t('plan.see')
                }
                icon={<ShieldIcon color={plan.assured ? color.accent : color.ink} />}
                onPress={() => router.push('/plan')}
              />
            ) : null}
            <Row title={t('me.locker')} sub={t('me.locker.sub')} icon={<LockerIcon color={color.ink} />} onPress={() => router.push('/locker')} />
            <Row
              title={t('me.notifications')}
              sub={profile.unread ? t('me.unread', { n: profile.unread }) : t('meApp.unread.none')}
              icon={<BellLineIcon color={color.ink} />}
              onPress={() => router.push('/notifications')}
            />
          </RowGroup>
        </Stagger>

        <Stagger i={2} start={120} style={{ gap: 10 }}>
          <Text role="heading" style={styles.h2}>
            {t('lang.label')}
          </Text>
          <View role="radiogroup" aria-label={t('meApp.lang.group')} style={styles.langTrack}>
            {LANGS.map((l) => {
              const on = l.id === lang;
              return (
                <Pressable
                  key={l.id}
                  role="radio"
                  aria-checked={on}
                  aria-label={l.label}
                  onPress={() => {
                    if (on) return;
                    void Haptics.selectionAsync();
                    setLang(l.id);
                    // Tell the server too, so notices and GEIO follow. An older server may refuse; the phone still switches.
                    void api.setLocale(l.id);
                  }}
                  style={[styles.lang, on && { backgroundColor: color.ink }]}
                >
                  <Text style={[styles.langText, on && { color: color.onDark }]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sub} aria-live="polite">
            {t('meApp.lang.note')}
          </Text>
        </Stagger>

        <Stagger i={3} start={120}>
          <View style={styles.switches}>
            <SwitchRow
              title={t('meApp.daily')}
              sub={t('meApp.daily.sub')}
              on={daily}
              onChange={(on) => {
                setDaily(on);
                void AsyncStorage.setItem(DAILY_KEY, on ? '1' : '0').catch(() => {});
              }}
            />
            <View style={styles.divider} />
            <SwitchRow
              title={t('meApp.lock')}
              sub={t('meApp.lock.sub')}
              on={lock}
              onChange={async (on) => {
                const ok = await setLock(on);
                setLockNote(!ok);
                if (ok) setLockState(on);
              }}
            />
            {lockNote ? <Body muted style={{ fontSize: 14, paddingBottom: 8 }}>{t('meApp.lock.fail')}</Body> : null}
          </View>
        </Stagger>

        <Stagger i={4} start={120}>
          <RowGroup>
            <Row
              title={t('meApp.email')}
              sub={SUPPORT_EMAIL}
              icon={<MailIcon color={color.ink} />}
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
            />
            {plan.plan !== 'basic' ? <Row title={t('me.geio')} icon={<QuestionIcon color={color.ink} />} onPress={() => router.push('/geio')} /> : null}
          </RowGroup>
        </Stagger>

        <Stagger i={5} start={120}>
          <RowGroup>
            <Row title={t('me.privacy')} icon={<ShieldIcon color={color.ink} />} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
            <Row title={t('meApp.delete')} tone="danger" icon={<TrashIcon color={color.accentInk} />} onPress={() => router.push('/delete-account')} />
            <Row
              title={t('me.logout')}
              tone="danger"
              icon={<LogoutIcon color={color.accentInk} />}
              onPress={() =>
                void signOut().then(() => {
                  router.replace('/');
                })
              }
            />
          </RowGroup>
        </Stagger>

        <Text style={styles.version}>{t('meApp.version', { v: version })}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingTop: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.sansMedium, fontSize: 26, color: color.white },
  name: { fontFamily: font.sansMedium, fontSize: 30, lineHeight: 32, letterSpacing: 30 * -0.04, color: color.ink },
  phone: { fontFamily: font.sans, fontSize: 14.5, color: color.ink2 },
  homeCard: {
    backgroundColor: color.ink,
    borderRadius: 18,
    padding: 16,
    gap: 3,
    shadowColor: color.ink,
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
  },
  homeTitle: { fontFamily: font.sansSemi, fontSize: 17, color: color.onDark },
  homeSub: { fontFamily: font.sans, fontSize: 14, color: color.onDark2 },
  h2: { fontFamily: font.sansSemi, fontSize: 18, letterSpacing: 18 * -0.02, color: color.ink },
  langTrack: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: color.soft2 },
  lang: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  langText: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink2 },
  sub: { fontFamily: font.sans, fontSize: 14, color: color.ink2 },
  switches: { backgroundColor: color.soft, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 2 },
  divider: { height: 1, backgroundColor: '#EDEDEA' },
  version: { fontFamily: font.sans, fontSize: 13, color: color.ink3, textAlign: 'center' },
});
