import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Press } from '../components/ui';
import { apiBase } from '../lib/config';
import { color, font } from '../lib/theme';

/**
 * The parts of the app that live on the website's `/app` (docs/CUSTOMER-
 * PLATFORM-PLAN.md, step 3): the choosing journey a customer goes through
 * once, GEIO and the 3D home. Opened inside the app; only `/app` pages are
 * allowed in it, and its sign-in link opens the app's own sign-in.
 */
export default function Web() {
  const { path = '/app', title = '' } = useLocalSearchParams<{ path?: string; title?: string }>();
  const [loading, setLoading] = useState(true);
  const base = apiBase();
  const safePath = path.startsWith('/app') ? path : '/app';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={['top']}>
      <View style={styles.bar}>
        <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.close} accessibilityLabel="Close">
          <Text style={{ fontSize: 22, color: color.ink }}>×</Text>
        </Press>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <WebView
        source={{ uri: `${base}${safePath}${safePath.includes('?') ? '&' : '?'}source=app` }}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1, backgroundColor: color.bg }}
        allowsBackForwardNavigationGestures
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onShouldStartLoadWithRequest={(req) => {
          const url = new URL(req.url);
          if (url.origin !== new URL(base).origin) return false;
          if (url.pathname.startsWith('/sign-in')) {
            router.push('/sign-in');
            return false;
          }
          return url.pathname.startsWith('/app') || url.pathname.startsWith('/_next') || url.pathname.startsWith('/api');
        }}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={color.accent} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: color.ink2 },
  loading: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 52, alignItems: 'center', justifyContent: 'center' },
});
