# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; any skill you add with `/add-portal` is included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

## Search Sites

Primary (US market):
- **indeed.com** - general US job board
- **linkedin.com/jobs** - LinkedIn job listings (filter: United States, remote); also covered by `linkedin-search` CLI
- **dice.com** - tech-focused job board (optional)
- **builtincolorado.com** - Denver/Colorado regional tech board (optional, relevant given Denver-metro hybrid backup). No dedicated CLI: its `robots.txt` explicitly disallows crawling `/jobs*?search=` and filter params, so this board is WebSearch-only (via Google's index, not direct fetches) rather than a scraped portal skill - see Priority 1/2 queries below.

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for target companies: Todoist, Toggl, AllTrails, and space-industry / conservation-sector employers

## Query Categories

Queries are grouped by priority. Each query should be combined with location terms ("Remote" primarily, "Denver, CO" / "Colorado" as hybrid backup) where the site supports it.

### Priority 1: Senior/Staff Full Stack Engineer

These match the strongest and most desired career direction.

```
site:indeed.com "Senior Full Stack Engineer" Remote
site:indeed.com "Staff Software Engineer" Remote
site:linkedin.com/jobs "Senior Software Engineer" Java React Remote
site:linkedin.com/jobs "Staff Software Engineer" United States Remote
site:dice.com "Senior Software Engineer" Java Spring Remote
site:builtincolorado.com "Full Stack Developer" Denver OR Remote
site:builtincolorado.com "Senior Software Engineer" Colorado
```

### Priority 2: Target Sectors (Productivity Tools, Space, Conservation, Outdoors)

These match target companies/sectors from the candidate profile.

```
site:linkedin.com/jobs software engineer (Todoist OR Toggl)
site:linkedin.com/jobs software engineer space industry Remote
site:linkedin.com/jobs software engineer conservation OR "environmental nonprofit" Remote
site:linkedin.com/jobs software engineer (AllTrails OR "outdoor recreation") Remote
site:indeed.com software engineer conservation Remote
site:builtincolorado.com software engineer (Todoist OR Toggl OR AllTrails OR conservation OR space)
```

### Priority 3: Solutions Engineer / Technical Consultant

Adjacent roles building on the Slalom consulting experience.

```
site:indeed.com "Solutions Engineer" Java React Remote
site:indeed.com "Technical Consultant" software Remote
site:linkedin.com/jobs "Solutions Engineer" Remote
```

### Priority 4: Broader Full Stack / Java / React

Wider net for general full-stack roles.

```
site:indeed.com "Java developer" Remote
site:linkedin.com/jobs "React developer" Remote
site:dice.com "full stack" Java React Remote
```

## Location Filter

Fully remote is strongly preferred; hybrid is an acceptable backup only within the Denver, CO metro area. Not open to relocation.
- **Remote (US)** - ideal, no location constraint
- **Denver-Boulder-Fort Collins-Loveland metro, Colorado** - acceptable hybrid backup
- Other Colorado Front Range cities - borderline, evaluate commute case by case
- Any onsite/hybrid role outside Colorado, or requiring relocation - too far, exclude

## Sector/Employer Exclusions

- **Exclude defense and defense-contractor employers** - hard deal-breaker regardless of role fit or location. Screen company name/description before presenting a posting.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape space" -> Priority 2 queries + custom space-industry-specific queries
