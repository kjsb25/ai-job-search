# USAJOBS API Reference

Data source for `usajobs-search`. USAJOBS (data.usajobs.gov) is the U.S. federal
government's official job board. This file records the endpoints, auth, and
response shape the CLI parses.

## Access — free API key required

Unlike the other portal skills, reads require a **free API key**:

1. Request one at <https://developer.usajobs.gov/apirequest/> (instant, email-based).
2. Export both:
   - `USAJOBS_API_KEY` → sent as the `Authorization-Key` header
   - `USAJOBS_EMAIL` → your registered email, sent as the `User-Agent` header

Required request headers: `Host: data.usajobs.gov`, `User-Agent: <email>`,
`Authorization-Key: <key>`, `Accept: application/json`. A missing/invalid key
returns **401** (the CLI surfaces this as a `NO_CREDENTIALS` error with setup
guidance). Base URL override: `USAJOBS_API_URL` (default `https://data.usajobs.gov`).

## Endpoint

```
GET /api/search?Keyword=<kw>&LocationName=<place>&ResultsPerPage=<n>&Page=<n>&DatePosted=<days>&RemoteIndicator=True
```

| Parameter | Notes |
|-----------|-------|
| `Keyword` | Free-text (title, skill, agency, announcement number) |
| `LocationName` | e.g. `Denver, Colorado` or `Colorado` |
| `ResultsPerPage` | Page size, **API max 500** |
| `Page` | **1-indexed** |
| `DatePosted` | Posted within N days, **API max 60** |
| `RemoteIndicator` | `True` to restrict to remote-flagged roles |

There is **no fetch-by-id endpoint** in the free Search API. `detail` therefore
re-runs a keyword search and matches on the control number (`MatchedObjectId`);
a `--keyword` hint (the title) improves the match. Search results already carry the
full description inline, so `detail` is a convenience, not the only way to read one.

## Response envelope

```json
{
  "LanguageCode": "EN",
  "SearchResult": {
    "SearchResultCount": 25,
    "SearchResultCountAll": 100,
    "SearchResultItems": [
      { "MatchedObjectId": "21947200", "MatchedObjectDescriptor": { … } }
    ]
  }
}
```

- `SearchResultCount` → count on this page (`meta.count`).
- `SearchResultCountAll` → total across all pages (`meta.total`).

## MatchedObjectDescriptor fields (the ones the CLI reads)

| Field | Notes |
|-------|-------|
| `PositionID` | Announcement number (e.g. `ST-12345678-26-ABC`) |
| `PositionTitle` | Job title |
| `PositionURI` | `https://www.usajobs.gov/GetJob/ViewDetails/<id>` |
| `OrganizationName` / `DepartmentName` | Hiring agency / department |
| `PositionLocationDisplay` | Human-readable location string |
| `PositionRemuneration[]` | `{MinimumRange, MaximumRange, RateIntervalCode, Description}` |
| `PositionSchedule[]` | `{Name, Code}` (e.g. Full-time) |
| `PublicationStartDate` | ISO — the posting date |
| `ApplicationCloseDate` | ISO — the closing date |
| `QualificationSummary` | Qualifications text |
| `PositionFormattedDescription[]` | `{Label, Content}` — HTML description blocks |
| `UserArea.Details` | `{JobSummary, MajorDuties, Requirements, Education, HowToApply, LowGrade, HighGrade, PromotionPotential, TeleworkEligible, RemoteIndicator}` |

## Mapping to the portal-skill contract

| Contract field | Source |
|----------------|--------|
| `id` | `MatchedObjectId` (control number) |
| `title` | `PositionTitle` |
| `company` | `OrganizationName` |
| `location` | `PositionLocationDisplay` |
| `date` | `PublicationStartDate` → `YYYY-MM-DD` |
| `url` | `PositionURI` |

Superset fields also emitted: `announcement` (`PositionID`), `salary`, `grade`
(Low/High), `schedule`, `remote` (`RemoteIndicator`), `close_date`; `detail` adds
`department`, `qualifications`, and an assembled, HTML-stripped `description`.

## Federal-role notes

Many USAJOBS postings require **U.S. citizenship** and/or a **security clearance**,
and use the GS pay-grade system. Always read a posting's eligibility section — the
job-evaluation framework's Eligibility Gate applies before scoring.
