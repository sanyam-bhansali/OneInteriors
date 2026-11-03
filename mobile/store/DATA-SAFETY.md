# Data safety (Google Play) and privacy labels (App Store)

Prepared 3 Nov 2026 from the code, for Sanyam to check before submitting. Answers describe the project app (`EXPO_PUBLIC_PROJECTS_ONLY=1`).

## General answers

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Collects: yes. Shares with third parties for their own use: **no**. |
| Is data encrypted in transit? | Yes (HTTPS to app.oneinteriors.in). |
| Can users ask for their data to be deleted? | Yes: in the app (Me → Delete my account) and at https://app.oneinteriors.in/app/delete-account |
| Ads | None. No advertising SDK in the app. |
| Tracking (Apple ATT) | No tracking. The app does not link data with other companies' data for ads. |

## Data collected

| Data type (store wording) | Collected | Why | Linked to the user | Optional |
|---|---|---|---|---|
| Name | Yes | Account, shown to your studio | Yes | No |
| Phone number | Yes | Sign-in, your studio reaches you | Yes | No |
| Email address | Only if given | Receipts and notices | Yes | Yes |
| Photos | Yes, ones you choose to send | Snags, chat, GEIO photo check | Yes | Yes |
| Audio (voice notes) | Yes, ones you record | Chat with your designer and home team | Yes | Yes |
| Messages (in-app chat) | Yes | Chat with your studio | Yes | No (part of the service) |
| Other user content | Yes | Decision choices, requirement form, snag notes, sign-offs | Yes | No |
| Device or other IDs | Yes: push notification token | Notifications | Yes | Yes (can be refused) |
| App interactions | Notifications read, coins earned | App function | Yes | No |
| Financial info | **No.** Payments are recorded by your studio; the app takes no card, UPI or bank details. | — | — | — |
| Location | **No** GPS. The home's locality is part of the project, typed by the studio. | — | — | — |

Face ID / fingerprint: checked on the phone by the operating system; nothing leaves the phone. Not collected.

## Who processes it (service providers, not "sharing")

- Supabase (database and file storage, Mumbai)
- Vercel (hosting, Mumbai)
- Anthropic (GEIO answers, for Assured plans: the question, the project facts it needs, and a photo if you attach one)
- Expo (delivering push notifications)
- Resend (email)

These match the privacy policy once the app section (PRIVACY-APP-SECTION.md) is added; Anthropic and Expo are not in today's policy.
