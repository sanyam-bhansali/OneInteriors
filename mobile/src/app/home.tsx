import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Eyebrow, Screen, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { color, radius, space } from '../lib/theme';

/**
 * Signed in. Slice 1 ends here; the brief, matches, quotes and the project
 * arrive as the slices in docs/MOBILE-APP-PLAN.md land.
 */
export default function Home() {
  const { state, signOut } = useAuth();
  if (state.status !== 'signed-in') return <Redirect href="/" />;

  const first = state.user.name?.split(' ')[0];

  return (
    <Screen footer={<Button label="Sign out" variant="quiet" onPress={() => void signOut()} />}>
      <Eyebrow>Your home</Eyebrow>
      <Title>{first ? `Welcome, ${first}.` : 'Welcome.'}</Title>
      <View style={styles.card}>
        <Body>Your brief, your matched studios and their quotes will live here.</Body>
        <Body muted>Good things take time :) We are building this now.</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.paper2,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.rule,
  },
});
