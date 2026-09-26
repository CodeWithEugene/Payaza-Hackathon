# info.md — Borderless Kenya Hackathon: Complete Information

> **Source of truth for everything about the hackathon itself.**
> Captured from https://hackathon.payaza.africa/ (homepage + /register) on **Saturday 26 September 2026**.
> Every fact below was extracted directly from the live site unless marked otherwise.

---

## ⚠️ CRITICAL TIMELINE FACT

**IDEA SUBMISSIONS CLOSE TODAY: Saturday, 26 September 2026 at 11:59 PM EAT (Nairobi time).**

This document was compiled on the morning of the deadline. Everything else in this repo
(research → solution → build) is sequenced so the idea submission can go in **tonight**,
and the working prototype/demo follows in the build phase after registration.

---

## 1. Event Identity

| Field | Value |
|---|---|
| **Name** | Borderless Kenya |
| **Full title** | Borderless Kenya · Payaza × Hackhouse Hackathon |
| **Tagline** | "Solving cross-border payments for East African trade." |
| **Site** | https://hackathon.payaza.africa/ |
| **Registration** | https://hackathon.payaza.africa/register |
| **Location** | Hackhouse Nairobi, Kenya (Hackhouse Africa, 124 Manyani East Road, Nairobi) |
| **Format** | Teams of 3–5 members (register page enforces minimum 3; footer says "2–5" — see Gotchas §10) |
| **Idea deadline** | Saturday 26 September 2026, 11:59 PM EAT |
| **Copyright** | © 2026 Payaza. All rights reserved. |

**Positioning statement (verbatim from site):**
> "Payaza brings a real problem and live payment infrastructure. Hackhouse Nairobi brings the
> builders. Africa Tech Academy backs the event. The goal is a working prototype with a
> credible path to becoming a real product, not a weekend demo."

Key phrase to internalize: **"a working prototype with a credible path to becoming a real
product, not a weekend demo."** Judging rewards shipping credibility over flash.

---

## 2. Organizers ("Presented by")

### 2.1 Payaza (title organizer — brings the problem + live payment infrastructure)
- Pan-African payments company (Payaza Africa Limited).
- Developer docs: **https://docs.payaza.africa/** — "The Payaza developer docs are the place to start."
- Business dashboard: https://business.payaza.africa
- Socials: https://twitter.com/mypayaza · https://www.instagram.com/mypayaza/ · https://www.linkedin.com/company/payaza-africa/
- Full company/platform research → see `docs/research.md` §3–4.

### 2.2 Hackhouse Nairobi (community host — "brings the builders")
- Hackhouse Africa: "Home to Africa's boldest builders" — coworking + founder community at
  124 Manyani East Road, Nairobi. 5,450+ builders supported, 400+ events, 40+ companies in
  residence, running since Startinev 2020. Runs the 12-week Hackhouse Residency (Spark/Scale)
  and partner programs (Red Bull Basement, US Embassy Nairobi, Aiducation International).
- Contact: info@hackhouseafrica.com · +254 722 717 770
- Co-sponsor of prizes: "Cash prizes for the top three teams, split between Payaza and Hackhouse."

### 2.3 Africa Tech Academy ("backs the event")
- Named backer/endorser; no site linked from the hackathon page (logo only).

---

## 3. Deadlines & Timeline

| Milestone | When | Status |
|---|---|---|
| Idea submissions close (register team + describe idea + presentation link) | **Sat 26 Sept 2026, 11:59 PM EAT** | ⏳ TODAY — hours left |
| Working prototype build phase | After registration (dates communicated to registered teams) | Upcoming |
| Demos / judging | At/after Hackhouse Nairobi event (per site: short demo per team) | Upcoming |
| Prize announcement + pilot pathway conversations | "After the event" | Upcoming |

The homepage runs a live countdown ("Days / Hours / Mins / Secs") to
"Closes Sat 26 Sept, 11:59 PM Nairobi time (EAT)".

---

## 4. What Must Be Submitted (from the /register form)

The registration form is the **idea submission**. Exact fields:

### 4.1 Team block
1. **Team name** (text)
2. **Link to presentation (slides or video)** (URL) — *required at submission, so a slide deck or video must exist by tonight*
3. **Your idea** (long text) — the idea description; this is scored against the five criteria

### 4.2 Member blocks (3 minimum, 5 maximum — "Add member (3/5)")
Per member:
- First name
- Last name
- Email address
- Phone number
- **Role** (select one of exactly these 7):
  1. Product Manager
  2. Frontend Developer
  3. Backend Developer
  4. UI/UX Designer
  5. Data Scientist
  6. Data Analyst
  7. Software Engineer (ML/AI)
- LinkedIn profile

Submission note on the page: "We'll use these details to get in touch with your team.
Submissions close Saturday, 26 September at 11:59 PM EAT."

**Implication:** the role list hints at what a "complete" team looks like to the organizers
(product, frontend, backend, design, data/ML). Our submission should cover complementary roles.

---

## 5. The Challenge (verbatim structure)

**Section 01 — The challenge: "Five places where money still stops at the border."**

> "Pick one. Each is a Kenya-specific problem where Payaza's multi-market cross-border
> infrastructure is a natural fit. Build for the person who feels it every week."

**Rule: you must pick exactly ONE of the five problem areas.** FAQ: "Do we have to pick one
of the five problems? **Yes.** Your build should address one of the five problem areas.
Problem fit is the first thing every build is scored on, so generic fintech ideas will struggle."

### The five problems

| # | Problem | Description (verbatim) | Named persona |
|---|---|---|---|
| 01 | **Cross-border trade inside the EAC** | "Traders moving goods between Kenya, Uganda, Tanzania and Rwanda juggle multiple currencies, slow settlement and patchwork licensing." | Cross-border trader |
| 02 | **Gig and creator payouts** | "Kenyan freelancers on global platforms lose real value to FX spreads and payout delays before the money reaches them." | Freelancer / creator |
| 03 | **SME and exporter collections** | "Small exporters in agriculture, crafts and digital services struggle to collect from international buyers without expensive intermediaries." | SME exporter |
| 04 | **Mobile money interoperability** | "M-Pesa dominates at home but does not connect cleanly to international rails or to other African wallets." | Mobile money user |
| 05 | **Remittance cost and speed** | "Diaspora-to-Kenya transfers are still expensive and slow on the classic corridors." | Diaspora family |

### Corridors in scope (from hero panel)

| Corridor | Pair | Market |
|---|---|---|
| NBO → KLA | KES → UGX | Uganda |
| NBO → DAR | KES → TZS | Tanzania |
| World → NBO | USD → KES | Diaspora & global |
| NBO → KGL | KES → RWF | Rwanda |

(EAC label covers Kampala/Kigali/Dar; WORLD covers inbound USD to Nairobi.)

### "Build on Payaza rails, not a mock." (verbatim section)
> "Read the developer docs ↗" (links to https://docs.payaza.africa/)

The three named capability pillars:

| Pillar | Site copy (verbatim) |
|---|---|
| **Checkout** | "Collect from buyers and customers across markets." |
| **Settlement** | "Get funds to where the merchant actually needs them." |
| **Multi-currency** | "Price, receive and pay out across East African currencies." |

Ambient ticker themes: `KES → UGX`, `M-Pesa ⇄ international rails`, `KES → TZS`, `Checkout`,
`USD → KES`, `KES → RWF`, `Settlement`, `Exporter collections`, `Multi-currency`, `Creator payouts`.

---

## 6. Judging Criteria (Section 02 — "How every build is scored")

> "Same five criteria for every team. **A slick demo that ignores the real user, or uses
> Payaza only on the surface, will not place.**" (verbatim — this is the anti-pattern warning)

| # | Criterion | Verbatim definition |
|---|---|---|
| 1 | **Problem fit** | "Addresses a real cross-border trade-friction problem, not a generic fintech idea." |
| 2 | **Use of Payaza infrastructure** | "Meaningfully uses Payaza rails (checkout, settlement, multi-currency) rather than bolting them on." |
| 3 | **Feasibility** | "Could plausibly become a real product, or at least a pilot, within a few months." |
| 4 | **User experience** | "Usable by the actual target user (trader, freelancer, SME owner), not just a technical proof of concept." |
| 5 | **Presentation** | "The team explains the problem, the solution and the business case clearly in a short demo." |

Weighting is not published; ordering in the list and the FAQ ("Problem fit is the first thing
every build is scored on") suggest priority order as listed.

---

## 7. Prizes & Pathway (Section 03 — "Win cash. Then build it for real.")

> "Cash prizes for the top three teams, split between Payaza and Hackhouse, plus a route from
> prototype to pilot."

| Place | Prize |
|---|---|
| 01 Winner | **$1,000** |
| 02 1st runner-up | TBA |
| 03 2nd runner-up | TBA |

**After the event · 1 — Pilot pathway (verbatim):**
> "The top team gets a structured conversation about piloting their build with real Payaza
> merchants or partners."

**After the event · 2 — Community access (verbatim):**
> "Winners and standout teams join the Payaza developer Slack and are considered for future
> hackathons and events."

**Strategic read:** the pilot pathway is arguably worth more than the cash — a real pilot with
Payaza merchants is a route to a product. Feasibility + merchant-credible design should be
optimized for this prize specifically (see `docs/research.md` §9 decision analysis).

---

## 8. FAQ (Section 04 — verbatim Q&A)

**What is Borderless Kenya?**
A hackathon run by Payaza with Hackhouse Nairobi and Africa Tech Academy. Teams build working
prototypes that fix cross-border payment problems in East African trade, using Payaza's
payment infrastructure.

**When is the deadline to submit ideas?**
Idea submissions close on Saturday, 26 September at 11:59 PM Nairobi time (EAT). Register your
team and describe your idea before then.

**Who can take part?**
Developers, designers, product managers and data people. You register as a team of 3 to 5
members.

**Do we have to pick one of the five problems?**
Yes. Your build should address one of the five problem areas. Problem fit is the first thing
every build is scored on, so generic fintech ideas will struggle.

**Will we get access to Payaza's APIs?**
Yes. Registered teams build on Payaza's payment infrastructure, including checkout,
settlement and multi-currency. The Payaza developer docs are the place to start.

**What happens after the hackathon?**
The top three teams win cash prizes. The top team also gets a pilot conversation with Payaza
merchants or partners, and standout teams join the Payaza developer community.

---

## 9. Registration Checklist (site's own, verbatim)

- ✓ Submit your idea by Sat 26 Sept, 11:59 PM EAT
- ✓ 3–5 members per team
- ✓ Pick one of the five cross-border problems
- ✓ Build on Payaza checkout, settlement or multi-currency

Footer CTA block:
- "Ideas due Sat 26 Sept" / "**Bring a team of 2–5.**" / "Build something that could ship." /
  "Register & submit your idea"

---

## 10. Gotchas, Ambiguities & Fine Print (observed, not stated)

1. **Team size conflict:** hero checklist + FAQ + register form say **3–5**; the footer CTA
   says **"Bring a team of 2–5."** The register UI enforces a minimum of 3 members
   ("Register team (3 members)", "Add member (3/5)"). **Safe assumption: 3–5.**
2. **Presentation link is due WITH the idea tonight** — "Link to presentation (slides or
   video)" is part of the registration form, not a later deliverable. A deck (or video) must
   be ready by 11:59 PM EAT today.
3. **Year is not printed** on the deadline anywhere — but the site footer says "© 2026 Payaza"
   and 26 Sept 2026 is a Saturday, consistent with "Sat 26 Sept". Deadline = **26 Sept 2026**.
4. **"Build on Payaza checkout, settlement OR multi-currency"** (registration checklist) vs
   judging criterion "meaningfully uses Payaza rails (checkout, settlement, multi-currency)"
   — one rail deeply beats three rails shallowly, but covering several coherently scores best
   on criterion 2.
5. **Rwanda corridor (KES→RWF) is listed on the site, but Payaza's public docs document no
   RWF rail** (no RWF collections or payouts in docs.payaza.africa). Teams choosing the Rwanda
   corridor may have to request special access or mock it. Verified against docs — see
   `docs/research.md` §4.7. This is a trap for track 1 ideas that lean on Rwanda.
6. **Non-Nigeria collections are "available on request only"** per docs (email
   support@payaza.africa) — but the hackathon FAQ promises registered teams API access to
   checkout/settlement/multi-currency. Expect an access-granting step after registration;
   build so that Kenya rails (M-Pesa) work first.
7. **Live transfers require IP whitelisting + a 6-digit transaction PIN + PND lift** (docs).
   Sandbox/test mode does not — demo on `X-TenantID: test`.
8. The site is a static Nuxt SSR app with anchors only (`#challenge`, `#criteria`, `#prizes`,
   `#faq`) plus `/register` — there are no hidden rules pages. Everything above is the
   complete public rule set. Any further details (event date, demo day format, API key
   distribution) come to registered teams by email/Slack.

---

## 11. All Links Referenced by the Site

| Purpose | URL |
|---|---|
| Hackathon home | https://hackathon.payaza.africa/ |
| Register / submit idea | https://hackathon.payaza.africa/register |
| Payaza developer docs | https://docs.payaza.africa/ |
| Payaza business dashboard | https://business.payaza.africa |
| Payaza Twitter/X | https://twitter.com/mypayaza |
| Payaza Instagram | https://www.instagram.com/mypayaza/ |
| Payaza LinkedIn | https://www.linkedin.com/company/payaza-africa/ |
| Payaza support (API access requests) | support@payaza.africa |
| Payaza integration support | integrationsupport@payaza.africa |
| Payaza developer community Slack | https://payaza-community.slack.com/ (from docs) |
| Payaza Discord | https://discord.gg/976qrMNF6 (from docs) |
| Status page | https://status.payaza.africa/ (from blog footer) |

---

## 12. What "Winning" Requires (synthesis)

From the verbatim material, a winning submission/demo must:

1. **Pick one problem** and address the *named persona* who "feels it every week" — with
   concrete, quantified friction (not a generic fintech app).
2. **Use Payaza rails meaningfully** — the flow should be impossible without Payaza;
   "bolting on" a Payaza button is explicitly called out as losing behavior.
3. **Be pilot-plausible in months** — real business case, compliance awareness, KYC story,
   unit economics; this is what the top-team pilot conversation will probe.
4. **Be usable by the actual target user** — a trader/freelancer/SME owner with a mid-range
   Android phone, not a developer. Mobile-first, low-literacy-tolerant UX.
5. **Present clearly in a short demo** — problem → solution → business case, rehearsed,
   with live money movement on Payaza sandbox if possible.

Our complete response to all five: `docs/solution.md` (the product) and `docs/build.md`
(the engineering plan). Research backing every claim: `docs/research.md`.
