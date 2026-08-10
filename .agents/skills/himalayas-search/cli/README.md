# himalayas-cli

Zero-dependency Bun CLI for searching the [Himalayas](https://himalayas.app)
remote-jobs board via its public JSON API. No API key. Same structure and
portal-skill contract as `linkedin-search` and `freehire-search`.

## Install

```bash
cd .agents/skills/himalayas-search/cli && bun install && cd ../../../..
```

`bun install` pulls only dev types (`typescript`, `@types/bun`) — there are no
runtime dependencies.

## Usage

```bash
# Keyword search (relevance window), table view
bun run src/cli.ts search -q "software engineer" --limit 10 --format table

# Browse the newest postings (no keyword → real server pagination)
bun run src/cli.ts search --jobage 3 --limit 15 --format table

# Filter to roles open to a remote-from country
bun run src/cli.ts search -q "react" --location "United States" --format table

# Full detail for one job (id comes from a search result's "id")
bun run src/cli.ts detail valce-talent-solutions/software-engineer --format plain
```

## Commands & flags

- `search [-q <keywords>] [-l <place>] [--jobage <days>] [--page <n>] [--limit <n>] [--format json|table|plain]`
- `detail <id|url> [--format json|plain]`

`id` is the `<companySlug>/<jobSlug>` value from a search result; a full
`https://himalayas.app/companies/<c>/jobs/<j>` URL also works.

## Output

Search JSON is `{ "meta": { count, page, total }, "results": [...] }`; each result
has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values are
`null`). Errors go to **stderr** as `{ "error", "code" }` with exit code `1`.

## Notes

- Himalayas is **remote-only**, so `location` means which country/timezone a remote
  role may be worked from, not an office.
- The keyword search endpoint returns a fixed relevance window (~19) and ignores
  server pagination; `--limit`/`--page`/`--jobage`/`--location` are applied
  client-side. Browsing without `-q` uses real server pagination.
- Detail pages are Cloudflare-protected, so `detail` re-locates a job via the search
  API. If a job falls outside the relevance window, use the description already in
  the `search` result.
- `HIMALAYAS_API_URL` overrides the base URL (for testing or a local relay/proxy).

## Test

```bash
bun run typecheck
bun run test          # live smoke tests against the API
```

The API is Cloudflare-fronted; if tests fail with a "Cloudflare challenge" error,
the source is temporarily blocking automated access — retry later.
