# usajobs-cli

Zero-dependency Bun CLI for searching the official [USAJOBS](https://www.usajobs.gov)
federal job board via its Search API. Same portal-skill contract as
`linkedin-search` and `himalayas-search`.

## Setup — free API key required

```bash
# 1. Request a key (instant): https://developer.usajobs.gov/apirequest/
# 2. Export both:
export USAJOBS_API_KEY="<your key>"
export USAJOBS_EMAIL="you@example.com"   # the email you registered

# 3. Install dev types
cd .agents/skills/usajobs-search/cli && bun install && cd ../../../..
```

`bun install` pulls only dev types — there are no runtime dependencies.

## Usage

```bash
# Software roles in Colorado, table view
bun run src/cli.ts search -q "software engineer" --location "Colorado" --format table

# Remote-flagged developer roles posted in the last 14 days
bun run src/cli.ts search -q "developer" --remote --jobage 14 --format table

# Full detail for one job (id from a search result; --keyword sharpens the match)
bun run src/cli.ts detail 21947200 --keyword "IT specialist" --format plain
```

## Commands & flags

- `search [-q <keywords>] [-l <location>] [--remote] [--jobage <days≤60>] [--page <n>] [--limit <n≤500>] [--format json|table|plain]`
- `detail <id|url> [--keyword <title words>] [--format json|plain]`

`id` is the `MatchedObjectId` control number from a search result; a full
`https://www.usajobs.gov/GetJob/ViewDetails/<id>` URL also works.

## Output

Search JSON is `{ "meta": { count, page, total }, "results": [...] }`; each result
has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values are
`null`), plus federal extras (`announcement`, `salary`, `grade`, `schedule`,
`remote`, `close_date`). Errors go to **stderr** as `{ "error", "code" }` with exit
code `1`; a missing/invalid key gives `code: "NO_CREDENTIALS"`.

## Notes

- The free Search API has **no fetch-by-id endpoint**, so `detail` re-runs a keyword
  search and matches on the control number; search results already include the full
  description inline. Pass `--keyword "<title words>"` if the id alone doesn't
  re-locate the job.
- USAJOBS uses `Page` (1-indexed), `ResultsPerPage` (≤500), `DatePosted` (≤60 days).
- Federal roles often require U.S. citizenship and/or a security clearance — read
  each posting's eligibility section.
- `USAJOBS_API_URL` overrides the base URL (for testing or a local relay/proxy).

## Test

```bash
bun run typecheck
bun run test   # parser/contract tests against a local fixture + offline validation
```

The test suite does not need a real key — it serves a realistic fixture locally.
After adding your key, run the live checks in the skill's `SKILL.md` "Activation"
section.
