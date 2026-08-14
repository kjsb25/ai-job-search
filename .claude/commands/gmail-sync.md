# /gmail-sync - Sync Application Status from Gmail

You are scanning the user's Gmail for status signals on tracked job applications (interview invites, assessment links, offers, rejections) and, once approved, writing the detected changes into `job_search_tracker.csv` and `documents/applications/<company>_<role>/outcome.md` - the same two places `/outcome` writes to, in the same schema.

Unlike `/outcome` (which asks the user what happened), `/gmail-sync` classifies real emails on its own - but it never writes on its own. Every classified change is presented as a batch **before** anything touches the tracker or `outcome.md`, and only proceeds once the user approves it (approving the whole batch at once is fine; writing first and flagging it after is not). Because a wrong write silently corrupts application history that `/setup` later calibrates from, every proposed change must cite its source email and every uncertain case must be surfaced instead of guessed. Never treat this command's job as "notice something in an inbox" - it is "propose a correct, sourced line for a permanent record, and write it only once the user says yes."

`/gmail-sync` also runs a second, separate pipeline (Step 3.5): it mines **saved-search job alert digest emails** (e.g. LinkedIn's "Job Alert" emails) for brand-new postings you haven't seen yet, and feeds each one through the job-scraper skill's own dedup/fit/store logic - as if it were a `/scrape` CLI result. That pipeline writes only to `job_scraper/seen_jobs.json` (the same discovery cache `/scrape` writes to unconditionally), never to the tracker, so it does not go through the approval gate described above.

Follow these steps **in order**.

---

## Step 0: Prerequisites

Confirm the Gmail MCP tools (`mcp__claude_ai_Gmail__*`) are available. If not, tell the user to connect the Gmail integration (claude.ai Settings → Connectors → Gmail) and stop - do not attempt this via Bash, IMAP, or any other channel.

---

## Step 1: Parse Input

`$ARGUMENTS` may contain:

- Nothing → default lookback (see Step 3)
- A company name, e.g. `/gmail-sync acme` → scope the search to that one tracked application
- `since <YYYY-MM-DD>` → override the lookback start date for this run only (does not change the persisted state file)

---

## Step 2: Load State

1. Read `job_search_tracker.csv`. If it does not exist, tell the user there is nothing to sync against yet (suggest `/outcome` or `/apply` first) and stop. Do not create the file here. `/gmail-sync` updates existing applications rather than originating new ones, **with one deliberate exception: a detected rejection is always captured** (see Step 5), even for an application that was never tracked. A rejection is a terminal outcome and a data point `/setup` calibrates from, so it is worth recording regardless of whether the application went through `/apply`/`/rank`. This exception covers rejections only. Non-terminal signals (acks, interviews, offers) for untracked companies stay informational.
2. Read `gmail_sync/state.json` (create if missing: `{"last_sync": null, "last_alert_sync": null, "processed_message_ids": []}`). `last_sync` and `last_alert_sync` are tracked **separately** and gate different pipelines - see Step 3.5a for why - but `processed_message_ids` is a single shared set across both (a message only needs to be marked once, regardless of which pipeline handled it).
3. Build the set of **open applications**: tracker rows whose `status` is not a final value (`hired`, `rejected`, `no response`, `offer declined`, `withdrawn`). For each, derive its archive folder `documents/applications/<company>_<role>/` (lowercase, underscores - same convention as `/outcome`) and check whether `outcome.md` exists there.
4. If `$ARGUMENTS` named a company, filter this set to the matching row(s) (case-insensitive). No match → tell the user and stop, do not guess.

---

## Step 3: Build the Search Query

Lookback window: `since <date>` argument if given, else `state.last_sync` if set, else `newer_than:30d`.

1. Call `list_labels` and look for a user label whose name suggests job-search email (e.g. contains "job", "application", "career" case-insensitively). Note its `id` if found.
2. Normalize each open application's company name for matching later (lowercase; strip `inc`, `inc.`, `llc`, `ltd`, `a/s`, `corp`, `corporation`, `group`; strip punctuation; collapse whitespace).
3. Build a Gmail query combining (with `OR` groups via `{}`):
   - `label:<id>` if a job-search label was found
   - A quoted-name OR-group of the open applications' company names, e.g. `{"Acme Corp" "BigCo"}`
   - A sender-domain OR-group of common ATS platforms: `{from:greenhouse.io from:greenhouse-mail.io from:lever.co from:myworkday.com from:workday.com from:ashbyhq.com from:smartrecruiters.com from:icims.com from:bamboohr.com from:rippling.com from:jobvite.com from:workable.com from:pinpoint.email from:newtonsoftware.com from:mydeltek.com from:hrsmart.com}`
     - **Match the ATS's *sending* domain, not its marketing domain.** Several ATSes send application email from a domain distinct from their website, and Gmail's `from:` matches a domain plus its subdomains but **not** a different registered domain. The one that bites: Greenhouse sends from `greenhouse-mail.io` (e.g. `us.greenhouse-mail.io`), which `from:greenhouse.io` does **not** catch, so a Greenhouse acknowledgement/rejection for an untracked company is silently missed. Greenhouse (`greenhouse-mail.io`) and Rippling (`rippling.com` → `ats.rippling.com`) are both included above for this reason. So are: Workday's non-`myworkday.com` domains (`workday.com` catches OTP/notify subdomains like `otp.workday.com` that `myworkday.com` misses), Pinpoint (`pinpoint.email`, e.g. an interview invite from `kharon@pinpoint.email`), Newton/Paycor Recruiting (`newtonsoftware.com`, e.g. `echo.newtonsoftware.com`), and Deltek Talent Management (`mydeltek.com` → `dtm.mydeltek.com`, plus its `hrsmart.com` account domain). Note that Workday deployments can also send from a *company's own* domain (e.g. `workday@bah.com`), which no generic entry catches — the company-name OR-group is the safety net there. When you find a job-status email whose sender domain is not in this list, add it here so the next run catches that ATS.
   - The lookback bound, e.g. `newer_than:30d` or `after:2026/06/15`
   - `-in:sent -in:draft -in:trash` (status signals come from what employers send you, not what you sent). Do **not** restrict to `in:inbox`: many ATSes and user filters auto-archive status mail, so a real rejection/interview email can carry an `IMPORTANT` label but no `INBOX` label and would be silently missed by `in:inbox`.

Example: `newer_than:30d -in:sent -in:draft -in:trash ({"Acme Corp" "BigCo"} OR {from:greenhouse.io from:greenhouse-mail.io from:lever.co from:myworkday.com from:ashbyhq.com from:rippling.com from:pinpoint.email})`

4. Call `search_threads` with `view: THREAD_VIEW_MINIMAL`, `pageSize: 50`, paginating via `pageToken` until exhausted or results are clearly outside the relevant window.

---

## Step 3.5: Detect & Parse Job Alert Digest Emails (New Postings, Not Status Signals)

Separate from the status-sync query above, this step mines **saved-search job alert digests** for postings you haven't seen yet, and feeds each one through the job-scraper skill's own pipeline. These emails don't report status on a tracked application - they surface brand-new candidate postings - so this pipeline skips the tracker's approval gate entirely and writes straight to `job_scraper/seen_jobs.json`, exactly as `/scrape` would.

### 3.5a. Build the alert query

Search independently of the Step 3 query, over **its own** lookback window: `since <date>` argument if given (Step 0's override applies to both pipelines for a single run), else `state.last_alert_sync` if set, else `newer_than:30d`.

**Why a separate bookmark from Step 3's `last_sync`:** the two pipelines answer different questions - Step 3 asks "what's the status of applications I already track," Step 3.5 asks "what new postings exist that I haven't seen." Sharing one date field would mean a routine status-sync run (which advances `last_sync` every time, regardless of what Step 3.5 found) silently narrows the alert-digest pipeline's effective window too, even on a run where Step 3.5 itself found nothing to justify moving its bookmark forward. Keeping them independent means a change in one pipeline's cadence or coverage can never quietly cost the other pipeline lookback range it still needs - each pipeline's `processed_message_ids` entries (shared set, see Step 2) are what actually prevent re-processing, so neither date field needs to be conservative to avoid duplicates; both can advance freely and safely.

- Known alert-digest senders (extend this list as new ones are confirmed):
  - `from:jobalerts-noreply@linkedin.com` (LinkedIn saved-search Job Alerts - the subject is just the top job's title, not a generic "alert" phrase, so confirm the match after fetching via header `X-LinkedIn-Class: SAVEDSEARCH`)
  - `from:jobs-noreply@linkedin.com` (LinkedIn *recommendation* emails, e.g. "<Company> is hiring for a Remote role" - algorithm-picked single-job recs, distinct from the saved-search alerts above. Lower precision than a saved search, but still fresh new-posting signal; the Step 3.5d dedup + geographic/sector/fit filters screen the noise.)
  - `from:donotreply@jobalert.indeed.com` (Indeed **saved-search** digests - the real sender for "software developer in <city>: <role> at <Company> and N more new jobs". This is the multi-card digest; parse it card-by-card in Step 3.5c.)
  - `from:donotreply@match.indeed.com` (Indeed **match** recommendations - single-job "It looks like your background could be a match for this <role> role", often with a salary line. Treat each as one card.)
  - `from:indeedapply@indeed.com` (Indeed application-sent confirmations - not a new-posting alert; harmless to include but yields no new cards)
  - `from:noreply@ziprecruiter.com` (ZipRecruiter alerts)
  - `from:alerts@dice.com`
  - `from:hi@himalayas.app` (Himalayas remote-job **match/recommendation** digests - subjects like "You've got new matches on Himalayas ⛰️", "N remote jobs match your profile", "Your remote job recommendations from Himalayas". Multi-card digest; parse per Step 3.5c's Himalayas layout, and skip the trailing "Sponsored jobs" section. Note: `hi@himalayas.app` also sends non-alert mail - a welcome "A personal hello", profile nudges - which carry no job cards and are harmlessly ignored by the card parser.)
  - `from:support@builtin.com` (Built In "New Software Job Matches" - weekly, driven by the user's saved job preferences [e.g. "Software, Loveland, CO, USA, Hybrid, In Office, Remote"]. Multi-card digest, one row per job carrying **company, title, work-mode, location, and salary**; parse per Step 3.5c's Built In layout. Colorado-aware and salary-rich - high-signal for this profile.)
  - `from:team@hi.wellfound.com` (Wellfound / ex-AngelList Talent - subjects "New jobs: <role> at <company> and N more jobs". Multi-card startup digest with the cleanest plain-text layout of the set [company size, salary, remote/location, years-of-exp, an "Our Take" blurb]; parse per Step 3.5c's Wellfound layout.)
  - `from:alerts@alerts.haystack.cv` (Haystack "N New Jobs Matching Your Search" - **daily**, Denver/Colorado-search-scoped but **noisy** [heavy on staffing agencies, contract/hourly, and clearance/defense reqs - TS/SCI, Leidos, Cherokee Federal, TEKsystems]. Emoji-delimited cards; parse per Step 3.5c's Haystack layout, then lean hard on the Step 3.5d geographic/sector/weapons/fit filters to screen the noise.)
  - `from:noreply@connectingcolorado.gov` (Connecting Colorado - the Colorado state workforce board, **Eightfold**-powered [`coloradowfx.eightfold.ai`]. Subject "Keenan, We Found New Jobs for You". Multi-card, but despite the name **most matches are out-of-state** [KS/NE/UT etc.] - low yield for a CO/remote profile, so the geographic filter does the heavy lifting; parse per Step 3.5c's Connecting Colorado layout.)
  - **Evaluated and excluded (do not add):** `kimble@kimblegroup.com` ("Recommended Jobs With <companies>" daily local-jobs blast) - confirmed present but the corpus is overwhelmingly **non-software** (Civil Engineering PM, EHS Specialist, Accounts-Receivable Manager) recruiter-spam; not worth a parser. Revisit only if its content changes.
  - **Stale-sender caution:** `alert@indeed.com` was a guessed address that does **not** match real Indeed alert mail (Indeed sends from `jobalert.indeed.com` / `match.indeed.com`); it has been replaced above. When adding a portal, confirm the *actual* observed `from:` address rather than a plausible-looking one, or the whole portal is silently absent.
- Generic fallback for portals not in that list: subject or opening body line containing phrasing like "job alert", "jobs for you", "new jobs matching your search", "saved search"

Query shape: `-in:sent -in:draft -in:trash {from:jobalerts-noreply@linkedin.com from:jobs-noreply@linkedin.com from:donotreply@jobalert.indeed.com from:donotreply@match.indeed.com from:indeedapply@indeed.com from:noreply@ziprecruiter.com from:alerts@dice.com from:hi@himalayas.app from:support@builtin.com from:team@hi.wellfound.com from:alerts@alerts.haystack.cv from:noreply@connectingcolorado.gov} <lookback bound>`

**Do not restrict this query to `in:inbox`.** Alert digests are exactly the kind of high-volume mail users route past the inbox with a filter - Indeed's, for instance, commonly arrive already archived (an `IMPORTANT` label but no `INBOX` label). An `in:inbox` alert query would silently find zero of them. Search the archive (everything except sent/draft/trash); the shared `processed_message_ids` set still prevents re-processing.

Call `search_threads` (`THREAD_VIEW_MINIMAL`, `pageSize: 50`, paginate as needed).

### 3.5b. Filter to new messages

Same rule as Step 4 below: skip a thread if every message ID is already in `state.processed_message_ids`. For unprocessed messages, fetch full content (`get_thread`, `messageFormat: FULL_CONTENT`). These emails are multipart - prefer the `text/plain` part when present (cleaner to parse than the HTML part's markup), falling back to stripped HTML only if no plain-text part exists.

### 3.5c. Parse individual job listings out of each digest

A single digest email contains multiple job cards. Extract, per card: **title, company, location, and the job URL**. LinkedIn's plain-text part repeats this shape per card, separated by a `---` rule line:

```
<Title>
<Company>
<Location>
[optional social-proof line: "Fast growing" / "N school alumni" / "Top applicant" / "This company is actively hiring"]
View job: <tracking URL>
```

**Himalayas** (`hi@himalayas.app`) uses an HTML-table layout that renders in the plain-text part as **one table row per job**, under a `Your top matches for <date>` heading. Each card is the job **title** immediately followed by a bracketed tracking link, then the **company** name followed by its own tracking link:

```
| | <Title>[](<awstrack tracking URL>) <Company>[](<company tracking URL>) |
```

Per card, take the text before the first `[](…)` as the **title**, and the text between that link and the next `[](…)` as the **company**. Himalayas' plain text carries **no per-card location line** (it is a remote-only board), so record location as `Remote (region unverified)` and let the Step 3.5d geographic filter **FLAG** rather than hard-**FAIL** on it - a Himalayas posting can still be remote-EU/APAC-only, which `/apply` verifies later. Recover the canonical job URL from **inside** the job's `awstrack.me` tracking link: find its `redirect=` query parameter and URL-decode it (it is double-encoded - `%252F` → `%2F` → `/`) to get `https://himalayas.app/companies/<company-slug>/jobs/<job-slug>` - the exact shape the `himalayas-search` CLI produces, so an alert-sourced posting dedups against a CLI-sourced one. **Ignore the trailing "Sponsored jobs" / "Top jobs from across Himalayas" section** - those are paid ads, not personalized matches. Worked example from a real digest: card `Senior Java Developer (IC)` → company `DVT` → `https://himalayas.app/companies/dvt-co/jobs/senior-java-developer-ic`.

**Built In** (`support@builtin.com`) renders as an HTML table; each job is **one row** that concatenates, in order, **company, title, work-mode, location, salary**, followed by a bracketed `awstrack.me` tracking link. The plain text is noisy (`| |` filler rows) - the real cards are the rows that contain a `$`-salary and a tracking link. Do not try to split company/title on whitespace (there is no delimiter); instead recover them from the **canonical URL embedded in the tracking link**. Built In's `awstrack.me` link carries the destination URL **singly-encoded and inline** (not under a `redirect=` param like Himalayas): find the `…/L0/https:%2F%2Fbuiltin.com%2Fjob%2F<title-slug>%2F<job-id>%3F…` segment and URL-decode it (`%2F`→`/`, `%3F`→`?`, strip the query) to get `https://builtin.com/job/<title-slug>/<job-id>` - the dedup key. Derive **title** from `<title-slug>` (de-slugify), then **company** = the card text up to where the title begins; **work-mode** ∈ {`In Office`, `Remote`, `Hybrid`, `Hybrid and Remote`}; **location** = text between work-mode and the salary; **salary** = the trailing `$min-$max`. Worked example: `Ursa Major Senior Test Software Engineer In Office Longmont, CO $110,000-$135,000` + link `…builtin.com%2Fjob%2Fsenior-test-software-engineer%2F10602219…` → title `Senior Test Software Engineer`, company `Ursa Major`, In Office, Longmont CO, `https://builtin.com/job/senior-test-software-engineer/10602219`. Feed work-mode + location into the Step 3.5d geographic filter (this is a CO-scoped, salary-rich source - high value).

**Wellfound** (`team@hi.wellfound.com`) has the cleanest layout - a plain-text block per card, boundaried by a `Learn More` line immediately followed by the job URL. Per card, in order: line 1 = **title**; next non-blank = `<Company> / <N> Employees` (→ **company**, plus company size); next = the ` $<min>–<max>k | <work-mode/location> | <N> years of exp | Full-time` facet line (→ **salary**, **location/remote**, years-of-exp); then tag chips (`Actively Hiring`, stage) and an `Our Take` blurb you can keep as the fit-note. **URL:** the `Learn More` link is `https://wellfound.com/jobs?job_listing_slug<ID>-<slug>` (the char before `<ID>` is a mojibake'd `=`); canonicalize to `https://wellfound.com/jobs/<ID>-<slug>` for the dedup key. Location parses from the facet line: `Remote only, United States` → remote-US PASS; `Remote, New York` / `Onsite or remote, Boston` → extract the remote flag + geo and let Step 3.5d judge. Worked example: `Senior Software Engineer, Backend (Reliability Platform)` · `Affirm / 501-1000 Employees` · `$173–233k | Remote only, United States | 4 years of exp` → remote-US, `https://wellfound.com/jobs/48581-senior-software-engineer-backend-reliability-platform`.

**Haystack** (`alerts@alerts.haystack.cv`) uses emoji-delimited plain-text cards - very parseable. Per card: the **title** is the line following the `Technology` category label (and any `🔥 <age>` prefix); **company** follows `🏢`; **location** follows `📍` (with a country flag emoji); a `🏠 Remote` marker (when present) means remote; **salary** follows `💰`. The apply link is `https://haystack.cv/go?j=<id>&…&u=<url-encoded appcast redirect>&t=<title>&c=<company>`. The `u=` param is an `click.appcast.io` **redirect** (not a stable final ATS URL), so **dedup by normalized company+title**, not by the appcast URL; keep the `haystack.cv/go?j=<id>` link only as the click-through. This source skews to staffing/contract/clearance/defense - apply the Step 3.5d weapons/warfighting screen and the on-call/fit filters aggressively. Worked example: `Software Engineer` · `🏢 Cherokee Federal` · `📍 Denver, United States` · `🏠 Remote` · `💰 USD 180,000 - 200,000/yr`.

**Connecting Colorado** (`noreply@connectingcolorado.gov`, Eightfold-powered) renders as a table; each card is `<Title> [](<eightfold vsimp tracking link>) <Company> <Location>`. Take the text before the first `[](` as the **title** (strip a trailing ` - <req#>`), and the text after the link as `<Company> <Location>`. Recover the canonical URL from **inside** the tracking link's `n=` query param (URL-decode it): `https://coloradowfx.eightfold.ai/careerhub/explore/jobs/<job-id>` - the dedup key. **Despite the "Colorado" branding, most cards are out-of-state** (KS/NE/UT/…); the Step 3.5d geographic filter will hard-FAIL those and keep only remote or Denver-metro rows. Worked example: `Software Developer 4` · `Oracle America, Inc.` · `Broomfield, Colorado` → `https://coloradowfx.eightfold.ai/careerhub/explore/jobs/844768664909442` (Denver-metro PASS); the same digest's `Apex Systems, LLC · UT-MURRAY` and `Oracle · Topeka, KS` rows FAIL on location.

Canonicalize each URL before using it as a dedup key - strip query/tracking params and normalize to the shape the portal's own CLI would produce, e.g. LinkedIn `https://www.linkedin.com/comm/jobs/view/<id>/?trackingId=...` -> `https://www.linkedin.com/jobs/view/<id>/`. This matters because the same posting can otherwise land in `seen_jobs.json` twice - once from `/scrape`'s CLI, once from an alert email - and fail to dedup against itself over a stray query string. For other portals, adapt the same card-boundary + canonical-URL approach to that portal's own digest layout.

### 3.5d. Run each parsed listing through the job-scraper pipeline

For every parsed listing, apply **exactly** the job-scraper skill's own steps (`.claude/skills/job-scraper/SKILL.md`), as if it were a CLI search result:

1. **Dedup** (job-scraper Step 2): skip if the canonical URL or normalized company+title key already exists in `job_scraper/seen_jobs.json`, or if company+role already appears **anywhere** in `job_search_tracker.csv` (any status, not just the open-application set Step 2 of *this* command built - matches `/scrape`'s broader rule).
2. **Geographic and sector filters**: apply the Location Filter and Sector/Employer Exclusions sections of `.claude/skills/job-scraper/search-queries.md` - remote preferred, Denver-metro hybrid backup only, no relocation, and the weapons/warfighting screen. A listing that fails these is skipped, same as `/scrape` would skip it.
3. **Mass-posting check** (job-scraper Step 2.5): if two or more cards in the *same* digest share a company/req and differ only by city, consolidate into one row and note the spread rather than presenting duplicates.
4. **Quick fit assessment** (job-scraper Step 3): High/Medium/Low against the candidate profile - the same three-tier rubric `/scrape` uses, not the full `04-job-evaluation.md` workup.
5. **Store** (job-scraper Step 4): write every parsed listing (new and skipped alike) into `job_scraper/seen_jobs.json` using the exact schema `/scrape` uses, with `"portal": "gmail-alert:<sender-domain>"` (e.g. `"gmail-alert:linkedin.com"`) so its origin stays distinguishable from a CLI-sourced entry. **This write happens immediately, without waiting for the Step 7 approval gate** - `seen_jobs.json` is a discovery cache, not the application record that gate protects, and `/scrape` itself writes it unconditionally.
6. **Referral links** (job-scraper Step 4.5, optional): for High/Medium fit listings, generate the same two LinkedIn people-search links `/scrape` would.

Only listings that are both new (not deduped away) and pass the geographic/sector filters carry forward to Step 6 for presentation.

---

## Step 4: Filter to New Messages

*(Steps 4-7 apply only to the Step 3 status-sync query. Job alert digests found via Step 3.5 follow their own pipeline described there and are presented separately below in Step 6.)*

For each returned thread, inspect its messages' IDs against `state.processed_message_ids`. Skip a thread entirely if every message in it is already processed. For threads with unprocessed messages, call `get_thread` with `messageFormat: FULL_CONTENT` to get full bodies - **classification in Step 5 must never be based on the snippet/subject alone**, since snippets truncate the exact phrase that distinguishes "we'd like to schedule a call" from "thanks for applying."

---

## Step 5: Classify Each Unprocessed Message

For each new message, first try to match it to one open application: compare the normalized sender domain / display name / subject / body against the normalized company names from Step 3.

**No confident match to a tracked application** → branch on whether the message is a rejection:
- **It is a clear rejection** (per the Rejection row below) **and** the company + role are confidently identifiable from the email → propose it as a **new rejection to capture** in Step 6. This originates a fresh tracker row with `status: rejected` plus an `outcome.md`, per the always-capture-rejections rule. Only do this when the company + role are unambiguous from the email itself; a rejection whose company cannot be pinned down still goes to "unmatched", never a guess.
- **It is anything else** (ack, interview, offer, or a rejection whose company is genuinely ambiguous) → do not propose a write; record it in the Step 6 summary as "unmatched" and move on. `/gmail-sync` still does not originate in-progress applications.

For a matched message, classify by content (require the signal phrase in the subject or the first few lines - a company name appearing only deep in a forwarded thread or newsletter footer is not a signal):

| Signal | Example phrasing | Tracker `status` | `outcome.md` action |
|---|---|---|---|
| Application ack | "we've received your application" | *(no change)* | *(no change - not a status signal, just noise)* |
| OA / assessment | "online assessment", "coding challenge", "complete your assessment", HackerRank/Codility links | `interview` | Tick nearest matching stage checkbox (or add a Notes line if no checkbox fits - assessments aren't always a listed stage) |
| Interview invite/scheduled | "schedule a call", "phone screen", "technical interview", "next round", "onsite", "final round" | `interview` | Tick the matching stage checkbox with the email's date |
| Offer extended | "pleased to offer", "extend an offer", "offer letter" | `offer` | Tick "Offer received" checkbox. **Never propose `hired` or `offer_declined` from an email** - accepting or declining is the user's decision, not something to infer. Flag prominently in the Step 6 summary as needing the user's decision, separate from the plain approve/skip table. |
| Rejection | "moving forward with other candidates", "not selected", "unable to proceed", "decided not to continue" | `rejected` | Set `Status: rejected`, `Date resolved:` to the email's date |

**Conflict rule:** if the classified signal contradicts the application's current final-ness (e.g. a "moving forward" email arrives for a company whose tracker row briefly shows a `rejected`-adjacent recent write already, or a rejection arrives after an offer was already proposed this run) - do not propose overwriting it. Record it as a conflict in Step 6 for manual `/outcome` resolution instead.

---

## Step 6: Present Proposed Updates

**Nothing has been written yet.** Present every classified change from Step 5 as a single batch, so the user can review the full picture before anything touches the tracker or `outcome.md`:

```
## Gmail Sync - Proposed Updates - YYYY-MM-DD

Scanned N threads (M new messages) since <lookback date>.

### Proposed Changes (reply "approve all", or list which to skip, e.g. "skip 2")
| # | Company | Role | Signal | Current -> Proposed Status | Source Email (date) |
|---|---|---|---|---|---|
| 1 | ... | ... | Interview invite | applied -> interview | "Subject line" (2026-07-10) |
| 2 | ... | ... | Offer extended | interview -> offer | "Subject line" (2026-07-12) |

### New Rejections to Capture (not previously tracked - will originate a rejected row)
| # | Company | Role | Current -> Proposed Status | Source Email (date) |
|---|---|---|---|---|
| 3 | ... | ... | (untracked) -> rejected | "Subject line" (2026-07-14) |

### Needs Manual Review (conflicting signal - not proposed, use /outcome)
- **<Company>** - <what conflicted and why it wasn't proposed>

### Unmatched Emails (no change proposed)
- "<subject>" from <sender> - looked job-related but couldn't be confidently linked to a tracked application.

### Stale Applications (30+ days, no activity)
- **<Company>** - last activity YYYY-MM-DD, still `<status>`.

### New Job Matches from Email Alerts (already saved to job_scraper/seen_jobs.json - informational, no approval needed)
| # | Fit | Title | Company | Location | Source Alert | URL |
|---|-----|-------|---------|----------|---------------|-----|
| 1 | High | ... | ... | ... | LinkedIn Job Alerts (2026-07-31) | [Link](...) |
```

If Step 3.5 found new postings, include the "New Job Matches from Email Alerts" section - these are already written to `seen_jobs.json`, so nothing in it needs approval; it's shown for visibility, same as `/scrape`'s own output. Omit the section entirely when Step 3.5 found nothing new. After presenting, if this section is non-empty, ask the same follow-up `/scrape` asks: "Want me to evaluate any of these in detail? Just give me the number(s)." Picking a number invokes the job-application-assistant workflow (fit evaluation first, then CV + cover letter if approved), same as `/scrape`. If Step 3.5 turned up many new jobs (roughly 8+), also suggest `/rank`.

If the Proposed Changes table would be empty, say so briefly and skip straight to Step 8 (Update State) - there is nothing to approve. Offers still land in the Proposed Changes table (the tracker moves to `offer`); it's only `hired`/`offer_declined` that are never proposed. (This "nothing to approve" shortcut is about the tracker-affecting tables only - still present the New Job Matches section above if Step 3.5 found anything.)

---

## Step 7: Wait for Approval

Stop here and wait for the user's reply. Do not write anything from this run's classification before an explicit response arrives.

- "approve all" / "yes" / equivalent → every row in the Proposed Changes table proceeds to Step 7a.
- A partial response, e.g. "approve 1, skip 2" or "just the interview one" → only the specified rows proceed.
- "no" / decline / no changes wanted → no rows proceed; go straight to Step 8 (Update State).

Approving the whole batch in one reply is expected UX - the requirement is that the reply happens first, not that the user approves row by row.

### Step 7a: Write Approved Updates

For every row the user approved:

1. **Tracker (`job_search_tracker.csv`):** update the matched row's `status` column per the Step 5 table, and append to `notes`: `<date> gmail-sync: <signal> ("<email subject>")`. Never restructure the CSV, reorder rows, or touch unrelated rows - same rule `/outcome` follows.
2. **`outcome.md`:** tick the relevant stage checkbox (adding the date in parentheses) or update `Status`/`Date resolved` per the table. Append a dated entry to `## Notes`, never overwrite existing Notes history:
   ```
   YYYY-MM-DD (via /gmail-sync): <one-line summary of what the email said>. Source: "<subject>" from <sender>, <email date>.
   ```
3. If no archive folder/`outcome.md` exists yet for a matched application (it was added to the tracker outside `/apply`/`/outcome`), create the folder and a minimal `outcome.md` following the exact format in `documents/README.md`, same as `/outcome` would.
4. **New rejection captures** (rows from the "New Rejections to Capture" table): append a fresh row to `job_search_tracker.csv` with `status: rejected`, `date` = the rejection email's date, `company` and `role` as identified from the email, `channel` = the ATS/sender where known, `fit_rating` = `not evaluated (captured via gmail-sync)`, and a `notes` value citing the source email; leave `sector`, `contact_person`, `cv_file`, `cover_letter_file`, and `source` blank when unknown. Then create the archive folder + `outcome.md` exactly as in step 3. Never invent a role, date, or sector that the email does not support - blank beats guessed.

Rows the user skipped are left untouched - no tracker write, no `outcome.md` write - but their message IDs are still marked processed in Step 8, so the same email isn't re-proposed every run.

---

## Step 8: Update State

Add every message ID processed this run - approved, skipped, unmatched, filtered as noise, or parsed as a job alert digest (Step 3.5) - to `gmail_sync/state.json`'s `processed_message_ids` (the single shared set). Then set the two bookmark fields **independently**, each only if its own pipeline actually ran a search this run: `last_sync` to today's date if Step 3 ran, `last_alert_sync` to today's date if Step 3.5 ran. In practice both run every time `/gmail-sync` runs, so both normally advance together - the independence matters for future flexibility (e.g. a `since` override or a future partial-pipeline invocation), not for today's default behavior. This makes re-running idempotent - the same email never produces a duplicate proposal, tracker note, Notes entry, or `seen_jobs.json` entry.

---

## Step 9: Staleness Check

For open applications with **no** matching activity found this run, check the tracker's `date` column and the most recent dated Notes entry in their `outcome.md`. If the most recent of those is 30+ days old, flag the application as "needs follow-up" in the closing summary below. This is surfaced only - never write anything for staleness.

---

## Step 10: Present Closing Summary

Confirm what actually happened, distinct from the Step 6 proposal:

```
## Gmail Sync - Done - YYYY-MM-DD

### Written
| Company | Role | Signal | Tracker Status | Source Email |
|---|---|---|---|---|
| ... | ... | Interview invite | applied -> interview | "Subject line", 2026-07-10 |

### Skipped (not written)
- **<Company>** - <signal> declined by user.

### Offers Requiring Your Decision
- **<Company>** - offer written 2026-07-12 ("<subject>"). Tracker set to `offer`; run `/outcome <company>` to record accept/decline once you decide.

### Stale Applications (30+ days, no activity)
- **<Company>** - last activity YYYY-MM-DD, still `<status>`.
```

(Job alert matches from Step 3.5, if any, were already shown in full in Step 6 - no separate "done" table for them here, since there was no approval step to distinguish proposed from written.)

If nothing was proposed this run, a brief note is enough instead of an empty summary.

If this run pushed the count of applications with a **final** `outcome.md` status to 3+ (or resolved a second application sharing a pattern), suggest the same `/setup` Path A calibration handoff `/outcome` suggests - do not duplicate that logic, just point the user there.

---

## Important Rules

1. **Classify from full email bodies, never snippets.** A status-changing proposal requires having actually fetched and read the message via `get_thread`/`get_message`.
2. **Nothing is written before the user approves the Step 6 batch.** Approving everything in one reply is fine UX; writing first and flagging it after is not.
3. **Never propose `hired` or `offer_declined`.** Those require the user's real-world decision; `/gmail-sync` stops at proposing `offer` and flags it.
4. **A conflicting signal against an already-final or already-written status is a manual-review flag, not a proposed overwrite.** When in doubt, don't propose it - surface it.
5. **Append-only to `outcome.md` Notes**, same as `/outcome`. Never rewrite or delete existing history.
6. **Idempotent by message ID.** Re-running must never re-propose, or duplicate a tracker note or Notes entry for, the same email.
7. **Never fabricate a match.** If the company can't be confidently identified from the email, it goes in "Unmatched," not a guess.
8. **Read-only against Gmail itself.** This command reads and classifies; it does not label, archive, or delete anything in the user's mailbox.
9. **`gmail_sync/state.json` and `documents/applications/**` are gitignored** - message IDs and interview/application notes are private; never suggest committing them. `job_search_tracker.csv`, by contrast, **is tracked in git** as part of this repo's normal application-history workflow (see its commit history) - its updates are fine to commit like any other tracked file, subject to the usual only-commit-when-asked rule.
10. **Rejections are always captured.** A confidently identified rejection is recorded even when the application was never tracked (it originates a `rejected` row + `outcome.md`), because a terminal outcome is always worth keeping. This is the sole exception to "never originate"; it still passes through the Step 6 approval batch, and a rejection whose company/role cannot be pinned down from the email stays "unmatched" rather than becoming a guessed row.
11. **Job alert ingestion (Step 3.5) is a separate, ungated pipeline.** Postings parsed from saved-search digest emails are written to `job_scraper/seen_jobs.json` immediately and only ever originate entries there - never `job_search_tracker.csv` or `outcome.md`. Applying to one is a separate, explicit follow-up (picking a number from the Step 6 output, same as `/scrape`), not something this command does on its own.
12. **Reuse `/scrape`'s own filters, don't fork them.** Geographic, sector, weapons-exclusion, and fit-band rules for alert-sourced postings come from `.claude/skills/job-scraper/search-queries.md` and `SKILL.md` directly - if those change, this pipeline inherits the change automatically.
13. **Canonicalize alert URLs before dedup.** Strip tracking/query params so an alert-sourced posting and a CLI-sourced posting for the same job collapse into one `seen_jobs.json` entry instead of two duplicate ones.
