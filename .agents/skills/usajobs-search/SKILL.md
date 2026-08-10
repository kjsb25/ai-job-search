---
name: usajobs-search
version: 1.0.0
description: >
  Use this skill to search live U.S. FEDERAL government job listings on USAJOBS
  (usajobs.gov) — the official federal job board — via its Search API, or to look
  up a specific federal posting. Strong for clearance-holding / space / conservation
  / regulated-domain candidates: many roles require a security clearance (an asset)
  and federal agencies (NASA, USFWS, NPS, DoD civilian, USGS) hire software
  engineers. Trigger phrases: federal jobs, government jobs, USAJOBS, federal
  software engineer, GS jobs, clearance jobs, agency developer roles, civil-service
  tech jobs, look up this USAJOBS posting.
context: fork
enabled: true  # Requires USAJOBS_API_KEY + USAJOBS_EMAIL in the environment — see Activation below.
allowed-tools: Bash(bun run .agents/skills/usajobs-search/cli/src/cli.ts *)
---

# USAJOBS Search Skill

Search live listings from **[USAJOBS](https://www.usajobs.gov)** — the U.S. federal
government's official job board — through its Search API. **Zero runtime
dependencies** (just `bun`), but unlike the other portal skills it needs a **free
API key** (see Activation).

Why it's here for this candidate: USAJOBS is where federal agencies post software
roles, and many require a **security clearance** — which the candidate holds
(Secret), making it an asset rather than a barrier. It also surfaces
conservation/environmental (USFWS, NPS, USGS), space (NASA), and regulated-domain
federal engineering roles that align with the target sectors. The candidate's
current role is itself at a federal agency (USFWS), so the domain is familiar.

> This follows the repo's job-portal-skill pattern (like `linkedin-search` and
> `himalayas-search`). Like `himalayas-search` it queries a JSON API, so results
> are structured (agency, GS grade, salary, schedule, remote flag).

## 🔑 Activation (ships DISABLED — one-time setup)

This skill is shipped with `enabled: false` because it cannot function without a
key, and the key is personal to you. To activate:

1. **Request a free key** (instant, email-based):
   <https://developer.usajobs.gov/apirequest/>
2. **Export the credentials** (add to your shell profile so they persist):
   ```bash
   export USAJOBS_API_KEY="<your key>"
   export USAJOBS_EMAIL="you@example.com"   # the exact email you registered
   ```
3. **Install dev types + typecheck:**
   ```bash
   cd .agents/skills/usajobs-search/cli && bun install && bun run typecheck && cd ../../../..
   ```
4. **Run the live verification** (the fixture tests already pass offline; these
   confirm the real API):
   ```bash
   bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "software engineer" --location "Colorado" --limit 5 --format table
   # take an id from the results, then:
   bun run .agents/skills/usajobs-search/cli/src/cli.ts detail <id> --keyword "<a few title words>" --format plain
   ```
   Verify titles/agencies/locations are populated and the detail description is
   readable. If `detail <id>` alone doesn't find the job, add `--keyword` (the free
   API has no fetch-by-id endpoint; see Notes).
5. **Flip `enabled: false` → `true`** in this file's frontmatter so `/scrape` picks
   it up.

Until step 5, `/scrape` skips this portal. A run without the key exits with a clear
`NO_CREDENTIALS` error and setup guidance.

## When to use this skill

- Search federal job openings by keyword, location, recency, or remote flag
- Find clearance-eligible / agency software roles (NASA, USFWS, NPS, DoD civilian…)
- Get the full description and qualifications of a specific USAJOBS posting

## Commands

### Search job listings

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords (title, skill, agency, announcement #).
- `--location <place>` / `-l <place>` — `LocationName`, e.g. `"Denver, Colorado"` or `"Colorado"`.
- `--remote` — restrict to remote-flagged roles (`RemoteIndicator`).
- `--jobage <days>` — posted within N days (`DatePosted`; **API max 60**).
- `--page <n>` — 1-indexed page. Default 1.
- `--limit <n>` / `-n <n>` — results per page (`ResultsPerPage`; **API max 500**). Default 25.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail <id|url> [--keyword "<title words>"] [--format json|plain]
```

`id` is the `id` (control number) from a `search` result; a full
`https://www.usajobs.gov/GetJob/ViewDetails/<id>` URL also works. Returns the
assembled, HTML-stripped description plus qualifications, salary, GS grade, agency,
schedule, and closing date.

> The free Search API has **no fetch-by-id endpoint**, so `detail` re-runs a keyword
> search and matches on the control number. Search results already include the full
> description inline; if `detail <id>` alone can't re-locate the job, pass
> `--keyword "<a few title words>"`.

## Usage examples

```bash
# Federal software roles in Colorado
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "software engineer" --location "Colorado" --format table

# Remote-flagged developer roles, last 14 days
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "developer" --remote --jobage 14 --format table

# Roles at a specific agency
bun run .agents/skills/usajobs-search/cli/src/cli.ts search -q "Fish and Wildlife Service software" --format table

# Full detail for one posting
bun run .agents/skills/usajobs-search/cli/src/cli.ts detail 21947200 --keyword "IT specialist" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing a result's `id` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "total" }, "results": [...] }`; each
result carries at least `id`, `title`, `company` (agency), `location`, `date`, and
`url` (missing values are `null`), plus federal extras (`announcement`, `salary`,
`grade`, `schedule`, `remote`, `close_date`). Errors are written to **stderr** as
`{ "error": "...", "code": "..." }`, exit code `1`; a missing/invalid key gives
`code: "NO_CREDENTIALS"`.

## Notes

- **Free key required** (see Activation). Credentials come from `USAJOBS_API_KEY` and
  `USAJOBS_EMAIL`; the email must match your registered developer account.
- **Eligibility matters.** Many federal roles require U.S. citizenship and/or a
  security clearance and use the GS pay scale. The job-evaluation framework's
  Eligibility Gate applies before scoring — a Secret-or-below clearance requirement
  is a PASS (and a plus) for this candidate.
- `USAJOBS_API_URL` overrides the base URL (for testing or a local relay/proxy).
- Fields, endpoints, and the auth headers are documented in `url-reference.md`.
