import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { LockGate } from '../lib/lock';
import { ProjectProvider } from '../lib/project';
import { useNotificationRouting } from '../lib/push';
import { color } from '../lib/theme';

function Routes() {
  const { state } = useAuth();
  // A tapped notification opens its screen, once someone is signed in to see it.
  useNotificationRouting(state.status === 'signed-in');
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'fade_from_bottom' }} />;
}

export default function RootLayout() {
  // The design's faces: Geist for words, Geist Mono for every fact.
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_400Regular, GeistMono_500Medium });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.dark }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProjectProvider>
          <LockGate>
            <StatusBar style="dark" />
            <Routes />
          </LockGate>
        </ProjectProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
