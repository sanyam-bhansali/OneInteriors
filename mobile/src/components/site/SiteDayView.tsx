import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { DarkCard, Eyebrow } from '../ui';
import { dayLabel, timeLabel } from '../../lib/format';
import type { Key, T } from '../../lib/i18n';
import { color, font } from '../../lib/theme';
import type { SiteDay, SiteEntry } from '../../lib/types';

/**
 * One day from the studio's daily site log (Feed.dc.html): every photo with
 * its own sentence under it, in the customer's language; who was on site
 * and from when; what got done; anything added later that day shown beside
 * it, never instead of it. A nobody-on-site day is the dark card, with the
 * studio's reason in plain words and whether it counts against the studio.
 * The latest day is drawn large (`lead`), older days compact.
 */
export function SiteDayView({ d, studio, lead, isToday, t }: { d: SiteDay; studio: string; lead: boolean; isToday: boolean; t: T }) {
  const date = dayLabel(d.postedAt);
  if (d.kind === 'nobody') {
    return (
      <DarkCard style={{ borderRadius: 18, padding: 18, gap: 8 }}>
        <Eyebrow onDark>{t('site.nobody.title', { date: isToday ? t('site.today', { date }) : date })}</Eyebrow>
        <Text style={styles.darkBody}>
          {t('site.nobody.says', { studio, reason: reasonWords(d, t) })} {t(d.countsAgainstStudio === false ? 'site.nobody.free' : 'site.nobody.counts')}
        </Text>
        {d.corrections.map((c) => (
          <View key={c.id} style={[styles.added, { borderLeftColor: color.accentWarm }]}>
            <Text style={[styles.addedLabel, { color: color.onDark2 }]}>{t('site.added', { time: timeLabel(c.postedAt) })}</Text>
            <Entry e={c} t={t} lead={false} dark />
          </View>
        ))}
      </DarkCard>
    );
  }
  return (
    <View style={[styles.day, !lead && styles.dayRule]}>
      <View style={styles.dayHead}>
        <Text role="heading" style={styles.h2}>
          {isToday ? t('site.today', { date }) : date}
        </Text>
        <Text style={styles.mono}>{timeLabel(d.postedAt)}</Text>
      </View>
      <Entry e={d} t={t} lead={lead} />
      {d.corrections.map((c) => (
        <View key={c.id} style={styles.added}>
          <Text style={styles.addedLabel}>{t('site.added', { time: timeLabel(c.postedAt) })}</Text>
          <Entry e={c} t={t} lead={false} />
        </View>
      ))}
      <View style={styles.chips}>
        <Text style={styles.chip}>{t('site.by.studio', { studio })}</Text>
      </View>
    </View>
  );
}

export function reasonWords(e: Pick<SiteEntry, 'reason' | 'reasonText'>, t: T): string {
  if (!e.reason) return e.reasonText?.toLowerCase() ?? t('site.reason.other');
  const key = `site.reason.${e.reason}` as Key;
  const words = t(key);
  return words === key ? (e.reasonText?.toLowerCase() ?? e.reason) : words;
}

/** A crew member as the customer sees them: "Ramesh, carpenter, 9:40 am". */
export function crewLine(c: SiteEntry['crew'][number], t: T): string {
  const role = c.role.toLowerCase();
  return c.arrivedAt ? t('site.crew.at', { name: c.name, role, time: timeLabel(c.arrivedAt) }) : t('site.crew', { name: c.name, role });
}

function Entry({ e, t, lead, dark = false }: { e: SiteEntry; t: T; lead: boolean; dark?: boolean }) {
  const ink = dark ? color.onDark : color.ink;
  const unshown = e.done.filter((x) => !e.photos.some((p) => p.doneStep === x.label));
  return (
    <View style={{ gap: 12 }}>
      {e.reason ? <Text style={[styles.note, { color: ink }]}>{t('site.nobody.short', { reason: reasonWords(e, t) })}</Text> : null}
      {e.photos.map((p, i) => (
        <View key={`${p.url}-${i}`} style={{ gap: 8 }}>
          {p.url ? (
            <Image
              source={{ uri: p.url }}
              accessibilityLabel={p.text ?? t('site.photo', { date: dayLabel(p.takenAt) })}
              style={lead && i === 0 ? styles.hero : styles.photo}
              contentFit="cover"
              transition={300}
            />
          ) : null}
          {p.doneStep ? (
            <Text style={[styles.stepDone, dark && { color: color.onDark }]}>
              {t('site.stepDone', { step: p.doneStep })} <Text style={[styles.mono, dark && { color: color.onDark2 }]}>· {timeLabel(p.takenAt)}</Text>
            </Text>
          ) : null}
          {p.text ? <Text style={[styles.note, { color: ink }]}>{p.text}</Text> : null}
          {p.fromGallery ? <Text style={[styles.tag, dark && { color: color.onDark2, borderColor: 'rgba(255,255,255,.3)' }]}>{t('site.gallery')}</Text> : null}
        </View>
      ))}
      {e.text ? <Text style={[styles.note, { color: ink }]}>{e.text}</Text> : null}
      {e.crew.length ? (
        <View style={styles.chips}>
          {e.crew.map((c, i) => (
            <Text key={`${c.name}-${i}`} style={[styles.chip, dark && { color: color.onDark, borderColor: 'rgba(255,255,255,.3)' }]}>
              {crewLine(c, t)}
            </Text>
          ))}
        </View>
      ) : null}
      {/* Steps ticked without their own photo here (older posts): a step's photo already says "Done:". */}
      {unshown.length ? <Text style={[styles.done, dark && { color: color.onDark2 }]}>{t('site.done', { items: unshown.map((x) => x.label).join(', ') })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { gap: 12 },
  dayRule: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 16, gap: 10 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  h2: { flexShrink: 1, fontFamily: font.sansMedium, fontSize: 22, letterSpacing: 22 * -0.03, color: color.ink },
  mono: { fontFamily: font.mono, fontSize: 13, color: color.ink2 },
  hero: { width: '100%', height: 220, borderRadius: 16, backgroundColor: color.soft },
  photo: { width: '100%', height: 170, borderRadius: 12, backgroundColor: color.soft },
  note: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 23, color: color.ink },
  darkBody: { fontFamily: font.sans, fontSize: 15, lineHeight: 22.5, color: '#D6D4CE' },
  done: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.ink2 },
  stepDone: { fontFamily: font.sansSemi, fontSize: 15, lineHeight: 21, color: color.ok },

  added: { borderLeftWidth: 2, borderLeftColor: color.accent, paddingLeft: 12, gap: 8 },
  addedLabel: { fontFamily: font.mono, fontSize: 12.5, color: color.accentInk, textTransform: 'uppercase' },
  tag: {
    alignSelf: 'flex-start',
    fontFamily: font.mono,
    fontSize: 12,
    color: color.ink2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontFamily: font.mono,
    fontSize: 13,
    color: color.ink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(11,11,11,.18)',
    overflow: 'hidden',
  },
});
