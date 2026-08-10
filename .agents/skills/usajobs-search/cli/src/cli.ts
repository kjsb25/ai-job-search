#!/usr/bin/env bun
// Self-contained CLI for searching the official USAJOBS Search API (the U.S.
// federal government's job board). No external CLI framework and zero runtime
// dependencies. Reads require a FREE API key (request at
// https://developer.usajobs.gov/apirequest/), supplied via environment variables:
//   USAJOBS_API_KEY  — sent as the Authorization-Key header
//   USAJOBS_EMAIL    — your registered email, sent as the User-Agent header

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { baseUrl } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

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

const HELP = `usajobs-cli — search the official USAJOBS federal job board (data.usajobs.gov)

SETUP (required — reads need a FREE key)
  Request a key at https://developer.usajobs.gov/apirequest/, then:
    export USAJOBS_API_KEY="<your key>"
    export USAJOBS_EMAIL="you@example.com"   # the email you registered

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags] [--format json|table|plain]
  bun run src/cli.ts detail <id|url> [--keyword "<title words>"] [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill, agency).
  --location, -l <place>  LocationName filter, e.g. "Denver, Colorado" or "Colorado".
  --remote                Only roles flagged remote (RemoteIndicator).
  --jobage <days>         Posted within N days (DatePosted; API max 60).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page (ResultsPerPage; API max 500). Default 25.
  --format <fmt>          json (default) | table | plain.

DETAIL
  <id|url>                A USAJOBS control-number id (a search result's "id") or a
                          https://www.usajobs.gov/GetJob/ViewDetails/<id> URL.
  --keyword <text>        Optional title words to re-locate the job (the free API has
                          no fetch-by-id endpoint; detail re-searches and matches).

EXAMPLES
  bun run src/cli.ts search -q "software engineer" --location "Colorado" --format table
  bun run src/cli.ts search -q "developer" --remote --jobage 14 --format table
  bun run src/cli.ts detail 21947200 --keyword "IT specialist" --format plain

Source: ${baseUrl()} (official USAJOBS Search API). Federal roles; many require U.S.
citizenship and/or a security clearance — read each posting's eligibility section.
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
      location: stringFlag(flags.location),
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 0,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? Math.max(1, parseInt(flags.limit as string, 10)) : 25,
      remote: flags.remote === true || flags.remote === "true",
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
    const opts: DetailOpts = { id, keyword: stringFlag(flags.keyword), format: fmt === "plain" ? "plain" : "json" }
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
