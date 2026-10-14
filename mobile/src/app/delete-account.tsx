import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TickIcon } from '../components/me/icons';
import { Body, Button, Card, ErrorText, Eyebrow, Meta, Press, Rise, Screen, Stagger, Title } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useHeadline, useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * Delete my account (Me → Delete my account; an App Store and Play Store
 * requirement). Says plainly what goes and what the law makes us keep, asks
 * for a tick, then deletes. What the server does is in the website's
 * src/modules/auth/erase.ts.
 */
export default function DeleteAccount() {
  const t = useT();
  const size = useHeadline(40);
  const { signOut } = useAuth();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!sure || busy) return;
    setBusy(true);
    setError(null);
    const res = await api.deleteAccount();
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // The server has already ended every session; this clears the phone.
    try {
      await signOut();
    } catch {
      /* the account is gone either way */
    }
    router.replace('/');
  };

  const gone = ['meApp.del.gone1', 'meApp.del.gone2', 'meApp.del.gone3', 'meApp.del.gone4'] as const;

  return (
    <Screen back>
      <View style={styles.body}>
        <Rise style={{ gap: 8 }}>
          <Eyebrow>{t('me.privacy')}</Eyebrow>
          <Title size={size}>{t('meApp.delete')}</Title>
        </Rise>
        <Rise delay={120}>
          <Body>{t('meApp.del.lead')}</Body>
        </Rise>

        <Stagger i={0} start={180}>
          <Card style={{ gap: 8 }}>
            <Text role="heading" style={styles.h2}>
              {t('meApp.del.gone')}
            </Text>
            {gone.map((k) => (
              <View key={k} style={styles.bullet}>
                <View style={styles.dot} />
                <Text style={styles.item}>{t(k)}</Text>
              </View>
            ))}
          </Card>
        </Stagger>

        <Stagger i={1} start={180}>
          <Card style={{ gap: 8 }}>
            <Text role="heading" style={styles.h2}>
              {t('meApp.del.kept')}
            </Text>
            <Text style={styles.item}>{t('meApp.del.kept.body')}</Text>
          </Card>
        </Stagger>

        <Stagger i={2} start={180}>
          <Pressable
            role="checkbox"
            aria-checked={sure}
            aria-label={t('meApp.del.tick')}
            onPress={() => {
              void Haptics.selectionAsync();
              setSure((v) => !v);
            }}
            style={styles.tickRow}
          >
            <View style={[styles.box, sure && { backgroundColor: color.ink, borderColor: color.ink }]}>{sure ? <TickIcon color={color.white} /> : null}</View>
            <Text style={styles.tickText}>{t('meApp.del.tick')}</Text>
          </Pressable>
        </Stagger>

        <View style={{ gap: 8 }}>
          <Press
            onPress={() => void remove()}
            disabled={!sure || busy}
            accessibilityLabel={sure ? t('meApp.delete') : `${t('meApp.delete')}. ${t('meApp.del.reason')}`}
            style={[styles.danger, !sure && { backgroundColor: color.soft2 }]}
          >
            {busy ? <ActivityIndicator color={color.white} /> : <Text style={[styles.dangerText, !sure && { color: color.ink3 }]}>{t('meApp.delete')}</Text>}
          </Press>
          {!sure ? <Meta style={{ textAlign: 'center' }}>{t('meApp.del.reason')}</Meta> : null}
          {error ? (
            <View accessibilityLiveRegion="polite" aria-live="polite">
              <ErrorText>{error}</ErrorText>
            </View>
          ) : null}
        </View>

        <Button label={t('meApp.del.keep')} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingTop: 2 },
  h2: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.accent, marginTop: 9 },
  item: { flex: 1, fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.ink2 },
  tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: color.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickText: { flex: 1, fontFamily: font.sansMedium, fontSize: 15.5, lineHeight: 22, color: color.ink },
  danger: { minHeight: 56, borderRadius: 999, backgroundColor: color.accentInk, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  dangerText: { fontFamily: font.sansMedium, fontSize: 16, color: color.white },
});
