import { Stack } from 'expo-router';
import { MatchesProvider } from '../../lib/journey/matches-hook';
import { color } from '../../lib/theme';

/**
 * The first visit: Name, Q1–Q7, Style DNA, then matches, phone, quote,
 * compare, the expert call, and choosing and signing. No header; each screen
 * draws its own back chevron. The matches are fetched once for all of it.
 */
export default function JourneyLayout() {
  return (
    <MatchesProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper }, animation: 'slide_from_right' }} />
    </MatchesProvider>
  );
}
