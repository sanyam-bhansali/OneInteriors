import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, type ColorValue } from 'react-native';
import { GeioOrb } from '../../components/brand';
import { ChatIcon, HomeIcon, ListIcon, PersonIcon } from '../../components/icons';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { registerForPush } from '../../lib/push';
import { api } from '../../lib/api';
import { color, font } from '../../lib/theme';

/**
 * The signed-in app's tab bar (the owner's v1 screens, 1 Nov 2026): Home ·
 * Project · GEIO · Chats · Me. Site, snags and decisions open from Project, the Locker and settings from Me,
 * and GEIO is the orb in the middle (DESIGN-SPEC.md, Bottom bar: ink, 13 px
 * labels, the chosen tab in warm terracotta). Asks for notifications once,
 * on arrival.
 */
export default function TabsLayout() {
  const { state } = useAuth();
  const t = useT();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (state.status === 'signed-in') void registerForPush();
  }, [state.status]);
  /* Unread chat messages on the Chats tab, checked every half minute. */
  useEffect(() => {
    if (state.status !== 'signed-in') return;
    const load = () => void api.chats().then((r) => r.ok && setUnread(r.data.unread));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [state.status]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-out') return <Redirect href="/" />;

  const label = (text: string) =>
    function Label({ color: c, focused }: { color: ColorValue; focused: boolean }) {
      return <Text style={{ fontFamily: focused ? font.sansSemi : font.sansMedium, fontSize: 13, color: c, marginTop: 2 }}>{text}</Text>;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accentWarm,
        tabBarInactiveTintColor: color.tabIdle,
        tabBarStyle: { backgroundColor: color.ink, borderTopWidth: 0, height: 88, paddingTop: 8 },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarLabel: label(t('tab.home')), tabBarIcon: ({ color: c }) => <HomeIcon color={c} /> }} />
      <Tabs.Screen name="project" options={{ tabBarLabel: label(t('tab.project')), tabBarIcon: ({ color: c }) => <ListIcon color={c} /> }} />
      <Tabs.Screen name="geio" options={{ tabBarLabel: label(t('tab.geio')), tabBarAccessibilityLabel: t('me.geio'), tabBarIcon: () => <GeioOrb size={52} ring style={{ marginTop: -30 }} /> }} />
      <Tabs.Screen
        name="chats"
        options={{ tabBarLabel: label(t('tab.chats')), tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: color.accent }, tabBarIcon: ({ color: c }) => <ChatIcon color={c} /> }}
      />
      <Tabs.Screen name="me" options={{ tabBarLabel: label(t('tab.me')), tabBarIcon: ({ color: c }) => <PersonIcon color={c} /> }} />
    </Tabs>
  );
}
