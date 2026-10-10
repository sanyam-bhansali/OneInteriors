import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Text, View, type ColorValue } from 'react-native';
import { CameraIcon, HomeIcon, ListIcon, PersonIcon } from '../../components/icons';
import { Loading } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { registerForPush } from '../../lib/push';
import { color, font } from '../../lib/theme';

/**
 * The signed-in app's tab bar (v79 design): Home · Project · GEIO · Site · Me.
 * Snags and decisions open from Project, the Locker and settings from Me,
 * and GEIO is the orb in the middle. Asks for notifications once, on arrival.
 */
export default function TabsLayout() {
  const { state } = useAuth();
  useEffect(() => {
    if (state.status === 'signed-in') void registerForPush();
  }, [state.status]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-out') return <Redirect href="/" />;

  const label = (text: string) =>
    function Label({ color: c }: { color: ColorValue }) {
      return <Text style={{ fontFamily: font.sansMedium, fontSize: 13, color: c, marginTop: 2 }}>{text}</Text>;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#f08a5d',
        tabBarInactiveTintColor: 'rgba(255,255,255,.75)',
        tabBarStyle: { backgroundColor: color.dark, borderTopWidth: 0, height: 88, paddingTop: 8 },
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarLabel: label('Home'), tabBarIcon: ({ color: c }) => <HomeIcon color={c} /> }} />
      <Tabs.Screen name="project" options={{ tabBarLabel: label('Project'), tabBarIcon: ({ color: c }) => <ListIcon color={c} /> }} />
      <Tabs.Screen name="geio" options={{ tabBarLabel: label('GEIO'), tabBarIcon: () => <Orb /> }} />
      <Tabs.Screen name="site" options={{ tabBarLabel: label('Site'), tabBarIcon: ({ color: c }) => <CameraIcon color={c} /> }} />
      <Tabs.Screen name="me" options={{ tabBarLabel: label('Me'), tabBarIcon: ({ color: c }) => <PersonIcon color={c} /> }} />
    </Tabs>
  );
}

/** GEIO's orb, raised above the bar, as on the web app. */
function Orb() {
  return (
    <View
      style={{
        marginTop: -26,
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 4,
        borderColor: color.dark,
        overflow: 'hidden',
        shadowColor: color.accentWarm,
        shadowOpacity: 0.7,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
    >
      <LinearGradient colors={['#fff6e6', '#f2c98a', '#e07a4e', '#ba5329', '#6e2a10']} start={{ x: 0.25, y: 0.1 }} end={{ x: 0.85, y: 1 }} style={{ flex: 1 }} />
    </View>
  );
}
