import type { Metadata } from 'next';
import Link from 'next/link';
import { meetingPeople, myMeetings, type MeetingRow } from '@/modules/studio-office/meetings';
import { lengthLabel, standing, whenLabel } from '@/modules/studio-office/meeting-rules';
import { istDay } from '@/modules/project/working-days';
import { AnswerButtons, NewMeeting, OrganiserButtons, TakeSuggestion } from '../MeetingUi';
import '../../office-ui.css';
import '../calendar.css';

export const metadata: Metadata = { title: 'Meetings', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Office meetings (owner, 27 Oct 2026; docs/studio-os/OFFICE-MEETINGS.md):
 * what is asked of you first, then the suggestions on yours, then what is
 * coming up, then the last two weeks. Every role at the studio opens it.
 */
export default async function MeetingsPage() {
  const now = new Date();
  const [data, people] = await Promise.all([myMeetings(now), meetingPeople()]);
  if (!data) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Sign in to your studio to see your meetings.</p>
      </main>
    );
  }
  const { toAnswer, suggestions, upcoming, past } = data;
  const nothing = toAnswer.length + suggestions.length + upcoming.length + past.length === 0;

  return (
    <main className="content ox-page">
      {data.fromSite ? (
        <Link href="/studio/site" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>
          ← Back to site
        </Link>
      ) : null}
      <div className="phead">
        <div>
          <h1>Meetings</h1>
          <p className="muted">Meet anyone at the studio. They accept, or suggest another time; it lands on both your calendars.</p>
        </div>
        <NewMeeting people={people} primary />
      </div>

      {nothing ? (
        <div className="empty">
          <b>No meetings yet.</b>
          <span className="muted sm">Set one up: pick who, when and what it is about.</span>
        </div>
      ) : null}

      {toAnswer.length > 0 ? (
        <Section title="Waiting for your answer" count={toAnswer.length}>
          {toAnswer.map((m) => (
            <Card key={m.id} m={m} meId={data.meId} now={now}>
              <AnswerButtons id={m.id} accepted={false} />
            </Card>
          ))}
        </Section>
      ) : null}

      {suggestions.length > 0 ? (
        <Section title="Another time suggested" count={suggestions.length}>
          {suggestions.map((m) => (
            <Card key={m.id} m={m} meId={data.meId} now={now}>
              <ul className="meet-sugg">
                {m.guests
                  .filter((g) => g.answer === 'PROPOSED' && g.proposedAt)
                  .map((g) => (
                    <li key={g.memberId}>
                      <span>
                        <b>{g.name}</b> suggests <b>{whenLabel(g.proposedAt!)}</b>
                        {g.note ? <span className="muted"> · “{g.note}”</span> : null}
                      </span>
                      <TakeSuggestion id={m.id} guestId={g.memberId} label="Take this time" />
                    </li>
                  ))}
              </ul>
              <p className="muted sm" style={{ margin: 0 }}>
                Taking a time moves the meeting; everyone else is asked again. Or keep yours: move it or cancel it below.
              </p>
              <OrganiserButtons id={m.id} />
            </Card>
          ))}
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="Coming up" count={upcoming.length}>
          {upcoming.map((m) => (
            <Card key={m.id} m={m} meId={data.meId} now={now}>
              {m.mine ? <OrganiserButtons id={m.id} /> : m.myAnswer ? <AnswerButtons id={m.id} accepted={m.myAnswer === 'ACCEPTED'} /> : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {past.length > 0 ? (
        <Section title="Last two weeks" count={past.length}>
          {past.map((m) => (
            <Card key={m.id} m={m} meId={data.meId} now={now} />
          ))}
        </Section>
      ) : null}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="meet-section">
      <h2>
        {title} <span className="muted">· {count}</span>
      </h2>
      <div className="meet-list">{children}</div>
    </section>
  );
}

const ANSWER_WORD = { PENDING: 'not answered', ACCEPTED: 'coming', PROPOSED: 'suggests another time' } as const;

function Card({ m, meId, now, children }: { m: MeetingRow; meId: string; now: Date; children?: React.ReactNode }) {
  const s = standing(m, now);
  const day = istDay(m.startsAt);
  return (
    <article id={`m-${m.id}`} className={`card meet-card${m.cancelledAt ? ' cancelled' : ''}`}>
      <div className="meet-head">
        <div style={{ minWidth: 0 }}>
          <b className="meet-title">{m.title}</b>
          <span className="muted sm" style={{ display: 'block' }}>
            <Link href={`/studio/calendar?view=day&day=${day}`}>{whenLabel(m.startsAt)}</Link> · {lengthLabel(m.minutes)}
            {m.place ? ` · ${m.place}` : ''}
          </span>
        </div>
        <span className={`chip ${s.tone === 'good' ? 'good' : s.tone === 'bad' ? 'bad' : s.tone === 'warn' ? 'warn' : ''}`}>{s.word}</span>
      </div>
      <p className="sm" style={{ margin: 0 }}>
        <span className="muted">Set up by </span>
        {m.organiserId === meId ? 'you' : m.organiserName}
        <span className="muted"> · with </span>
        {m.guests.map((g, i) => (
          <span key={g.memberId}>
            {i > 0 ? ', ' : ''}
            {g.memberId === meId ? 'you' : g.name} <span className="muted">({ANSWER_WORD[g.answer]})</span>
          </span>
        ))}
      </p>
      {m.note ? <p className="sm meet-note">{m.note}</p> : null}
      {!m.cancelledAt && children}
    </article>
  );
}
