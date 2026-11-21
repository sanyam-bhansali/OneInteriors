# The client agreement, e-signed at design closure

Owner, 21 Nov 2026. The studio's agreement with its client is **kept apart from the
quotation**: quotations keep the studio's Terms; the agreement is signed by the client with
**Aadhaar eSign at design closure**. **Only the client signs**; the studio's side is printed as
signed by the person named in Settings. Max studios (full software).

Code: `src/modules/agreement/` — `rules.ts` (pure: placeholders, filling, checks),
`pdf.ts` (the PDF, pdf-lib), `provider.ts` (the eSign provider slot), `store.ts`.
Tests: `tests/client-agreement.test.ts`, `tests/client-agreement-db.integration.test.ts`
(local PGlite only).

## The template (Settings → Client agreement)

The owner writes it once, in the Terms' light markup (`## Title`, `### Heading`, `* point`,
two spaces before `*` for a sub-point, `**bold**`), with placeholders filled per client:

| Placeholder | Filled with |
|---|---|
| `{{client_name}}` | The client's full name (as on Aadhaar) |
| `{{client_relation}}` | Optional, carries its own comma: "daughter of Ramesh Shah, " or nothing |
| `{{client_address}}` | The client's residential address |
| `{{client_pan}}` | Optional: ", PAN ABCDE1234F" or nothing |
| `{{site_address}}` | The project site |
| `{{agreement_date}}` | The date it is made, e.g. 21 November 2026 |
| `{{design_quotation}}` | The Design Final's number |
| `{{studio_signatory}}`, `{{studio_signatory_role}}` | Who signs for the studio |

An unknown placeholder is refused on save and blocks sending. Up to 60,000 characters.

## At design closure (project → Design tab → Client agreement)

The owner, PM or the project's designer (`design.close`), once the Design Final exists:

1. checks the client's details (prefilled from the Design Final: name, society, locality);
2. **Preview PDF** — the filled agreement, A4, the studio's side signed (`₹` prints as `Rs.`);
3. **Send for eSign** — stored, handed to the provider; the client gets a notice and signs in the
   app (`/app/agreement`, Expo `agreement` screen) with an Aadhaar OTP. A newer send replaces
   one still waiting; once signed, it cannot be sent again;
4. signed: the provider's redirect (`/api/esign/<provider>/return`) or webhook
   (`/api/esign/<provider>/webhook`) makes us **ask the provider** for the result (never trusting
   the call itself); the signed PDF files in the client's **Locker** as "Agreement (signed)",
   the studio is told. Filing happens once even if both arrive.

**Signed elsewhere?** The studio can upload a signed PDF; it files in the Locker the same way.
Until a provider is connected this is the only way to record a signature.

## Connecting the eSign provider (to do: owner chooses)

Not chosen yet (Setu and Cashfree publish APIs with a sandbox; Leegality and Digio are
contract-based). To connect one: a file implementing `EsignProvider` in `provider.ts`
(`createRequest`, `fetchResult`, `verifyWebhook`, `requestIdFromWebhook`), a line in
`PROVIDERS`, its keys in Vercel (never in a file) and `ESIGN_PROVIDER=<id>`. Until then
"Send for eSign" is off and says why. `ESIGN_PROVIDER=test` is a local-only stand-in
(refused in production) used by the tests.

## Before release (owner)

1. Run migration `20261121120000_client_agreement` (prod-migrate worktree).
2. Settings → Client agreement: paste the agreement (with placeholders) and name the signatory.
