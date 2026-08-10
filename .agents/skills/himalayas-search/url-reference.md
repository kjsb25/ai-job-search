# Himalayas API Reference

Data source for `himalayas-search`. Himalayas (himalayas.app) is a **remote-only**
job board with a public, keyless JSON API. This file records the endpoints and
response shape the CLI parses, so a future maintainer can fix the parsers when the
API changes.

## Access

- **No API key.** Reads are public.
- **Cloudflare-fronted.** The API sits behind Cloudflare, which fingerprints the
  `User-Agent`. A realistic desktop-Chrome UA passes; some Linux/older-Chrome UAs
  get a "Just a moment..." HTML interstitial instead of JSON. `helpers.ts` sends a
  full browser-like header set (`User-Agent`, `Accept`, `Accept-Language`,
  `Referer`) to stay on the passing side. `apiGet` detects an interstitial (HTML
  where JSON was expected) and raises a clear, non-retryable error.
- **Base URL override:** `HIMALAYAS_API_URL` (default `https://himalayas.app`), for
  testing or routing through a local relay/proxy.

## Endpoints

### Browse (no keyword) — real server-side pagination

```
GET /jobs/api?limit=<n>&offset=<n>
```

Returns the newest postings. `limit` and `offset` are **honored**, so this backs
the "browse latest remote jobs" path (`search` with no `-q`). `totalCount` is the
whole corpus (~100k+).

### Keyword search — relevance window, NO server pagination

```
GET /jobs/api/search?q=<keywords>
```

Full-text relevance search over titles/roles. **Ignores `limit` and `offset`** —
it always returns a fixed relevance window (~19 jobs), with `offset:0` and
`limit:20` echoed back regardless of what you send. `totalCount` is the number of
matches for the query. The CLI therefore applies `--limit`/`--page` **client-side**
by slicing this window, and `--jobage`/`--location` as client-side filters.

### Detail — none usable

Public job-detail pages (`/companies/<companySlug>/jobs/<jobSlug>`) are
**Cloudflare-protected** (return a 403 HTML challenge), and there is **no per-job
JSON endpoint**. The CLI's `detail` command instead re-locates a job by running the
keyword search on words derived from the job slug and matching on the job's own
`applicationLink`. This works when the job is inside the relevance window; if not,
`detail` returns a clear `NOT_FOUND` (the full description is already present in the
`search` result that produced the id).

## Response envelope

Both list endpoints return:

```json
{
  "comments": "…changelog note…",
  "updatedAt": 1786375404,
  "offset": 0,
  "limit": 20,
  "totalCount": 267,
  "jobs": [ { …job… } ]
}
```

## Job object fields (the ones the CLI reads)

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Job title |
| `excerpt` | string | Short teaser |
| `companyName` | string | Employer |
| `companySlug` | string | Company slug (part of the URL / derived id) |
| `employmentType` | string | e.g. "Full Time" |
| `minSalary` / `maxSalary` | number\|null | Often null |
| `currency` / `salaryPeriod` | string\|null | e.g. "USD", "annual" |
| `seniority` | string[] | e.g. `["Senior"]` |
| `locationRestrictions` | string[] | **Remote-from** countries/regions; empty = worldwide |
| `timezoneRestrictions` | string[] | e.g. `["-8","-7",…]` |
| `categories` | string[] | Taxonomy tags |
| `description` | string | Full HTML description (present inline in list responses) |
| `pubDate` | number | Unix **seconds** — posting date |
| `expiryDate` | number | Unix **seconds** — expiry |
| `applicationLink` | string | The job URL: `https://himalayas.app/companies/<companySlug>/jobs/<jobSlug>` |
| `guid` | string | Equals `applicationLink` |

There is **no `id` or `url` field.** The CLI derives:
- `url` = `applicationLink` (or `guid`).
- `id` = `<companySlug>/<jobSlug>` parsed from that link (compact, stable, and what
  `detail <id>` consumes).

## Mapping to the portal-skill contract

| Contract field | Source |
|----------------|--------|
| `id` | `<companySlug>/<jobSlug>` from `applicationLink` |
| `title` | `title` |
| `company` | `companyName` |
| `location` | `locationRestrictions` joined, or `"Worldwide (remote)"` when empty |
| `date` | `pubDate` (unix s) → `YYYY-MM-DD` |
| `url` | `applicationLink` |

Superset fields also emitted: `employment_type`, `seniority`, `salary`,
`remote_locations`, `timezones` (and, in `detail`, `excerpt`, `categories`,
`expires`, cleaned `description`).
