import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';
import { GeioOrb } from '../../components/brand';
import { CameraIcon, HomeIcon, ListIcon, PersonIcon } from '../../components/icons';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { registerForPush } from '../../lib/push';
import { color, font } from '../../lib/theme';

/**
 * The signed-in app's tab bar (v79 design): Home · Project · GEIO · Site · Me.
 * Snags and decisions open from Project, the Locker and settings from Me,
 * and GEIO is the orb in the middle (DESIGN-SPEC.md, Bottom bar: ink, 13 px
 * labels, the chosen tab in warm terracotta). Asks for notifications once,
 * on arrival.
 */
export default function TabsLayout() {
  const { state } = useAuth();
  const t = useT();
  useEffect(() => {
    if (state.status === 'signed-in') void registerForPush();
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
      <Tabs.Screen name="site" options={{ tabBarLabel: label(t('tab.site')), tabBarIcon: ({ color: c }) => <CameraIcon color={c} /> }} />
      <Tabs.Screen name="me" options={{ tabBarLabel: label(t('tab.me')), tabBarIcon: ({ color: c }) => <PersonIcon color={c} /> }} />
    </Tabs>
  );
}
