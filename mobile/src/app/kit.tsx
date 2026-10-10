import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Coin, CoinChip, CoinToast, GeioOrb } from '../components/brand';
import {
  Body,
  Button,
  Card,
  CircleOption,
  CountUp,
  DarkCard,
  DarkPanel,
  Eyebrow,
  Heading,
  OptionPill,
  Progress,
  RankedRow,
  Screen,
  Segmented,
  StatusChip,
  Tile,
  Title,
} from '../components/ui';
import { color } from '../lib/theme';

/**
 * Every shared part on one screen, to check them against
 * docs/app-handover/DESIGN-SPEC.md. Development builds only.
 */
export default function Kit() {
  const [tier, setTier] = useState<'essential' | 'premium' | 'luxury'>('premium');
  const [picked, setPicked] = useState('Full home');
  const [ranked, setRanked] = useState<string[]>(['Finishing on time']);
  const [toast, setToast] = useState(0);
  if (!__DEV__) return <Redirect href="/" />;

  const left = ['Staying in budget', 'Material quality', 'Design ambition'].filter((p) => !ranked.includes(p));
  return (
    <Screen>
      <Eyebrow>Design kit</Eyebrow>
      <Title>Your home is coming together, Priya.</Title>
      <Body muted>Body text at 15.5 px. Older customers and parents use this app.</Body>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <StatusChip tone="ok" label="Carpentry · on track" />
        <StatusChip tone="late" label="Overall · 4 days late" />
      </View>

      <Button label="Find your designer" onPress={() => setToast((t) => t + 1)} />
      <Button label="I already have an account" variant="ghost" />
      <Button label="Continue" disabled reason="Rank 2 more to continue" />
      <Button label="Use a different number" variant="quiet" />

      <Heading>Tiles</Heading>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile tint="peach" label="Overall" value="4 days late" valueColor={color.accentInk} />
        <Tile tint="mint" label="Paid" value="₹7.36 L" sub="of 18.4" />
        <Tile tint="sand" label="Handover" value="14 Dec" />
      </View>

      <Heading>Choices</Heading>
      <Segmented
        label="Tier"
        value={tier}
        onChange={setTier}
        options={[
          { id: 'essential', label: 'Essential', sub: '₹1.2k/sq ft' },
          { id: 'premium', label: 'Premium', sub: '₹1.8k/sq ft' },
          { id: 'luxury', label: 'Luxury', sub: '₹2.5k/sq ft' },
        ]}
      />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {['Full home', 'Kitchen & wardrobes', 'One room'].map((o) => (
          <OptionPill key={o} label={o} on={picked === o} onPress={() => setPicked(o)} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {ranked.map((r, i) => (
          <RankedRow key={r} n={i + 1} label={r} onRemove={() => setRanked(ranked.filter((x) => x !== r))} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {left.map((p) => (
          <CircleOption key={p} label={p} onPress={() => setRanked([...ranked, p])} />
        ))}
      </View>
      <Progress total={7} done={3} label="Question 3 of 7" />

      <Heading>Cards</Heading>
      <Card>
        <Eyebrow>Next payment</Eyebrow>
        <Body>40% when finishing starts, about 1 Nov.</Body>
      </Card>
      <DarkCard>
        <Eyebrow onDark>In plain words</Eyebrow>
        <Body style={{ color: color.onDark }}>Teakline is the safest pick for finishing on time.</Body>
        <Button label="Choose a finish" variant="light" />
      </DarkCard>
      <DarkPanel style={{ marginHorizontal: -20 }}>
        <Eyebrow onDark>Compare</Eyebrow>
        <CountUp value={1840000} format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`} style={{ fontSize: 34, color: color.onDark }} />
      </DarkPanel>

      <Heading>Coins and GEIO</Heading>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#6b6b66', padding: 12, borderRadius: 20 }}>
        <Coin size={32} />
        <CoinChip balance={1410} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 12 }}>
        <GeioOrb size={64} />
        <GeioOrb size={64} busy />
        <View style={{ backgroundColor: color.ink, padding: 14, borderRadius: 20 }}>
          <GeioOrb size={52} ring />
        </View>
      </View>
      {toast > 0 ? <CoinToast key={toast} amount={100} /> : null}
    </Screen>
  );
}
