# Lead intake: leads that come in by themselves

Built 21 Oct 2026. A studio's CRM receives leads automatically from Meta lead
ads (Facebook and Instagram), Google Ads lead forms, its own website, and
portals or WhatsApp tools through a generic webhook. Every studio has it (Pro),
not only Max.

Every lead lands exactly like a public enquiry form submission, through one
shared function (`src/modules/studio-practice/land.ts`, `landLead`):

- in the studio's intake column (seeded with the default columns if the board
  was never opened), in the **pool** (nobody assigned), with **"Call them back"
  due today**;
- **one person, one lead**: if the phone (normalised to ten digits, as the
  enquiry form does) is already on the board and not in the bin, a line goes on
  that lead's timeline instead of a second card;
- a `CREATED` (or `NOTE`) event on the timeline, and the owner and PMs told
  (inbox and email), or the assigned person for an existing lead;
- the customer is never messaged by One Interiors.

## Endpoints

All `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, on the studio host:
`https://studio.oneinteriors.in`. The apex `oneinteriors.in` is the waitlist (a
separate Vercel project) and never reaches this app, so webhooks must use the
studio host.

| Endpoint | Who posts | Auth | Answers |
|---|---|---|---|
| `POST /api/studio/intake/{connectionId}` | Website, portals, WhatsApp tools, Zapier, Pabbly, Make | The door's key: header `x-oi-key`, or `?key=`, or a `key` field | Inline. 200 `{ ok, status: landed / duplicate / test / already_received }`; 401 wrong key, 403 off, 404, 413, 422 nothing to call, 429 |
| `POST /api/studio/intake/google/{connectionId}` | Google Ads lead form webhook | `google_key` in the body = the door's key | 200 at once, lands in `after()`. 403 wrong key (so "Send test data" shows the failure) |
| `GET /api/studio/intake/meta` | Meta's subscription handshake | `hub.verify_token` = `META_VERIFY_TOKEN` | `hub.challenge`, else 403 |
| `POST /api/studio/intake/meta` | Meta `leadgen` webhook, every studio | `X-Hub-Signature-256` HMAC with `META_APP_SECRET` | Always 200; Graph fetch and landing in `after()` |

The generic endpoint sends CORS `*` (a website posts to it with `fetch`); a
plain HTML form post (form-encoded, `Accept: text/html`) gets a short thank-you
page instead of JSON.

### Generic payload

JSON, form-encoded or multipart; field names are matched loosely (case, spaces
and hyphens ignored), and `{ "lead": {...} }` or `{ "data": {...} }` is
unwrapped once:

| What | Names understood |
|---|---|
| Name | `name`, `full_name`, `customer_name`, `first_name` + `last_name` |
| Phone | `phone`, `mobile`, `phone_number`, `mobile_number`, `whatsapp`, `contact_number` |
| Email | `email`, `email_address` |
| City | `city` |
| Area | `locality`, `area`, `location`, `address` (a known Pune area becomes its slug; otherwise kept in the notes) |
| Society | `society`, `project`, `building`, `apartment` |
| Home | `bhk`, `config`, `property_type`, `flat_type` ("3 BHK flat" → `3 BHK`) |
| Budget | `budget`, `budget_range` (one amount → paise; a range stays in the notes) |
| Message | `message`, `notes`, `comments`, `requirement`, `query` |
| Source | `source`, `utm_source`, `lead_source`, `portal` |
| Campaign | `utm_campaign`, `utm_medium`, `utm_content`, `campaign`, `ad_name` (into the source note) |
| Your id | `id`, `lead_id`, `event_id`, `enquiry_id` |
| Test | `is_test: true` (recorded, not put on the board) |

Any other field is kept in the lead's notes as `Question: answer`. A lead needs
a working mobile number or an email; a wrong number is kept in the notes.

```bash
curl -X POST https://studio.oneinteriors.in/api/studio/intake/<connectionId> \
  -H 'content-type: application/json' -H 'x-oi-key: <key>' \
  -d '{"name":"Asha Patil","phone":"9876543210","locality":"Baner","bhk":"3 BHK","source":"99acres","lead_id":"P-1001"}'
```

### Google payload

`{ lead_id, google_key, is_test, form_id, campaign_id, user_column_data: [{ column_id, column_name, string_value }] }`.
Standard columns: `FULL_NAME`, `FIRST_NAME`, `LAST_NAME`, `PHONE_NUMBER`,
`EMAIL`, `CITY`, `POSTAL_CODE`, `STREET_ADDRESS`. Custom questions are placed by
their wording (budget, BHK, area) or kept in the notes.

**Test leads** (`is_test: true`, Google's "Send test data") are recorded as an
event, shown on Settings as "Test lead received (not put on your board)", and
**not landed**: a fake card in the pool would get rung. Each test gets its own
id, because Google reuses one id for every test.

### Meta

The webhook carries only ids: `entry[].id` (the Page) and
`changes[].value.leadgen_id` for `field: "leadgen"`. The studio is found by the
Page id (`StudioLeadConnection.metaPageId`, unique). The lead is then fetched:

`GET https://graph.facebook.com/v21.0/{leadgen_id}?fields=created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform`

with the Page's token in an `Authorization: Bearer` header (never in the URL).
`field_data` is mapped like the generic fields (`full_name`, `phone_number`,
`email`, `city`, custom questions); `platform` `ig` → `INSTAGRAM`, otherwise
`FACEBOOK`; campaign, ad set and ad names go into the source note.

A Page no studio has added is logged by Page id and dropped. A failure (no
token, Graph refused, Meta unreachable, `META_APP_SECRET` missing) is recorded
as a FAILED event with the reason, and the owner can press **Try again** on
Settings once it is fixed: Meta does not resend a lead we answered 200 for.

## Each lead once

`StudioLeadIntakeEvent` is unique on `(connectionId, externalId)`. Every lead is
claimed before it is landed; a retry hits the unique index:

- `LANDED` (a new lead) or `DUPLICATE` (added to the lead with that phone): never again;
- `FAILED`: the retry may take it again;
- `RECEIVED` (being worked on): left alone, unless stuck for ten minutes (a
  function stopped mid-`after()`), then the retry takes it over.

`externalId` is Meta's `leadgen_id`, `g:` + Google's `lead_id`, the generic
sender's own id, or `h:` + a hash of phone (else email, else name) and the
minute, so a double-posted form lands once. No payload is stored.

## Data

Migration `20261021100000_studio_lead_intake` (expand only; not applied to
production):

- `studio_lead_connections`: `studioId`, `kind` (`WEBSITE`, `GOOGLE_LEAD_FORM`,
  `PORTAL`, `META_PAGE`), `label`, `enabled`, `secretHash` (SHA-256 of a random
  `oik_…` key shown once; never the key), `metaPageId` (unique),
  `lastEventAt`, `eventCount`, `createdById`, `createdAt`.
- `studio_lead_intake_events`: `connectionId`, `externalId` (unique together),
  `status` (`RECEIVED`, `LANDED`, `FAILED`, `DUPLICATE`), `clientId`, `error`,
  `isTest`, `createdAt`, `updatedAt`.
- RLS enabled and forced on both, all revoked from `anon` and `authenticated`.

No new `ClientSource` values. Where a lead counts: website → `WEBSITE`; Meta →
`FACEBOOK` / `INSTAGRAM`; Google → the studio's own source name "Google lead
form" (made on first lead); a portal → `FACEBOOK` / `INSTAGRAM` / `REFERRAL`…
when its `source` names one of ours, else its `source` (or the door's label) as
one of the studio's own source names ("99acres"), up to the thirty-name limit.

## Environment (Vercel, production)

| Variable | What |
|---|---|
| `META_APP_SECRET` | The Meta app's secret, for `X-Hub-Signature-256`. Without it nothing from Meta is landed (each lead is recorded FAILED). |
| `META_VERIFY_TOKEN` | Any long random string; the same value is typed into the Meta app's webhook setup. |
| `STUDIO_META_PAGE_TOKENS` | JSON: `{ "<pageId>": "<page access token>" }`, or `{ "<pageId>": { "token": "<token>", "studio": "<studio slug>" } }` to tie a Page to one studio (recommended: a studio that adds a Page id first cannot then receive another studio's leads). |
| `STUDIO_HOST` | Already set; the addresses shown on Settings are built from it. |

Never commit or paste a token anywhere but Vercel's environment settings.

## Setup

### The platform owner, once (Meta)

1. In the Meta developer app (Business type) add the **Webhooks** product, object
   **Page**, callback `https://studio.oneinteriors.in/api/studio/intake/meta`,
   verify token = `META_VERIFY_TOKEN`; subscribe to the `leadgen` field.
2. Permissions: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`,
   `pages_manage_metadata`, `ads_management` (App Review for other businesses'
   Pages).
3. Set `META_APP_SECRET`, `META_VERIFY_TOKEN` in Vercel and redeploy.

### For each studio Page (Meta)

1. The studio adds a connection: **Settings → Lead sources → Connect a source →
   Facebook and Instagram lead ads**, with its Page ID (Page → About → Page
   transparency).
2. The studio gives the app access to the Page (Business Suite partner, or a
   Page admin logs in through the app). Get a long-lived Page access token.
3. Subscribe the app to the Page: `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`.
4. Add the Page to `STUDIO_META_PAGE_TOKENS` (with the studio slug) and redeploy.
5. Test with Meta's Lead Ads Testing Tool; the lead shows on Settings within a minute.

### Google Ads lead form

Connect a source → Google Ads lead form. In Google Ads: lead form asset → Lead
delivery → Webhook integration; paste the address and the key; "Send test data".

### Website

Connect a source → Your website. Use the `fetch` or plain `<form>` snippet shown
under "How to set it up". The key in a website's page is visible to anyone who
reads the page source, like the enquiry link; the rate limits (300 an hour from
one address, 600 an hour per door) and the duplicate check are the defence, and
"Make a new key" replaces it.

### Portals, WhatsApp tools, Zapier, Pabbly

Connect a source → A portal or tool. Point the tool's webhook at the address
with the key in `x-oi-key` (or `?key=`). Send `source` so the dashboard can say
which portal closes.

## Not verified

Nothing here has called Meta or Google. The Graph fetch, the signature and the
Google format follow Meta's and Google's documentation and AxLeads' live code;
the parsing and the rules are unit-tested (`tests/studio-intake.test.ts`). The
first real lead of each kind should be watched on Settings.
