---
name: himalayas-search
version: 1.0.0
description: >
  Use this skill to search live REMOTE software / tech / and general job listings
  on Himalayas (himalayas.app), a remote-only job board, via its public JSON API,
  or to look up a specific Himalayas posting. Because every role is remote, geography
  is expressed as which country/timezone a role may be worked from — ideal for a
  remote-first candidate. Trigger phrases: find a remote job, remote job search,
  remote developer jobs, work-from-home roles, "are there remote <role> jobs",
  remote-first companies hiring, look up this Himalayas job posting, himalayas jobs.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/himalayas-search/cli/src/cli.ts *)
---

# Himalayas Search Skill

Search live job listings from **[Himalayas](https://himalayas.app)** — a
**remote-only** job board — through its public JSON API. No authentication, no API
key, and **zero runtime dependencies**: it runs with just `bun`.

Because Himalayas lists only remote roles, this skill is a strong fit for a
remote-first search: every result already passes the "is it remote?" bar, and the
`location` field tells you which countries/timezones a role is open to being worked
from, not an office address.

> This follows the repo's job-portal-skill pattern (like `linkedin-search` and
> `freehire-search`). Like `freehire-search` — and unlike the HTML-scraping portals
> — it queries a public JSON API, so results are structured (seniority, salary,
> remote-from locations, timezones) rather than parsed from markup.

## ℹ️ Access notes (public, best-effort)

- **No API key.** Reads are public — the same zero-signup bar as `linkedin-search`.
- **Cloudflare-fronted.** The API sits behind Cloudflare bot protection. The CLI
  sends browser-like headers to pass it; if access is temporarily blocked it fails
  with a clear "Cloudflare challenge" error (a non-zero exit) rather than looking
  like an empty result, so an outage degrades this source rather than breaking the
  workflow. Keep request volume low.
- **Base URL override:** `HIMALAYAS_API_URL` (default `https://himalayas.app`) — for
  testing or routing through a local relay/proxy.
- `robots.txt` allows the API paths (`/jobs/api…`); only `/apply` is disallowed, and
  this skill never touches it — it is **search + detail (read) only**.

## When to use this skill

- Search remote job openings by keyword, or browse the newest remote postings
- Filter to roles open to a specific remote-from country/region, or by recency
- Get the full description of a specific Himalayas posting

## Commands

### Search job listings

```bash
bun run .agents/skills/himalayas-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title/role). Relevance-ranked.
  **Omit `-q` to browse the newest postings instead** (with real pagination).
- `--location <place>` / `-l <place>` — filter to roles open to that remote-from
  country/region (client-side match on the job's location restrictions).
- `--jobage <days>` — posted within N days (client-side filter on posting date).
- `--page <n>` — 1-indexed page. Default 1.
- `--limit <n>` / `-n <n>` — results per page. Default 25.
- `--format json|table|plain` — default `json`.

> **Keyword vs browse.** The keyword-search endpoint returns a fixed relevance
> window (~19 results) and ignores server pagination, so `--limit`/`--page` slice
> that window client-side. Browsing without `-q` uses real server-side pagination,
> so it can page deep into the newest postings.

> **Location is remote-from, not an office.** Every role is remote. `--location "United States"`
> means "open to being worked from the US", and a job with no restrictions is
> worldwide-remote. Pass a country/region name, not a city.

### Fetch full job detail

```bash
bun run .agents/skills/himalayas-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `id` from a `search` result, shaped `<companySlug>/<jobSlug>` (e.g.
`samsara/staff-software-engineer-platform`). A full
`https://himalayas.app/companies/<c>/jobs/<j>` URL also works. Returns the full
(HTML-stripped) description plus seniority, employment type, salary, timezones,
categories, and expiry.

> Himalayas' public detail pages are Cloudflare-protected, so `detail` re-locates
> the job through the keyword-search API. If a job falls outside the search
> relevance window, `detail` says so — the full description is already present in
> the `search` result that produced the id, so use that.

## Usage examples

```bash
# Remote software-engineer roles, table view
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "software engineer" --limit 10 --format table

# Remote React roles open to the United States
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "react" --location "United States" --format table

# Browse the newest remote postings from the last 3 days
bun run .agents/skills/himalayas-search/cli/src/cli.ts search --jobage 3 --limit 15 --format table

# Remote DevOps roles, page 2
bun run .agents/skills/himalayas-search/cli/src/cli.ts search -q "devops" --page 2 --format table

# Full details for a specific job
bun run .agents/skills/himalayas-search/cli/src/cli.ts detail samsara/staff-software-engineer-platform --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing a result's `id` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "total" }, "results": [...] }`; each
result carries at least `id`, `title`, `company`, `location`, `date`, and `url`
(missing values are `null`), plus remote-work extras (`employment_type`,
`seniority`, `salary`, `remote_locations`, `timezones`). All errors are written to
**stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from Himalayas' public API — no credentials required.
- `id` in search results is `<companySlug>/<jobSlug>` — pass it as-is to `detail`.
- `date` is the posting date (`pubDate`); it may be `null` for undated postings.
- `location` is the remote-from restriction list, or `"Worldwide (remote)"` when a
  role has none — treat empty restrictions as "worldwide", not "unknown".
- The API retries 429/5xx with exponential backoff; an unreachable API or a
  Cloudflare block exits non-zero with a clear message.
- Fields, endpoints, and the Cloudflare/header quirk are documented in
  `url-reference.md` for future maintenance.
