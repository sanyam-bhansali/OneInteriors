/**
 * Every page in One Interiors, in the order a person meets it.
 *
 * One list, read by both the capture script and the README writer, so the
 * pictures and the words cannot drift apart. Adding a page means adding it
 * here and nowhere else.
 *
 * `needs` is the honest part. Most of these pages render something different —
 * or nothing — depending on what is in the database and who is signed in, and
 * a screenshot that does not say which state it caught is a screenshot that
 * will mislead somebody later.
 */

/** @typedef {'public'|'customer'|'studio'|'ops'} Flow */

export const FLOWS = {
  '00-entry': {
    title: 'Getting in',
    blurb:
      'The pages anyone can reach: the marketplace front door, the two sign-in paths, ' +
      'and the form a studio applies through. Everything else in this folder set ' +
      'sits behind one of these.',
  },
  '01-customer': {
    title: 'The customer journey',
    blurb:
      'A homeowner in Pune, from "I want to do up my flat" to holding three ' +
      'comparable quotes and an architect who has read them. Hidden behind the ' +
      'waitlist in production today — CUSTOMER_LIVE opens it.',
  },
  '02-studio': {
    title: 'The studio practice software',
    blurb:
      'What a design studio gets: onboarding onto the roster, then the software ' +
      'they run their practice in — leads, projects, quotations, rates, their own ' +
      'public listing.',
  },
  '03-ops': {
    title: 'The ops console',
    blurb:
      'Yours. Who applied, who has been verified and how, which customer went to ' +
      'which studio, and what happened next.',
  },
};

export const ROUTES = [
  // ── 00 · Getting in ───────────────────────────────────────────
  {
    flow: '00-entry', n: 1, path: '/', name: 'landing',
    title: 'The marketplace front door',
    does: 'The pitch: nine questions, studios that actually fit, a real quote from each, and an architect who checks every step. Scroll-driven — the how-it-works section pins a list of steps beside real product views rather than generic illustrations.',
    who: 'Anyone arriving at oneinteriors.in.',
    before: 'A search, an ad, a friend.',
    after: 'The quiz, or the studio roster.',
    needs: 'Nothing. Renders with fixtures if the database is empty.',
  },
  {
    flow: '00-entry', n: 2, path: '/studios', name: 'roster',
    title: 'Every studio on the roster',
    does: 'The full list, with what each has been verified on. Deliberately not ranked by anything a studio can pay for.',
    who: 'A customer browsing before committing to the quiz.',
    before: 'The landing page.', after: 'A studio profile.',
    needs: 'Studios in the database. DEV_SHOW_UNVERIFIED_STUDIOS=1 shows the ones still onboarding.',
  },
  {
    flow: '00-entry', n: 3, path: '/studios/northlight-studio', name: 'studio-profile',
    title: 'One studio, in public',
    does: 'Their work, their range, their localities, and the twelve checks with the state of each. The page a customer reads before deciding.',
    who: 'A customer.', before: 'The roster, or a match.', after: 'Requesting a quote.',
    needs: 'A studio with that slug. Swap the slug if your data differs.',
  },
  {
    flow: '00-entry', n: 4, path: '/verification', name: 'verification-explained',
    title: 'What "verified" actually means here',
    does: 'The twelve checks, spelled out, including what each one does NOT prove. The page that makes the badge mean something.',
    who: 'A sceptical customer, and every studio deciding whether to apply.',
    before: 'A verification badge anywhere.', after: 'Back where they came from.',
    needs: 'Nothing.',
  },
  {
    flow: '00-entry', n: 5, path: '/sign-in', name: 'sign-in-customer',
    title: 'Sign in — customer',
    does: 'Name and mobile, then a code on WhatsApp. No password: a customer signs in rarely, and a forgotten password is one more wall between them and their quotes.',
    who: 'A customer returning for their quotes.',
    before: 'Anything that needs an account.', after: 'Where they were going.',
    needs: 'Nothing. On studio. and ops. hosts this page shows the staff form instead.',
  },
  {
    flow: '00-entry', n: 6, path: '/sign-in', name: 'sign-in-staff', host: 'studio',
    title: 'Sign in — studio and ops',
    does: 'Email and password first, because staff sign in to work and do it often. The emailed link sits directly underneath, never hidden, for a forgotten password or a first visit.',
    who: 'Studio owners and ops.',
    before: 'Any staff page.', after: 'The studio dashboard or the console.',
    needs: 'Nothing to render. Shown by hostname, so capture uses the studio host header.',
  },
  {
    flow: '00-entry', n: 7, path: '/sign-in/verify?reason=expired', name: 'link-expired',
    title: 'That link has expired',
    does: 'Explains why rather than just failing: links last fifteen minutes and work once, and this page says so and offers another.',
    who: 'Anyone who opened a link too late.',
    before: 'A stale email.', after: 'A fresh link.',
    needs: 'Nothing — the reason is a query parameter.',
  },
  {
    flow: '00-entry', n: 8, path: '/set-password?first=1', name: 'set-password',
    title: 'Choose a password',
    does: 'Where a studio lands the first time they redeem their approval link. Thirty seconds, at the one moment we know they are reading something from us. Skippable.',
    who: 'A newly approved studio, and ops.',
    before: 'The approval email.', after: 'Their dashboard.',
    needs: 'A signed-in staff account with no password yet.',
  },
  {
    flow: '00-entry', n: 9, path: '/apply', name: 'apply',
    title: 'A studio applies',
    does: 'The form a practice fills in to be considered. Asks for the things that decide it — years working, localities, range, what they have finished — and nothing else.',
    who: 'A design studio in Pune.',
    before: 'An invitation, or the site.', after: 'Ops reviews it.',
    needs: 'Nothing.',
  },

  // ── 01 · The customer journey ─────────────────────────────────
  {
    flow: '01-customer', n: 1, path: '/quiz', name: 'quiz',
    title: 'Nine questions',
    does: 'The brief being written, a question at a time. Shows the answers accumulating and a live count of how many studios still match — so the customer sees their choices narrowing the field rather than filling a form.',
    who: 'A homeowner starting out.',
    before: 'The landing page.', after: 'The tier estimate.',
    needs: 'Nothing. Progress is kept per browser until they sign in.',
  },
  {
    flow: '01-customer', n: 2, path: '/tier', name: 'tier',
    title: 'What this is likely to cost',
    does: 'An honest range from the brief, with what moves it up and down. Before any studio is involved, so the number is not anchored by whoever quoted first.',
    who: 'A customer who has finished the quiz.',
    before: 'The quiz.', after: 'Their matches.',
    needs: 'A completed brief in the session.',
  },
  {
    flow: '01-customer', n: 3, path: '/match', name: 'match',
    title: 'Who fits, and why',
    does: 'Studios scored against the brief, each card showing the reason it matched and work that backs it. Cards open on scroll; verification ticks appear beside the projects in glass frames. Nobody can pay to sit higher, and the page says so.',
    who: 'A customer with a brief.',
    before: 'The tier estimate.', after: 'Quotes.',
    needs: 'A brief and studios with rate cards.',
  },
  {
    flow: '01-customer', n: 4, path: '/quotes', name: 'quotes',
    title: 'The quotes arrive',
    does: 'Generated from each studio\'s own rate card in about three seconds. No studio is asked, nobody is phoned. Line items carry quantity and spec, not a single lump sum.',
    who: 'A customer.', before: 'Matches.', after: 'Comparing them.',
    needs: 'A brief plus studios with rate cards — without those this is an empty state.',
  },
  {
    flow: '01-customer', n: 5, path: '/compare', name: 'compare',
    title: 'Side by side, and the materials behind them',
    does: 'The quotes next to each other AND what each is actually made of — carcass, shutter, hardware. Tap any material to see what it means. This is where a cheaper quote stops looking cheaper.',
    who: 'A customer choosing.', before: 'Quotes.', after: 'Asking for an architect.',
    needs: 'At least two quotes.',
  },
  {
    flow: '01-customer', n: 6, path: '/expert', name: 'expert',
    title: 'Talk to an architect',
    does: 'Requesting the person who reads the quotes with them. Named, with their background — not a call centre.',
    who: 'A customer who wants a second opinion.',
    before: 'Comparing.', after: 'The prep pack.',
    needs: 'Nothing to render the form.',
  },
  {
    flow: '01-customer', n: 7, path: '/prepare', name: 'prepare',
    title: 'Before the call',
    does: 'Three things to have ready: the floor plan, the rooms that matter, and what has already been decided. So the call starts at the real question.',
    who: 'A customer with a consultation booked.',
    before: 'Requesting an architect.', after: 'The call.',
    needs: 'A consultation request.',
  },
  {
    flow: '01-customer', n: 8, path: '/account', name: 'account',
    title: 'Their account',
    does: 'Their brief, their quotes, their consultations, and what we hold about them.',
    who: 'A returning customer.', before: 'Signing in.', after: 'Anywhere.',
    needs: 'A signed-in customer.',
  },
  {
    flow: '01-customer', n: 9, path: '/shared/demo', name: 'shared-quote',
    title: 'A quote shared with someone else',
    does: 'The read-only view when a customer sends a quote to a partner or parent. No account needed, and the link can be revoked.',
    who: 'Whoever the customer sent it to.',
    before: 'A shared link.', after: 'Nothing — it is a leaf.',
    needs: 'A real share token. Expect the not-found state unless you have one.',
  },

  // ── 02 · The studio practice software ─────────────────────────
  ...['profile', 'registration', 'portfolio', 'rates', 'review'].map((step, i) => ({
    flow: '02-studio', n: 1 + i, path: `/studio/onboarding/${step}`, name: `onboarding-${i + 1}-${step}`,
    title: `Onboarding ${i + 1} of 5 — ${step}`,
    does: {
      profile: 'How they describe themselves, and where they work. The words a customer reads first.',
      registration: 'GSTIN and registration numbers, checked against public records. Has an escape hatch — a practice without a GSTIN is not turned away at the door.',
      portfolio: 'Three completed projects. This is what customers actually read, and it is the step with no escape hatch — a genuinely new practice stops here.',
      rates: 'Their rate card. Private, never shown to anyone but them, and the thing every quote is generated from.',
      review: 'Send it to us. Then we check the registration, ring two past clients, and visit two finished sites.',
    }[step],
    who: 'An approved studio, working through about forty minutes of setup.',
    before: i === 0 ? 'The approval email and setting a password.' : `Step ${i}.`,
    after: i === 4 ? 'Our verification, then going live.' : `Step ${i + 2}.`,
    needs: 'A signed-in studio account still in ONBOARDING.',
  })),
  {
    flow: '02-studio', n: 6, path: '/studio', name: 'dashboard',
    title: 'The studio dashboard',
    does: 'What needs doing today — leads waiting, quotations to send, where each project stands. The morning screen.',
    who: 'A studio owner.', before: 'Signing in.', after: 'Wherever the work is.',
    needs: 'A signed-in, active studio.',
  },
  {
    flow: '02-studio', n: 7, path: '/studio/clients', name: 'clients-board',
    title: 'Leads and clients',
    does: 'Every enquiry on a board with columns the studio defines themselves. A brand-new studio finds one sample lead here, clearly marked, removable, and excluded from every count.',
    who: 'A studio owner and their team.',
    before: 'The dashboard.', after: 'A client record, or a quotation.',
    needs: 'A signed-in studio. The sample lead seeds itself on an empty board.',
  },
  {
    flow: '02-studio', n: 8, path: '/studio/clients/import', name: 'clients-import',
    title: 'Bring your existing clients',
    does: 'CSV import, so a studio joining does not start from an empty board with a spreadsheet open beside it.',
    who: 'A studio in their first week.', before: 'The board.', after: 'A full board.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 9, path: '/studio/clients/bin', name: 'clients-bin',
    title: 'The bin',
    does: 'Deleted clients, restorable for 30 days. Deleting a lead by accident should not be permanent.',
    who: 'A studio owner.', before: 'Deleting something.', after: 'Restoring it.',
    needs: 'A signed-in studio. Empty unless something was deleted.',
  },
  {
    flow: '02-studio', n: 10, path: '/studio/projects', name: 'projects',
    title: 'Projects',
    does: 'Work that has been won, and where each one stands.',
    who: 'A studio owner.', before: 'A client converting.', after: 'A project record.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 11, path: '/studio/work', name: 'work',
    title: 'The work pool',
    does: 'Tasks across projects and who they are assigned to.',
    who: 'A studio with a team.', before: 'The dashboard.', after: 'Assigning something.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 12, path: '/studio/quotations', name: 'quotations',
    title: 'Quotations',
    does: 'Every quotation the studio has raised, and its state.',
    who: 'A studio owner.', before: 'The dashboard.', after: 'One quotation.',
    needs: 'A signed-in studio. Empty state unless quotations exist.',
  },
  {
    flow: '02-studio', n: 13, path: '/studio/products', name: 'products',
    title: 'The product master',
    does: 'What they build and what it costs them. New studios start from a neutral starter set rather than a blank table.',
    who: 'A studio owner.', before: 'Setting up.', after: 'Quotations that price themselves.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 14, path: '/studio/rates', name: 'rates',
    title: 'Rates',
    does: 'The rate card every generated quote comes from. Theirs to change, and private.',
    who: 'A studio owner.', before: 'Onboarding step 4.', after: 'Live quotes.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 15, path: '/studio/vendors', name: 'vendors',
    title: 'Vendors',
    does: 'Who they buy from, and on what terms.',
    who: 'A studio owner.', before: 'The product master.', after: 'Costing.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 16, path: '/studio/calendar', name: 'calendar',
    title: 'Calendar',
    does: 'Site visits, client meetings, and the consultations we have introduced.',
    who: 'A studio owner.', before: 'The dashboard.', after: 'A meeting.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 17, path: '/studio/profile', name: 'profile',
    title: 'Their profile',
    does: 'Editing what customers read. Every word is theirs to approve before it goes live.',
    who: 'A studio owner.', before: 'Onboarding.', after: 'Their public listing.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 18, path: '/studio/listing', name: 'listing',
    title: 'How they appear to customers',
    does: 'Their own listing as a customer sees it, plus where they stand on each of the twelve checks.',
    who: 'A studio owner.', before: 'Their profile.', after: 'Fixing whatever is missing.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 19, path: '/studio/settings', name: 'settings',
    title: 'Settings — branding',
    does: 'Their logo and colours, which go onto the quotation PDF. The quote a client receives looks like the studio sent it, because they did.',
    who: 'A studio owner.', before: 'Anywhere.', after: 'A branded quote.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 20, path: '/studio/settings/pipeline', name: 'settings-pipeline',
    title: 'Settings — pipeline',
    does: 'The columns on their board, named and coloured by them. Every practice runs differently and the software should not argue.',
    who: 'A studio owner.', before: 'Settings.', after: 'A board that fits.',
    needs: 'A signed-in studio.',
  },
  {
    flow: '02-studio', n: 21, path: '/studio/settings/fields', name: 'settings-fields',
    title: 'Settings — custom fields',
    does: 'Extra fields on a client record, for whatever this studio tracks that we did not think of.',
    who: 'A studio owner.', before: 'Settings.', after: 'Richer records.',
    needs: 'A signed-in studio.',
  },

  // ── 03 · The ops console ──────────────────────────────────────
  {
    flow: '03-ops', n: 1, path: '/ops', name: 'ops-home',
    title: 'The console',
    does: 'What needs your attention: applications waiting, verifications in progress, consultations to staff.',
    who: 'You.', before: 'Signing in.', after: 'Whichever queue is longest.',
    needs: 'An ops account. DEV_OPS_NO_AUTH=1 opens it locally.',
  },
  {
    flow: '03-ops', n: 2, path: '/ops/applications', name: 'ops-applications',
    title: 'Who has applied',
    does: 'Every application, with a button that reads their website and shows what it claims — labelled as claims, never as evidence. Approve creates the studio and emails them a sign-in link; reject requires a reason.',
    who: 'You.', before: 'A studio applying.', after: 'Verification.',
    needs: 'Applications in the database — npm run db:seed creates some.',
  },
  {
    flow: '03-ops', n: 3, path: '/ops/verification', name: 'ops-verification',
    title: 'Verification',
    does: 'The twelve checks per studio and where each one stands. What has been proven, by whom, and when.',
    who: 'You.', before: 'A studio submitting.', after: 'Going live.',
    needs: 'Studios in verification.',
  },
  {
    flow: '03-ops', n: 4, path: '/ops/northlight-studio', name: 'ops-studio-detail',
    title: 'One studio, everything we know',
    does: 'Legal name, GSTIN, our own private assessment, their history with us. Not shown to anyone else, ever.',
    who: 'You.', before: 'Any list.', after: 'A decision.',
    needs: 'A studio with that slug.',
  },
  {
    flow: '03-ops', n: 5, path: '/ops/allocation', name: 'ops-allocation',
    title: 'Allocation',
    does: 'How many briefs each studio is seeing, and the controls that shape it.',
    who: 'You.', before: 'The console.', after: 'A fairer spread.',
    needs: 'Active studios.',
  },
  {
    flow: '03-ops', n: 6, path: '/ops/introductions', name: 'ops-introductions',
    title: 'Introductions',
    does: 'Which customer was introduced to which studio, when, and what came of it.',
    who: 'You.', before: 'A customer choosing.', after: 'Recording the outcome.',
    needs: 'Introductions in the database.',
  },
  {
    flow: '03-ops', n: 7, path: '/ops/consultations', name: 'ops-consultations',
    title: 'Consultations',
    does: 'Architect calls requested and booked, each with the prep pack the customer filled in.',
    who: 'You and the architects.', before: 'A customer asking.', after: 'The call.',
    needs: 'Consultation requests.',
  },
  {
    flow: '03-ops', n: 8, path: '/ops/funnel', name: 'ops-funnel',
    title: 'The funnel',
    does: 'Where people arrive, where they stop, and how many get through each step.',
    who: 'You.', before: 'The console.', after: 'Knowing what to fix.',
    needs: 'Analytics events. Thin on a fresh database.',
  },
  {
    flow: '03-ops', n: 9, path: '/ops/data', name: 'ops-data',
    title: 'Export',
    does: 'Getting the data out in a shape you can think in, rather than reading it through a dashboard somebody else designed.',
    who: 'You.', before: 'A question the console does not answer.', after: 'A spreadsheet.',
    needs: 'An ops account.',
  },
];

export const BY_FLOW = Object.keys(FLOWS).map((key) => ({
  key,
  ...FLOWS[key],
  routes: ROUTES.filter((r) => r.flow === key).sort((a, b) => a.n - b.n),
}));
