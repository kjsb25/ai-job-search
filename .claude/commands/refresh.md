# /refresh - Full Job-Search Sync (Scrape + Gmail Sync + Rank)

You are running the three most common maintenance commands back-to-back, in the order that makes each one's output useful to the next: `/scrape` (find new postings), `/gmail-sync` (pull application-status signals **and** new postings surfaced via saved-search job-alert emails), then `/rank` (score every unranked posting - from both of the above - against the fit framework).

`/refresh` is a **sequencing wrapper, not a new command**. Each stage keeps its own rules, approval gates, and output format exactly as it has standalone - `/refresh` does not shortcut or reinterpret any of them. The only thing it adds is running them in order and rolling up a short combined summary at the end.

Follow these steps **in order**.

---

## Step 0: Parse Input

`$ARGUMENTS` may contain:

- Nothing → run all three stages with their own defaults
- A focus area (e.g. `/refresh space` or `/refresh data science`) → forwarded to **Step 1** (`/scrape`'s focus-area argument) and **Step 3** (`/rank`'s focus-area filter). `/gmail-sync` has no equivalent concept, so it always runs argument-free in Step 2 regardless of this.
- `broad` → forwarded to Step 1 only, same as `/scrape broad`

If the user wants `/scrape health` (the probe-only diagnostic mode) or `/rank --all`/`--top <N>`, tell them to run that command directly instead of through `/refresh` - those are one-off diagnostic/override modes, not part of the routine three-stage chain this command exists to save typing on.

---

## Step 1: Run `/scrape`

Execute the job-scraper skill's full step sequence (`.claude/skills/job-scraper/SKILL.md`, Steps 0-6) exactly as `/scrape` would standalone, passing through any focus-area/`broad` argument from Step 0. Present its Step 5 results table as normal - this is real output the user should see, not something to compress.

If `bun` is unavailable or every portal fails, `/scrape` already handles that gracefully (WebSearch fallback, health-check notes) - let it finish and continue to Step 2 regardless of how many (if any) new jobs it found.

---

## Step 2: Run `/gmail-sync`

Execute `.claude/commands/gmail-sync.md`'s full step sequence, unchanged, with no arguments. This includes:

- Its status-sync pipeline (Steps 1-10 there), which proposes tracker/`outcome.md` changes and **stops to wait for the user's approval** before writing anything - `/refresh` does not pre-approve or skip this wait. If the user approves, decline, or partially approves, that resolves Step 2 the same way it would resolve `/gmail-sync` on its own.
- Its job-alert-digest pipeline (Step 3.5 there), which writes new candidate postings straight into `job_scraper/seen_jobs.json` (no approval needed for that part, same as `/gmail-sync` standalone).

Do not proceed to Step 3 until the approval-gated part of this stage has been explicitly resolved by the user - a chained command is not an excuse to skip a wait that exists to protect the tracker.

---

## Step 3: Run `/rank`

Execute `.claude/commands/rank.md` with no arguments (or the focus area carried from Step 0). With no arguments, `/rank` scores every `status: new` entry in `job_scraper/seen_jobs.json` - this naturally covers **both** Step 1's fresh scrape results and any new job-alert matches Step 2 wrote, without needing to track which stage produced which entry. This includes `/rank`'s own Step 3.5, which runs `/apply`'s company research on every job above the 50% match threshold and re-ranks on the findings - so `/refresh` inherits that automatically, with no special-casing here. Present its shortlist output as normal.

---

## Step 4: Combined Closing Summary

Don't re-render each stage's tables a second time - reference what already ran:

```
## /refresh - YYYY-MM-DD

1. **/scrape**: found N new postings (X high, Y medium, Z low)
2. **/gmail-sync**: M tracker updates written (or "nothing to approve"); K new postings from job-alert emails
3. **/rank**: scored (N+K) postings - P shortlisted, Q below threshold, R excluded/expired; researched C companies at ≥50% match and adjusted their ranks accordingly

See above for each stage's full detail.
```

Then hand off to `/rank`'s own next-step prompt ("Want to apply to any of these? Give me the number(s)...") rather than inventing a new one.

---

## Important Rules

1. **No new permissions.** `/refresh` grants nothing a standalone `/scrape`, `/gmail-sync`, or `/rank` wouldn't already do on its own - it only removes the need to type three commands separately.
2. **The gmail-sync approval wait is real, not skippable.** Chaining commands never becomes a reason to write to `job_search_tracker.csv` or `outcome.md` without the explicit approval `/gmail-sync` itself requires.
3. **A quiet stage isn't a failed chain.** Zero new scrape results, zero gmail matches, or zero rankable jobs are all valid, expected outcomes for an individual stage - continue to the next stage rather than treating "nothing found" as an error to abort on.
4. **Argument scope is honest.** Only forward arguments to stages that actually support them (Step 0) - never invent a flag a stage doesn't document just to make the chain feel more parameterized.
5. **Order matters for a reason.** Rank runs last specifically so it can see everything the first two stages produced in `seen_jobs.json` - don't reorder the stages.
