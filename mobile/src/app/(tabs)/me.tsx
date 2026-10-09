import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowIcon, BellIcon, FolderIcon } from '../../components/icons';
import { Body, Button, Press, Screen, Title } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { apiBase } from '../../lib/config';
import { lockEnabled, setLock } from '../../lib/lock';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';

/**
 * Me (v79 design): who is signed in, the Locker, notifications, the Face ID /
 * fingerprint lock, Meera and GEIO, privacy, and signing out. Settings lives
 * here now. Only real rows: Coins, Family, Dream board, Refer, the language
 * picker and a support number arrive with those features.
 */
export default function Me() {
  const { state, signOut } = useAuth();
  const { state: project } = useProject();
  const [lock, setLockState] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void lockEnabled().then(setLockState);
  }, []);

  const user = state.status === 'signed-in' ? state.user : null;
  const web = (path: string, title: string) => router.push({ pathname: '/web', params: { path, title } });

  return (
    <Screen
      footer={
        <Button
          label="Log out"
          variant="ghost"
          onPress={() =>
            void signOut().then(() => {
              router.replace('/');
            })
          }
        />
      }
    >
      <Title size={40}>Me</Title>
      {user ? (
        <View style={styles.who}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name ?? 'Signed in'}</Text>
            {user.phone ? <Text style={styles.mono}>{user.phone}</Text> : null}
            {project.status === 'ready' ? <Text style={styles.sub}>With {project.project.studio}</Text> : null}
          </View>
        </View>
      ) : null}

      <View>
        <Row title="Home locker" sub="Agreement, drawings, receipts, warranties" icon={<FolderIcon color={color.ink2} />} onPress={() => router.push('/locker')} />
        <Row title="Notifications" sub="Site updates, decisions and payments" icon={<BellIcon color={color.ink2} />} onPress={() => router.push('/notifications')} />
        <Row title="Home Coins" sub="Earn as your home comes together" onPress={() => web('/app/coins', 'Home Coins')} />
        <Row title="Family" sub="They see every update and vote on decisions" onPress={() => web('/app/family', 'Family')} />
        <Row title="Dream board" sub="Photos you love, shared with your studio" onPress={() => web('/app/dream', 'Dream board')} />
        <Row title="Refer and earn" sub="Give 5,000, get 5,000" onPress={() => web('/app/refer', 'Refer')} />
        <Row title="Ask Meera" sub="Your One Interiors expert. She earns nothing from any studio." onPress={() => web('/app/geio?ask=expert', 'Meera')} />
        <Row title="Privacy and your data" sub="What we keep, and how to have it removed" onPress={() => void WebBrowser.openBrowserAsync(`${apiBase()}/privacy`)} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Lock with Face ID or fingerprint</Text>
          <Text style={styles.sub}>Asked when the app opens, and after five minutes away.</Text>
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

function Row({ title, sub, icon, onPress }: { title: string; sub: string; icon?: React.ReactNode; onPress: () => void }) {
  return (
    <Press onPress={onPress} haptic={false} style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {icon}
      <ArrowIcon color={color.ink2} />
    </Press>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.accentWarm, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.sansSemi, fontSize: 22, color: color.white },
  name: { fontFamily: font.sansSemi, fontSize: 22, letterSpacing: -0.6, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 14, color: color.ink2, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  sub: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
});
