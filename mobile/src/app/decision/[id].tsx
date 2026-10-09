import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackIcon } from '../../components/icons';
import { Body, Button, ErrorText, Loading, Press, Rise } from '../../components/ui';
import { api } from '../../lib/api';
import { dayLabel, optionPrice } from '../../lib/format';
import { useProject } from '../../lib/project';
import { color, font } from '../../lib/theme';

/**
 * A decision with a deadline (the v1 design): what waiting costs, each
 * option against the quote, and the choice sent to the studio. A choice can
 * be changed until the due date.
 */
export default function DecisionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refresh } = useProject();
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (state.status === 'loading') return <Loading />;
  const d = state.status === 'ready' ? state.project.decisions.find((x) => x.id === id) : undefined;
  if (!d || state.status !== 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, padding: 22, gap: 18 }}>
        <Body>This decision is not on your project any more.</Body>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }
  const closed = d.daysLeft < 0 || d.state === 'overdue';
  const selected = pick ?? d.chosenIndex ?? 0;
  const chosen = d.options[selected];

  const confirm = async () => {
    setBusy(true);
    const res = await api.choose(d.id, selected);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMsg({ ok: true, text: `${chosen?.name} confirmed. ${state.project.studio} is told.` });
    void refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.hero}>
          <Image source={require('../../../assets/app/kitchen.webp')} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,.1)', 'rgba(0,0,0,.6)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
              <BackIcon color={color.white} />
            </Press>
            <Text style={styles.heroMeta}>{closed ? `Closed ${dayLabel(d.dueOn)}` : `Your decision, due ${dayLabel(d.dueOn)}`}</Text>
          </SafeAreaView>
        </View>
        <View style={{ padding: 22, gap: 16 }}>
          <Rise>
            <Text style={styles.h1}>{d.title}</Text>
          </Rise>
          <Rise delay={120}>
            <Body muted>{d.why}</Body>
          </Rise>
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>
            {d.options.map((o, i) => {
              const on = i === selected;
              return (
                <Rise key={o.name} delay={220 + i * 60}>
                  <Press disabled={closed} onPress={() => (setPick(i), setMsg(null))} style={styles.option}>
                    <View style={[styles.swatch, { backgroundColor: o.swatch ?? color.surface }, on && styles.swatchOn]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optName, on && { color: color.accentInk }]}>{o.name}</Text>
                      {o.note ? <Text style={styles.optNote}>{o.note}</Text> : null}
                    </View>
                    <Text style={[styles.price, o.extraPaise === 0 && { color: color.ok }]}>{optionPrice(o.extraPaise)}</Text>
                  </Press>
                </Rise>
              );
            })}
          </View>
          <Body muted style={{ fontSize: 14 }}>
            Not sure? Ask your expert before {dayLabel(d.dueOn)}. She earns nothing from any option.
          </Body>
          {msg ? msg.ok ? <Text style={styles.toast}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText> : null}
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Button
          label={closed ? 'This decision has closed' : `Confirm ${(chosen?.name ?? '').replace(/^./, (c) => c.toLowerCase())}`}
          onPress={() => void confirm()}
          busy={busy}
          disabled={closed}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240, backgroundColor: color.dark, overflow: 'hidden' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.25)', alignItems: 'center', justifyContent: 'center' },
  heroMeta: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: color.white },
  h1: { fontFamily: font.sansSemi, fontSize: 36, lineHeight: 35, letterSpacing: -1.6, color: color.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  swatch: { width: 60, height: 60, borderRadius: 14, borderWidth: 1, borderColor: color.line },
  swatchOn: { borderWidth: 3, borderColor: color.accent },
  optName: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink },
  optNote: { fontFamily: font.sans, fontSize: 14, color: color.ink2, marginTop: 2 },
  price: { fontFamily: font.monoMedium, fontSize: 13, color: color.ink },
  toast: { backgroundColor: color.dark, color: color.onDark, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, textAlign: 'center', overflow: 'hidden', fontFamily: font.sansMedium },
});
