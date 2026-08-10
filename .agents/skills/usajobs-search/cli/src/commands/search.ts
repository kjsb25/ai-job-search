import { apiGet, toResult, writeError, MissingCredentialsError, type JobResult } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit: number
  remote: boolean
  format: "json" | "table" | "plain"
}

/**
 * Build the USAJOBS /api/search query string. USAJOBS uses 1-indexed `Page`,
 * `ResultsPerPage` (max 500), `DatePosted` in days (0–60), and `RemoteIndicator`.
 */
function buildQuery(opts: SearchOpts): URLSearchParams {
  const p = new URLSearchParams()
  if (opts.query) p.set("Keyword", opts.query)
  if (opts.location) p.set("LocationName", opts.location)
  p.set("ResultsPerPage", String(Math.min(500, opts.limit)))
  p.set("Page", String(opts.page))
  // DatePosted is capped at 60 days by the API; only send a meaningful value.
  if (opts.jobage > 0 && opts.jobage <= 60) p.set("DatePosted", String(opts.jobage))
  if (opts.remote) p.set("RemoteIndicator", "True")
  return p
}

function shortDateCell(date: string | null): string {
  return date ?? "—"
}

interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => (r.id ?? "").length)), cell: (r) => r.id ?? "—" },
    { header: "TITLE", width: 36, cell: (r) => r.title },
    { header: "AGENCY", width: 26, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 24, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDateCell(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")
  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDateCell(r.date)}`,
      `  ${r.salary ?? "salary n/a"}${r.grade ? ` · ${r.grade}` : ""}${r.remote ? " · remote" : ""}`,
      `  id: ${r.id ?? "—"}`,
      `  ${r.url ?? "—"}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const env = await apiGet(`/api/search?${buildQuery(opts).toString()}`)
    const result = env?.SearchResult
    const items = result?.SearchResultItems ?? []
    const rows = items.map(toResult)
    const total = result?.SearchResultCountAll ?? rows.length

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: rows.length, page: opts.page, total }, results: rows }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    const code = e instanceof MissingCredentialsError ? "NO_CREDENTIALS" : "SEARCH_FAILED"
    writeError(e instanceof Error ? e.message : String(e), code)
    return 1
  }
}
