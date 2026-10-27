# Office meetings

Owner, 27 Oct 2026: "add calendar tab for everyone, and … anyone can set up a
meeting with anyone in the office through the calendar, and the other person
can approve or reschedule that meeting."

## What it does

- **Everyone has the Calendar.** Owner, PM and sales keep the calendar they had
  (follow-ups, lead meetings, tasks, One Interiors visits) with office meetings
  added. Designers, accounts and site supervisors get a calendar of their
  meetings alone. A supervisor reaches it from a Meetings tab in site mode's
  bottom bar. One Interiors visits stay the owner's and PM's.
- **Set up a meeting** (Calendar or Calendar → Meetings): what it is about,
  day and time (India), length (15 min to 8 hr), where (optional), a note
  (optional), and one to twenty people at the studio (anyone not suspended,
  including people invited who have not signed in yet).
- **Each person asked** answers **Accept** or **Suggest another time** (a day,
  a time, and why, optional). They can change their answer until it starts.
- **The organiser** sees suggestions first on the Meetings page and can
  **Take this time** (the meeting moves there; that person is coming, everyone
  else is asked again because the time they said yes to is gone), **Move** it
  to a time of their own (everyone is asked again), or **Cancel** it.
- **Notices**: one per change, in the person's inbox (push or email where
  they have it): asked, accepted, suggested, moved, cancelled. Never WhatsApp,
  never a reminder chain.
- **Where it shows**: Calendar → Meetings (waiting for your answer, another
  time suggested, coming up, last two weeks); the calendar itself (marked
  "not settled" until everyone has accepted); a "N meetings to answer" badge
  on the Calendar tile and in Right now on the home; a banner on the calendar.
- **Who sees what**: a person sees the meetings they set up or were asked to.
  The owner and a PM also see everyone's on the calendar (Everyone / one
  person), so they can see who is busy when. Meetings are studio staff only,
  never a client.

## Not in this cut

- No "decline": suggesting another time covers it, as asked.
- No clash check against other meetings, and no free/busy picker.
- No recurring meetings, no reminders before a meeting.

## Code

- `prisma/migrations/20261027100000_office_meetings`: `studio_meetings`,
  `studio_meeting_guests`, enum `MeetingAnswer`; RLS on, no policies.
- `src/modules/studio-office/meeting-rules.ts` (pure, tested in
  `tests/studio-office-meetings.test.ts`) and `meetings.ts` (reads, writes,
  notices).
- `src/app/studio/calendar/meetings/page.tsx`, `MeetingUi.tsx`,
  `meeting-actions.ts`; the calendar page, `calendar.ts` and
  `calendar-rules.ts` (kind `office`).
- Access: `surfaces.ts` (`calendarForAll`), `apps.ts` (Calendar for every
  role, Meetings tab), site mode's `SiteBar.tsx`.
