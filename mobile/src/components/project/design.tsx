import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowIcon } from '../icons';
import { Card, ErrorText, Meta, Press } from '../ui';
import { api } from '../../lib/api';
import { inr, shortDate } from '../../lib/format';
import type { T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { Design, DesignDrawing, Doc } from '../../lib/types';
import { TickIcon } from './parts';
import { ProgressBar } from './tracker';

/**
 * The design card on the Project screen (Studio OS Phase 2): how far the
 * design is, what is next and which payment opens it, the site visit, the
 * mood board to fill (on the website, inside the app), the drawings to
 * approve or ask changes on, and once the design is closed, what changed
 * against the first quotation. Everything comes from the server's projection;
 * nothing here works a state out.
 */
export function DesignCard({ design, studio, owner, docs, onChanged, t }: { design: Design; studio: string; owner: boolean; docs: Doc[]; onChanged: () => void; t: T }) {
  const [showSteps, setShowSteps] = useState(false);
  const next = design.next;
  const visit = design.visits.find((v) => v.status === 'booked') ?? null;
  const urlOf = (id: string) => docs.find((d) => d.id === id)?.url ?? '';
  const done = design.steps.filter((s) => s.done).length;
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>{t('design.title')}</Text>
        <Meta>{design.designer ? t('design.with', { name: design.designer }) : studio}</Meta>
      </View>
      {typeof design.pct === 'number' ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.pct}>{design.pct}%</Text>
          <ProgressBar pct={design.pct} label={t('design.pct.a11y', { n: design.pct })} />
        </View>
      ) : null}

      {next && !design.done ? (
        <View style={styles.next}>
          <Text style={styles.eyebrow}>{t('design.next')}</Text>
          <Text style={styles.nextTitle}>
            {next.label}
            {next.yours ? ` (${t('design.yours')})` : ''}
          </Text>
          {next.plannedOn ? <Text style={styles.mono}>{t('design.planned', { date: shortDate(next.plannedOn) })}</Text> : null}
          {next.waitingFor ? <Text style={[styles.note, { color: color.accentInk }]}>{t('design.waitingFor', { payment: next.waitingFor })}</Text> : null}
          {next.moved ? <Text style={styles.note}>{next.moved}</Text> : null}
        </View>
      ) : null}

      {visit ? (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{t('design.visit', { purpose: visit.purpose })}</Text>
          <Text style={styles.mono}>
            {new Date(visit.at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
          </Text>
        </View>
      ) : null}

      {design.moodBoard.shared ? (
        <Press
          onPress={() => router.push({ pathname: '/web', params: { path: '/app/project/moodboard', title: t('design.mood.title') } })}
          accessibilityRole="link"
          accessibilityLabel={t('design.mood.title')}
          style={styles.link}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle}>{t('design.mood.title')}</Text>
            <Text style={styles.note}>{design.moodBoard.note ?? t('design.mood.body')}</Text>
          </View>
          <ArrowIcon color={color.ink} size={14} />
        </Press>
      ) : null}

      {design.drawings.length ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.eyebrow}>{t('design.drawings')}</Text>
          {design.drawings.map((d) => (
            <Drawing key={d.id} d={d} url={urlOf(d.id)} owner={owner} onChanged={onChanged} t={t} />
          ))}
        </View>
      ) : null}

      {design.measurements.length ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.eyebrow}>{t('design.rooms')}</Text>
          {design.measurements.map((m) => (
            <View key={m.room} style={styles.payRow}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>{m.room}</Text>
              <Text style={styles.mono}>
                {m.size}
                {m.height ? `, ${t('design.high', { h: m.height })}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {design.steps.length ? (
        <View style={{ gap: 6 }}>
          <Press onPress={() => setShowSteps((v) => !v)} haptic={false} accessibilityRole="button" accessibilityState={{ selected: showSteps }} style={styles.toggle}>
            <Text style={styles.toggleText}>{t('design.steps', { done, total: design.steps.length })}</Text>
          </Press>
          {showSteps
            ? design.steps.map((s, i) => (
                <View key={`${s.label}-${i}`} style={styles.step} accessible accessibilityLabel={`${s.label}${s.done ? ', ✓' : ''}`}>
                  <View style={[styles.box, s.done ? styles.boxDone : null]}>{s.done ? <TickIcon color={color.white} size={12} /> : null}</View>
                  <Text style={[styles.stepText, s.done && { color: color.ink2 }]}>{s.label}</Text>
                  <Text style={styles.mono}>{s.done && s.doneOn ? shortDate(s.doneOn) : s.plannedOn ? shortDate(s.plannedOn) : ''}</Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {design.changes ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.eyebrow}>{t('design.changes.title')}</Text>
          <Text style={styles.nextTitle}>
            {inr(design.changes.salesTotalPaise)} → {inr(design.changes.designTotalPaise)}
          </Text>
          {design.changes.lines.slice(0, 12).map((l, i) => (
            <View key={`${l.room}-${l.product}-${i}`} style={styles.payRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{l.product}</Text>
                <Text style={styles.mono}>
                  {l.room} · {t(`design.change.${l.kind}`)}
                </Text>
              </View>
              <Text style={styles.amt}>{l.kind === 'REMOVED' ? `−${inr(l.wasPaise)}` : l.kind === 'ADDED' ? `+${inr(l.nowPaise)}` : inr(l.nowPaise)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Drawing({ d, url, owner, onChanged, t }: { d: DesignDrawing; url: string; owner: boolean; onChanged: () => void; t: T }) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (verdict: 'APPROVED' | 'CHANGES') => {
    setBusy(true);
    setError(null);
    const res = await api.answerDrawing(d.id, verdict, verdict === 'CHANGES' ? comment : '');
    setBusy(false);
    if (!res.ok) return setError(res.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAsking(false);
    onChanged();
  };
  return (
    <View style={[styles.drawing, d.state === 'waiting' && styles.waiting]}>
      <View style={styles.head}>
        <Text style={[styles.rowTitle, { flex: 1 }]}>{d.title}</Text>
        {url ? (
          <Press onPress={() => void WebBrowser.openBrowserAsync(url)} haptic={false} accessibilityRole="link" accessibilityLabel={`${t('design.open')}: ${d.title}`}>
            <Text style={styles.linkText}>{t('design.open')}</Text>
          </Press>
        ) : null}
      </View>
      <Text style={styles.mono}>
        {d.version > 1 ? `${t('design.version', { n: d.version })} · ` : ''}
        {t(`design.state.${d.state}`)}
        {d.comment ? ` · “${d.comment}”` : ''}
      </Text>
      {owner && d.state === 'waiting' && !asking ? (
        <View style={styles.buttons}>
          <Press onPress={() => void send('APPROVED')} disabled={busy} accessibilityLabel={`${t('design.approve')}: ${d.title}`} style={[styles.btn, styles.yes]}>
            <Text style={[styles.btnText, { color: color.white }]}>{busy ? '…' : t('design.approve')}</Text>
          </Press>
          <Press onPress={() => setAsking(true)} disabled={busy} accessibilityLabel={`${t('design.askChanges')}: ${d.title}`} style={[styles.btn, styles.no]}>
            <Text style={styles.btnText}>{t('design.askChanges')}</Text>
          </Press>
        </View>
      ) : null}
      {asking ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('design.whatChange')}
            accessibilityLabel={t('design.whatChange')}
            multiline
            maxLength={1000}
            style={styles.input}
            placeholderTextColor={color.ink3}
          />
          <View style={styles.buttons}>
            <Press onPress={() => void send('CHANGES')} disabled={busy || comment.trim().length < 3} style={[styles.btn, styles.yes]}>
              <Text style={[styles.btnText, { color: color.white }]}>{busy ? '…' : t('design.send')}</Text>
            </Press>
            <Press onPress={() => setAsking(false)} style={[styles.btn, styles.no]}>
              <Text style={styles.btnText}>{t('design.cancel')}</Text>
            </Press>
          </View>
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

/* The warm tint for something waiting on the customer, as on the payments card (Tracker.dc.html). */
const ASK_BG = '#F5E2D8';

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  pct: { fontFamily: font.mono, fontSize: 24, color: color.ink },
  eyebrow: { fontFamily: font.sansMedium, fontSize: 12.5, letterSpacing: 12.5 * 0.07, textTransform: 'uppercase', color: color.ink2 },
  next: { gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  nextTitle: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 12.5, lineHeight: 18, color: color.ink2 },
  note: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: color.ink2 },
  row: { gap: 2, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  rowTitle: { fontFamily: font.sansMedium, fontSize: 14.5, color: color.ink },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  linkText: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.accentInk, paddingVertical: 6 },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  amt: { fontFamily: font.monoMedium, fontSize: 13.5, color: color.ink, textAlign: 'right' },
  toggle: { minHeight: 44, justifyContent: 'center' },
  toggleText: { fontFamily: font.sansMedium, fontSize: 13.5, color: color.accentInk },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { flex: 1, fontFamily: font.sans, fontSize: 14, color: color.ink },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: color.ink3, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: color.accent, borderColor: color.accent },
  drawing: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 6, backgroundColor: color.paper, borderWidth: 1, borderColor: color.line },
  waiting: { backgroundColor: ASK_BG, borderColor: ASK_BG },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  btn: { minHeight: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  yes: { backgroundColor: color.ink },
  no: { borderWidth: 1, borderColor: color.ink },
  btnText: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink },
  input: { minHeight: 80, borderRadius: 12, borderWidth: 1, borderColor: color.line, padding: 12, fontFamily: font.sans, fontSize: 15, color: color.ink, backgroundColor: color.white, textAlignVertical: 'top' },
});
