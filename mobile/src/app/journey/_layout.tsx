import { Stack } from 'expo-router';
import { color } from '../../lib/theme';

/** The first-visit quiz: Name, Q1–Q7, Style DNA. No header; each screen draws its own back chevron. */
export default function JourneyLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper }, animation: 'slide_from_right' }} />;
}
