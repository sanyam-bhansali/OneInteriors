import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading, Rise, Screen, ErrorText, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { color, font } from '../lib/theme';

/**
 * The front door (the v1 design's Welcome): straight to the project when
 * signed in; otherwise the choosing journey, or sign-in for someone who
 * already has an account.
 */
export default function Welcome() {
  const { state, retry } = useAuth();

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signed-in') return <Redirect href="/home" />;
  if (state.status === 'offline') {
    return (
      <Screen footer={<Button label="Try again" onPress={() => void retry()} />}>
        <Title>No connection</Title>
        <ErrorText>{state.error}</ErrorText>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.dark }}>
      <Image source={require('../../assets/app/welcome-hero.webp')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(14,14,13,.35)', 'rgba(14,14,13,.15)', 'rgba(14,14,13,.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap}>
        <Image source={require('../../assets/brand/logo-ink.png')} style={styles.logo} contentFit="contain" tintColor="#ffffff" />
        <View style={{ flex: 1 }} />
        <Rise>
          <Text style={styles.meta}>● Pune, verified studios</Text>
        </Rise>
        <Rise delay={120}>
          <Text style={styles.h1}>Find the right interior designer for your home.</Text>
        </Rise>
        <Rise delay={240}>
          <Text style={styles.p}>Seven questions, three studios matched to your flat, and a quote you can read line by line.</Text>
        </Rise>
        <View style={{ gap: 8, marginTop: 24 }}>
          <Button label="Find your designer" onPress={() => router.push({ pathname: '/web', params: { path: '/app/name', title: 'Your brief' } })} />
          <Button label="I already have an account" variant="quiet" onPress={() => router.push('/sign-in')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 22, paddingBottom: 16 },
  logo: { width: 92, height: 48, marginTop: 8 },
  meta: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' },
  h1: { fontFamily: font.sansSemi, fontSize: 46, lineHeight: 44, letterSpacing: -2.2, color: color.white, marginTop: 12 },
  p: { fontFamily: font.sans, fontSize: 17, lineHeight: 25, color: 'rgba(255,255,255,.86)', marginTop: 16 },
});
