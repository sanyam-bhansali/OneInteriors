import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, ErrorText, Eyebrow, Loading, Press, Screen, Title } from '../components/ui';
import { api, type RequirementForm } from '../lib/api';
import { useT } from '../lib/i18n';
import { color, font } from '../lib/theme';

/**
 * The requirement form, in the phone app (owner, 1 Nov 2026; the server's
 * project/requirement-form.ts): the questions the designer needs before the
 * design starts, from Hauspire's pre-design form, asked as the server sends
 * them. Filled once; after sending it is read only, the commitment reference.
 */
export default function Requirements() {
  const t = useT();
  const [form, setForm] = useState<RequirementForm | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    void api.requirements().then((r) => {
      if (!r.ok) return setError(r.error);
      setForm(r.data.form);
      if (r.data.form) setAnswers(r.data.form.answers);
    });
  useEffect(load, []);

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await api.sendRequirements(answers);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(r.data.message ?? t('req.sent'));
    load();
  };

  if (form === undefined && !error) return <Loading />;
  if (!form) {
    return (
      <Screen back>
        <Title size={30}>{t('req.done.row')}</Title>
        {error ? <ErrorText>{error}</ErrorText> : <Body muted>{t('req.none')}</Body>}
      </Screen>
    );
  }
  const filled = form.state === 'filled';
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  return (
    <Screen
      back
      footer={filled ? undefined : <Button label={t('req.send')} onPress={() => void send()} busy={busy} />}
    >
      <Eyebrow>{form.studio}</Eyebrow>
      <Title size={30}>{form.title}</Title>
      <Body muted>{filled && form.filledOn ? t('req.sentOn', { date: dayWords(form.filledOn) }) : form.intro}</Body>
      {done ? <Text style={styles.done}>{done}</Text> : null}
      {form.sections.map((s) => (
        <Card key={s.id}>
          <Text style={styles.section}>{s.title}</Text>
          {s.questions.map((q) => {
            const v = answers[q.id] ?? '';
            return (
              <View key={q.id} style={{ gap: 6 }}>
                <Text style={styles.q}>{q.label}</Text>
                {q.help ? <Text style={styles.help}>{q.help}</Text> : null}
                {filled ? (
                  <Text style={styles.answer}>{v || '—'}</Text>
                ) : q.kind === 'choice' ? (
                  <View style={{ gap: 6 }} accessibilityRole="radiogroup">
                    {(q.options ?? []).map((o) => (
                      <Press
                        key={o}
                        onPress={() => set(q.id, o)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: v === o }}
                        style={[styles.option, v === o && styles.optionOn]}
                      >
                        <Text style={[styles.optionText, v === o && { color: color.white }]}>{o}</Text>
                      </Press>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={v}
                    onChangeText={(x) => set(q.id, x)}
                    multiline={q.kind === 'long'}
                    maxLength={q.kind === 'long' ? 2000 : 200}
                    aria-label={q.label}
                    style={[styles.input, q.kind === 'long' && { minHeight: 84, textAlignVertical: 'top' }]}
                  />
                )}
              </View>
            );
          })}
        </Card>
      ))}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWords = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
};

const styles = StyleSheet.create({
  section: { fontFamily: font.sansSemi, fontSize: 18, color: color.ink },
  q: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink, marginTop: 6 },
  help: { fontFamily: font.sans, fontSize: 13, color: color.ink2 },
  answer: { fontFamily: font.sans, fontSize: 15, color: color.ink },
  done: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
  option: { borderWidth: 1, borderColor: color.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  optionOn: { backgroundColor: color.ink, borderColor: color.ink },
  optionText: { fontFamily: font.sansMedium, fontSize: 15, color: color.ink },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: color.line, padding: 12, fontFamily: font.sans, fontSize: 15, color: color.ink, backgroundColor: color.white },
});
