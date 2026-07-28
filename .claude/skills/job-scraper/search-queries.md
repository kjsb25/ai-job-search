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
- **ziprecruiter.com** - general US job board (optional). No dedicated CLI: `/add-portal` investigated it directly and found `robots.txt` disallows `/?search=`, and direct requests are blocked by a Cloudflare bot challenge before any content loads - not scrapeable even for public, unauthenticated pages. WebSearch-only, same pattern as builtincolorado.com. ZipRecruiter's own "Jobs API" is a partner/employer integration for *posting* jobs (requires a business partner registration with ZipRecruiter), not a job-seeker search API - not usable here.

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for target companies: Todoist, Toggl, AllTrails, Nvidia, and space-industry / conservation-sector employers

## Title Synonyms & Phrasing

Job boards are inconsistent about "Engineer" vs "Developer" vs other synonyms for
the same role, and a query pinned to one exact phrase silently misses postings
using another. Combine variants with boolean OR rather than picking one phrase per
query - see "Search Methods by Portal" below for how OR is expressed per source.

**Core role terms** (same role, interchangeable phrasing):
- Software Engineer / Software Developer / Developer / Programmer
- SDE / SWE / Software Development Engineer
- Applications Engineer / Application Developer
- Member of Technical Staff / MTS *(common at startups in lieu of a leveled title)*

**Full-stack variants:**
- Full Stack Engineer / Full Stack Developer / Full-Stack Software Engineer / Fullstack Engineer

**Stack-specific variants** (combine with the above or use standalone):
- Java Developer / Java Engineer
- React Developer / Frontend Engineer / Frontend Developer / UI Engineer
- Backend Engineer / Backend Developer
- Web Developer

**Seniority prefixes** (combine with any core/full-stack term above):
- Senior / Sr. / Staff / Lead / Principal

## Search Methods by Portal

How to express "match any of these title synonyms" differs per source - use the
right mechanism instead of running one query per phrasing:

- **`linkedin-search` CLI** - the `--query`/`-q` value is passed straight through
  as LinkedIn's own `keywords` search param, which supports quoted phrases and
  boolean `OR`/`AND`/`NOT` natively. Combine title synonyms in one query, e.g.
  `-q '("Software Engineer" OR "Software Developer" OR "Full Stack Engineer") Java React'`,
  rather than issuing a separate CLI call per phrasing.
- **`freehire-search` CLI** - prefer the structured `--category` (`backend`,
  `frontend`, `fullstack`) and `--skill` facets over title-string matching
  entirely. freehire classifies postings by category/skill facets rather than
  parsing title text, so `--category fullstack --skill java,react` sidesteps the
  Engineer-vs-Developer ambiguity rather than fighting it with OR strings in `-q`.
- **`site:` WebSearch fallback (Google)** - group synonyms in one line with `OR`
  outside the quotes: `("Senior Software Engineer" OR "Senior Software Developer"
  OR "Senior Full Stack Engineer" OR "Senior Full Stack Developer")`. Keep each
  quoted phrase exact (Google doesn't stem Engineer/Developer for you) but let the
  OR group carry the ambiguity instead of writing one query per phrase.

## Query Categories

Queries are grouped by priority. Each query should be combined with location terms ("Remote" primarily, "Denver, CO" / "Colorado" as hybrid backup) where the site supports it.

### Priority 1: Senior/Staff Full Stack Engineer

These match the strongest and most desired career direction.

```
bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q '("Senior Software Engineer" OR "Senior Software Developer" OR "Senior Full Stack Engineer" OR "Senior Full Stack Developer" OR "Staff Software Engineer" OR "Staff Software Developer") Java React' -l "Remote"
bun run .agents/skills/freehire-search/cli/src/cli.ts search --category fullstack --skill java,react --seniority senior,staff --remote remote
site:indeed.com ("Senior Full Stack Engineer" OR "Senior Full Stack Developer" OR "Staff Software Engineer" OR "Staff Software Developer") Remote
site:dice.com ("Senior Software Engineer" OR "Senior Software Developer") Java Spring Remote
site:builtincolorado.com ("Full Stack Developer" OR "Full Stack Engineer") Denver OR Remote
site:builtincolorado.com ("Senior Software Engineer" OR "Senior Software Developer") Colorado
site:ziprecruiter.com ("Senior Software Engineer" OR "Senior Software Developer" OR "Senior Full Stack Engineer" OR "Senior Full Stack Developer") Remote
site:ziprecruiter.com ("Staff Software Engineer" OR "Staff Software Developer") Java Remote
```

### Priority 2: Target Sectors (Productivity Tools, Space, Conservation, Outdoors)

These match target companies/sectors from the candidate profile.

```
site:linkedin.com/jobs ("software engineer" OR "software developer") (Todoist OR Toggl)
site:linkedin.com/jobs ("software engineer" OR "software developer") space industry Remote
site:linkedin.com/jobs ("software engineer" OR "software developer") conservation OR "environmental nonprofit" Remote
site:linkedin.com/jobs ("software engineer" OR "software developer") (AllTrails OR "outdoor recreation") Remote
site:linkedin.com/jobs ("software engineer" OR "software developer") Nvidia Remote
site:indeed.com ("software engineer" OR "software developer") conservation Remote
site:indeed.com "Nvidia" ("software engineer" OR "software developer") Remote
site:builtincolorado.com ("software engineer" OR "software developer") (Todoist OR Toggl OR AllTrails OR conservation OR space OR Nvidia)
site:ziprecruiter.com ("software engineer" OR "software developer") (Todoist OR Toggl OR AllTrails OR conservation OR space OR Nvidia) Remote
```

### Priority 3: Solutions Engineer / Technical Consultant

Adjacent roles building on the Slalom consulting experience.

```
site:indeed.com ("Solutions Engineer" OR "Implementation Engineer" OR "Customer Engineer") Java React Remote
site:indeed.com "Technical Consultant" software Remote
site:linkedin.com/jobs ("Solutions Engineer" OR "Implementation Engineer") Remote
```

### Priority 4: Broader Full Stack / Java / React

Wider net for general full-stack roles - the widest synonym coverage, since this
tier exists to catch what Priorities 1-3 miss.

```
bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q '("Java Developer" OR "Java Engineer" OR "React Developer" OR "Frontend Engineer" OR "Backend Engineer" OR SDE OR SWE OR Programmer)' -l "Remote"
site:indeed.com ("Java developer" OR "Java engineer") Remote
site:linkedin.com/jobs ("React developer" OR "Frontend engineer" OR "Frontend developer") Remote
site:dice.com "full stack" (Engineer OR Developer) Java React Remote
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
