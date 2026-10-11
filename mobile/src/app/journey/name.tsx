import { router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { QuizScreen } from '../../components/journey/parts';
import { Button, Loading, Rise, Title } from '../../components/ui';
import { useBrief } from '../../lib/brief';
import { useHeadline, useT } from '../../lib/i18n';
import { color, font, type } from '../../lib/theme';

/**
 * #2 Your name (designs/Name.dc.html): the first name only, kept on the
 * phone's brief as `contactName`, as the website's /app/name does. Phone and
 * email are asked once the quotes are ready.
 */
export default function NameScreen() {
  const t = useT();
  const h1 = useHeadline(44);
  const { brief, ready, update } = useBrief();
  if (!ready) return <Loading />;

  const name = brief.contactName ?? '';
  const ok = name.trim().length > 0;
  const go = () => ok && router.push('/journey/q/1');

  return (
    <QuizScreen back="/" meta={t('name.meta')} footer={<Button label={t('common.continue')} onPress={go} disabled={!ok} reason={t('quiz.name.need')} />}>
      <View style={{ gap: 36, paddingTop: 28, paddingHorizontal: 4 }}>
        <Title size={h1}>{t('name.h1')}</Title>
        <Rise delay={120} style={{ gap: 10 }}>
          <Text nativeID="first-name" style={type.eyebrow}>
            {t('name.label')}
          </Text>
          <TextInput
            value={name}
            onChangeText={(v) => update({ contactName: v.slice(0, 40) })}
            onSubmitEditing={go}
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
            maxLength={40}
            placeholder="Priya"
            placeholderTextColor={color.ink3}
            aria-labelledby="first-name"
            accessibilityLabel={t('name.label')}
            style={styles.input}
          />
          <Text style={styles.note}>{t('name.note')}</Text>
        </Rise>
      </View>
    </QuizScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 60,
    borderBottomWidth: 2,
    borderBottomColor: color.ink,
    fontFamily: font.sansMedium,
    fontSize: 30,
    letterSpacing: -0.9,
    color: color.ink,
    padding: 0,
  },
  note: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.ink2 },
});
