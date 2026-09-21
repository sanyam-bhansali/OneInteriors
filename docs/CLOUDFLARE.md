# Moving DNS to Cloudflare

Why: on 21 Sep the site was unreachable from one network for hours while
serving `200` to everyone else. Vercel's newer anycast ranges
(`216.198.79.x`, `64.29.17.x`) could not be routed to, and nothing in the
codebase could have prevented it — the failure was a TCP handshake that never
completed, which happens before any application code exists.

Cloudflare puts a far more widely-peered network in front, caches the static
assets so the site is faster, and can serve a cached page if the origin is
ever unreachable.

**Work top to bottom. Every step has a check, and you do not move on until the
check passes.** Email is the thing that breaks in migrations like this, and it
breaks silently — you find out when a studio says they never got their link.

---

## What you have today

Captured from `ns71.domaincontrol.com` on 21 Sep. **Seven records.** All seven
must exist in Cloudflare before you change nameservers.

| Type | Name | Value | Proxy in Cloudflare |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | **Proxied** (orange) |
| CNAME | `www` | `297803bbeb1b2502.vercel-dns-017.com` | **Proxied** (orange) |
| CNAME | `studio` | `5e5f705692ae0e5c.vercel-dns-017.com` | **Proxied** (orange) |
| CNAME | `ops` | `5e5f705692ae0e5c.vercel-dns-017.com` | **Proxied** (orange) |
| CNAME | `send` | `send.forge.rmta.net` | **DNS only** (grey) ⚠️ |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCovPQVM+qrwTa3tefNRdgrWWGgHtdILd2wJo32J8nObQRDiVMA2WjT/CSv30gTcaD3USkGXBFdG/N+FbG8UKCM+Sxk37ZQawB4f/8iFDv4kHUgXYLvqHNJooBwNWNPRx1Gcm2k2lVupJj6KCE4AcTq+3ua+Bp6/z336TweJvb2yQIDAQAB` | n/a |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | n/a |

> ### ⚠️ `send` must stay grey-clouded
>
> That CNAME is Resend's sending infrastructure. Proxying it routes mail
> delivery through an HTTP proxy, which does not carry SMTP — **every outbound
> email stops**, including every studio sign-in link. Cloudflare sometimes
> defaults an imported CNAME to proxied. Check it explicitly.

---

## Two things this migration surfaced

Neither is caused by Cloudflare. Both are worth fixing while you are in here.

### There is no MX record. `hello@oneinteriors.in` cannot receive mail.

You can send *from* it — Resend handles that — but nothing can be delivered
*to* it. The studio welcome email ends:

> *"Reply to this email if anything is unclear. A person reads it."*

Right now that reply bounces. A studio's first attempt to talk to you fails
silently, and they conclude you are not real.

Fix it during this migration (Stage 6) with forwarding to your Gmail.

### DMARC reports go to GoDaddy, not to you.

`rua=mailto:dmarc_rua@onsecureserver.net` is GoDaddy's default address. You
have never seen a report about your own domain's mail. Repoint it in Stage 6.

---

## Stage 0 — Before you touch anything

- [ ] **0.1** Have open: Cloudflare (signed up, free plan), GoDaddy, Vercel,
      Resend.
- [ ] **0.2** Screenshot your GoDaddy DNS zone. If anything goes wrong this is
      what you restore from, and it costs ten seconds now.
- [ ] **0.3** Do this when you have a clear two hours. Nameserver propagation
      is usually minutes but can be hours, and you cannot rush it once started.

> **Nothing is irreversible.** Changing nameservers back to GoDaddy restores
> the old setup, at the cost of another propagation wait.

---

## Stage 1 — Add the site to Cloudflare

- [ ] **1.1** Cloudflare → Add a site → `oneinteriors.in` → **Free** plan.
- [ ] **1.2** Cloudflare scans and imports what it finds. **Do not trust the
      import.** It misses records regularly.
- [ ] **1.3 CHECK:** compare what it imported against the table above, line by
      line. Add anything missing by hand.
- [ ] **1.4 CHECK:** `send` shows a **grey** cloud, not orange. This is the
      one that stops email.
- [ ] **1.5 CHECK:** the `resend._domainkey` TXT value matches **character for
      character**. A truncated DKIM key fails every signature, and Resend will
      still show the domain as verified for a while.

---

## Stage 2 — SSL, before the switch

Set this **now**, while GoDaddy is still authoritative. If you switch
nameservers with the wrong mode, the site breaks the instant it propagates.

- [ ] **2.1** SSL/TLS → Overview → **Full (strict)**.

> ### Why this exact setting
>
> **Flexible** makes Cloudflare talk to Vercel over plain HTTP. Vercel
> redirects HTTP to HTTPS, Cloudflare follows it back to itself, and you get an
> infinite redirect loop — `ERR_TOO_MANY_REDIRECTS` on every page. It is the
> single most common way this migration fails.
>
> **Full (strict)** validates Vercel's certificate. Vercel always presents a
> valid one, so this is correct and safe.

- [ ] **2.2** SSL/TLS → Edge Certificates → **Always Use HTTPS: On**.
- [ ] **2.3** Leave **Automatic HTTPS Rewrites** on.

---

## Stage 3 — Change the nameservers

- [ ] **3.1** Cloudflare shows two nameservers, like `xxx.ns.cloudflare.com`.
      Copy both exactly.
- [ ] **3.2** GoDaddy → My Products → `oneinteriors.in` → **Nameservers** →
      Change → **I'll use my own nameservers** → paste both → Save.
- [ ] **3.3** Wait. Cloudflare emails you when it takes over, usually within
      minutes.
- [ ] **3.4 CHECK:**
  ```
  nslookup -type=NS oneinteriors.in 1.1.1.1
  ```
  Returns the Cloudflare nameservers, not `domaincontrol.com`.

---

## Stage 4 — Check the site, from more than your own machine

- [ ] **4.1 CHECK:** `studio.oneinteriors.in/apply` loads.
- [ ] **4.2 CHECK:** `ops.oneinteriors.in/sign-in` loads.
- [ ] **4.3 CHECK:** `oneinteriors.in` loads the waitlist.
- [ ] **4.4 CHECK:** no certificate warning anywhere.
- [ ] **4.5 CHECK:** **from a phone on mobile data**, not just your WiFi. Your
      network is the one that has been failing, so it is the least useful place
      to confirm a fix.

> **If you get a redirect loop:** SSL/TLS mode is Flexible. Set it to Full
> (strict) — Stage 2.1. It takes effect in seconds.
>
> **If you get a Cloudflare 522:** Cloudflare cannot reach Vercel. Check the
> apex A record still points at a Vercel IP, and that `studio`/`ops` CNAMEs are
> unchanged.

---

## Stage 5 — Email still works

**Do this before you onboard anyone.** Outbound email is how a studio gets in,
and the failure is silent.

- [ ] **5.1** Resend → Domains → `oneinteriors.in`.
- [ ] **5.2 CHECK:** DKIM and SPF both still **Verified**. If either has gone
      pending, a record did not come across — compare against the table above.
- [ ] **5.3 CHECK:** send yourself a real one. Request a sign-in link at
      `studio.oneinteriors.in/sign-in` with an address that has an account,
      and confirm it arrives.

> Resend can keep showing "Verified" from a cached check for a while after the
> records have actually broken. **The delivered email is the only proof.**

---

## Stage 6 — Fix the two things found above

### 6a. Make `hello@oneinteriors.in` receive mail

- [ ] **6.1** Cloudflare → **Email** → Email Routing → Enable.
- [ ] **6.2** It adds MX and SPF records itself. Let it.
- [ ] **6.3** Create a route: `hello@oneinteriors.in` → your Gmail.
- [ ] **6.4** Verify the destination address — Cloudflare emails you a link.
- [ ] **6.5 CHECK:** from a different account, email `hello@oneinteriors.in`
      and confirm it lands in Gmail.

> ### ⚠️ Read the SPF record it writes
>
> Cloudflare Email Routing adds its own SPF. If it **replaces** rather than
> merges with Resend's, outbound mail starts failing SPF and lands in spam.
> There must be exactly **one** SPF TXT record at the apex, and it must include
> both. Two SPF records is a hard failure in the spec, not a warning.
>
> After enabling, re-run Stage 5.3 and confirm a real email still arrives.

### 6b. See your own DMARC reports

- [ ] **6.6** Edit the `_dmarc` TXT record. Change
      `rua=mailto:dmarc_rua@onsecureserver.net` to
      `rua=mailto:hello@oneinteriors.in` — which now works, because of 6a.

---

## Stage 7 — Speed, now that Cloudflare is in front

This is the part that answers "it takes too long to load".

- [ ] **7.1** Speed → Optimization → **Brotli: On**.
- [ ] **7.2** Caching → Configuration → Browser Cache TTL: **4 hours**.
- [ ] **7.3** Caching → Tiered Cache → **On**. Free, and it means a Pune
      visitor is served from Pune rather than from a Vercel function in Mumbai.
- [ ] **7.4** Rules → Page Rules → add: `*oneinteriors.in/_next/static/*` →
      Cache Level: **Cache Everything**, Edge Cache TTL: **a month**.

> Those files are content-hashed — a new build produces new filenames — so
> caching them for a month is safe and never serves stale code.

- [ ] **7.5** **Do NOT enable Rocket Loader or Auto Minify.** Both rewrite
      JavaScript, and both break React hydration in ways that look like random
      bugs rather than like a proxy setting.

---

## Stage 8 — The offline fallback

- [ ] **8.1** Caching → Configuration → **Always Online: On**.

If Vercel is ever unreachable, a visitor sees the last cached copy of your
page instead of a browser error. Not everything works in that state — anything
needing the database will not — but a studio sees your site rather than
`ERR_CONNECTION_TIMED_OUT`.

---

## Rolling back

| Symptom | Fix |
| --- | --- |
| Redirect loop | SSL/TLS → **Full (strict)** |
| Cloudflare 522 | Origin unreachable — check the apex A and the two CNAMEs |
| Email stopped | `send` is orange-clouded. Make it grey. |
| Mail lands in spam | Two SPF records at the apex. There must be one. |
| Everything wrong | GoDaddy → Nameservers → back to `ns71`/`ns72.domaincontrol.com` |

Nothing here is destructive. The worst case costs another propagation wait.

---

## What this does not fix

Cloudflare makes the site reachable from far more networks and faster from
all of them. It does not make it impossible for a browser to fail to connect —
if somebody's network cannot route to Cloudflare either, they still see a
browser error, and no amount of code can intercept that.

What changes is the odds. Cloudflare is one of the most widely-reachable
networks in existence and has points of presence in India; Vercel's newer
ranges are neither as established nor as broadly peered.
