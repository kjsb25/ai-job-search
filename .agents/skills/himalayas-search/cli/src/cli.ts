#!/usr/bin/env bun
// Self-contained CLI for searching the Himalayas (himalayas.app) remote-jobs API.
// No external CLI framework and zero runtime dependencies, so it runs anywhere
// `bun` is available with nothing installed beyond the repo clone.
//
// Reads are public (no API key). The API sits behind Cloudflare, which fingerprints
// the User-Agent — helpers.ts sends a browser-like header set to pass that check.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { baseUrl } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Short-flag aliases.
const ALIAS: Record<string, string> = { q: "query", n: "limit", l: "location" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-")) {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    const next = argv[i + 1]
    // A flag with no following value (or another flag next) is a boolean.
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    flags[key] = value
  }
  return flags
}

function stringFlag(raw: string | boolean | string[] | undefined): string | undefined {
  return typeof raw === "string" ? raw : undefined
}

const HELP = `himalayas-cli — search the Himalayas remote-jobs board (himalayas.app)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags] [--format json|table|plain]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title/role). Relevance search over ~19 results.
                          Omit -q to BROWSE the latest postings (real pagination).
  --location, -l <place>  Filter to roles open to that remote-from country/region
                          (client-side match on the job's location restrictions).
  --jobage <days>         Posted within N days (client-side filter on posting date).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page. Default 25.
  --format <fmt>          json (default) | table | plain.

DETAIL
  <id|url>                A Himalayas job id (from a search result's "id", shaped
                          <companySlug>/<jobSlug>) or a full
                          https://himalayas.app/companies/<c>/jobs/<j> URL.

EXAMPLES
  bun run src/cli.ts search -q "software engineer" --limit 10 --format table
  bun run src/cli.ts search -q "react" --location "United States" --format table
  bun run src/cli.ts search --jobage 3 --limit 15 --format table   # browse newest
  bun run src/cli.ts detail valce-talent-solutions/software-engineer --format plain

Reads are public (no API key). Source: ${baseUrl()} (Cloudflare-fronted; the CLI
sends browser-like headers). Override with HIMALAYAS_API_URL for testing/proxying.
Himalayas is a REMOTE-ONLY board, so "location" means which country/timezone a
remote role may be worked from, not an office.
`

function parseIntFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = parseInt(raw as string, 10)
  if (isNaN(val)) {
    process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"
    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }
    const opts: SearchOpts = {
      query: stringFlag(flags.query),
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? Math.max(1, parseInt(flags.limit as string, 10)) : 25,
      location: stringFlag(flags.location),
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: fmt === "plain" ? "plain" : "json" }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
