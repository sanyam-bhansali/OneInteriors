import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';
import { CameraIcon, CheckIcon, FolderIcon, HomeIcon, ListIcon } from '../../components/icons';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { registerForPush } from '../../lib/push';
import { color, font } from '../../lib/theme';

/** The signed-in app: the design's dark tab bar. Asks for notifications once, on arrival. */
export default function TabsLayout() {
  const { state } = useAuth();
  useEffect(() => {
    if (state.status === 'signed-in') void registerForPush();
  }, [state.status]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-out') return <Redirect href="/" />;

  const label = (text: string) =>
    function Label({ color: c }: { color: ColorValue }) {
      return <Text style={{ fontFamily: font.sansMedium, fontSize: 11.5, color: c, marginTop: 2 }}>{text}</Text>;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#f08a5d',
        tabBarInactiveTintColor: 'rgba(255,255,255,.75)',
        tabBarStyle: { backgroundColor: color.dark, borderTopWidth: 0, height: 84, paddingTop: 8 },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarLabel: label('Home'), tabBarIcon: ({ color: c }) => <HomeIcon color={c} /> }} />
      <Tabs.Screen name="project" options={{ tabBarLabel: label('Project'), tabBarIcon: ({ color: c }) => <ListIcon color={c} /> }} />
      <Tabs.Screen name="site" options={{ tabBarLabel: label('On site'), tabBarIcon: ({ color: c }) => <CameraIcon color={c} /> }} />
      <Tabs.Screen name="snags" options={{ tabBarLabel: label('Snags'), tabBarIcon: ({ color: c }) => <CheckIcon color={c} /> }} />
      <Tabs.Screen name="locker" options={{ tabBarLabel: label('Locker'), tabBarIcon: ({ color: c }) => <FolderIcon color={c} /> }} />
    </Tabs>
  );
}
