import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Body, Button, ErrorText, Eyebrow, Screen, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { color, space } from '../lib/theme';

/** The front door: a welcome when signed out, straight home when signed in. */
export default function Welcome() {
  const { state, retry } = useAuth();

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.petrolDeep} />
      </View>
    );
  }

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
    <Screen footer={<Button label="Get started" onPress={() => router.push('/sign-in')} />}>
      <Image source={require('../../assets/brand/logo-ink.png')} style={styles.logo} contentFit="contain" />
      <View style={styles.spacer} />
      <Eyebrow>Interiors in Pune</Eyebrow>
      <Title>Find the right studio for your home.</Title>
      <Body>
        Tell us about your flat. We match you with verified studios, show you their quotes line by line, and a
        registered architect helps you decide — before you sign anything.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper },
  logo: { width: 120, height: 63 },
  spacer: { flexGrow: 1, minHeight: space.xxl },
});
