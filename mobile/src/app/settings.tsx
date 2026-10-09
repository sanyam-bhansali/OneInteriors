import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { BackIcon } from '../components/icons';
import { Body, Button, Meta, Press, Screen, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { lockEnabled, setLock } from '../lib/lock';
import { color, font } from '../lib/theme';

/** Who is signed in, the Face ID / fingerprint lock, and signing out. */
export default function Settings() {
  const { state, signOut } = useAuth();
  const [lock, setLockState] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void lockEnabled().then(setLockState);
  }, []);

  return (
    <Screen
      header={
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
            <BackIcon color={color.ink} />
          </Press>
        </View>
      }
      footer={
        <Button
          label="Sign out"
          variant="ghost"
          onPress={() =>
            void signOut().then(() => {
              router.replace('/');
            })
          }
        />
      }
    >
      <Meta>Your account</Meta>
      <Title size={40}>Settings</Title>
      {state.status === 'signed-in' ? (
        <View style={styles.row}>
          <Text style={styles.label}>{state.user.name ?? 'Signed in'}</Text>
          <Text style={styles.value}>{state.user.phone ?? ''}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>Lock with Face ID or fingerprint</Text>
          <Text style={styles.value}>Asked when the app opens, and after five minutes away.</Text>
        </View>
        <Switch
          value={lock}
          trackColor={{ true: color.accent, false: color.line }}
          onValueChange={async (on) => {
            const ok = await setLock(on);
            if (ok) setLockState(on);
            else setNote('This phone has no Face ID or fingerprint set up, or it was cancelled.');
          }}
        />
      </View>
      {note ? <Body muted>{note}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  label: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  value: { fontFamily: font.mono, fontSize: 12.5, color: color.ink2 },
});
