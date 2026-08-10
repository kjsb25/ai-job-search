import { apiGet, toResult, writeError, type HimalayasJob, type JobResult } from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit: number
  location?: string // client-side filter on a job's remote-from locationRestrictions
  format: "json" | "table" | "plain"
}

/**
 * Fetch matching jobs. Two backends:
 *   - keyword search (`q` set) → GET /jobs/api/search?q= ; the endpoint ignores
 *     limit/offset and returns a fixed relevance window (~19), so pagination and
 *     the limit are applied client-side over that window.
 *   - browse (no `q`) → GET /jobs/api?limit=&offset= ; this endpoint honors real
 *     server-side pagination, so page/limit map straight to offset/limit.
 * The returned `total` is the API's totalCount for the query when available.
 */
async function fetchJobs(opts: SearchOpts): Promise<{ jobs: HimalayasJob[]; total: number | null; serverPaged: boolean }> {
  if (opts.query) {
    const p = new URLSearchParams({ q: opts.query })
    const env = await apiGet(`/jobs/api/search?${p.toString()}`)
    return { jobs: env?.jobs ?? [], total: env?.totalCount ?? null, serverPaged: false }
  }
  const p = new URLSearchParams({
    limit: String(opts.limit),
    offset: String((opts.page - 1) * opts.limit),
  })
  const env = await apiGet(`/jobs/api?${p.toString()}`)
  return { jobs: env?.jobs ?? [], total: env?.totalCount ?? null, serverPaged: true }
}

/** True when the job was posted within `days` (or when no age filter is set). */
function withinAge(j: HimalayasJob, days: number): boolean {
  if (days <= 0 || days >= 9999) return true
  if (j.pubDate == null) return false
  const cutoff = Date.now() / 1000 - days * 86400
  return j.pubDate >= cutoff
}

/** True when any of the job's remote-from locations contains `needle` (case-insensitive). */
function matchesLocation(j: HimalayasJob, needle: string): boolean {
  const q = needle.toLowerCase()
  const locs = j.locationRestrictions ?? []
  if (locs.length === 0) return "worldwide".includes(q) || "remote".includes(q)
  return locs.some((l) => l.toLowerCase().includes(q))
}

/** The date portion (YYYY-MM-DD) of a result date, or "—" when absent. */
function shortDate(date: string | null): string {
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
    { header: "COMPANY", width: 20, cell: (r) => r.company ?? "—" },
    { header: "REMOTE FROM", width: 20, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
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
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  id: ${r.id ?? "—"}`,
      `  ${r.url ?? "—"}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const { jobs, total, serverPaged } = await fetchJobs(opts)

    // Client-side filters apply to both backends (the API can't age/location filter).
    let filtered = jobs.filter((j) => withinAge(j, opts.jobage))
    if (opts.location) filtered = filtered.filter((j) => matchesLocation(j, opts.location!))

    // Browse is already server-paged (one page fetched); the keyword window is the
    // whole relevance set, so slice it here for page/limit.
    const paged = serverPaged
      ? filtered.slice(0, opts.limit)
      : filtered.slice((opts.page - 1) * opts.limit, (opts.page - 1) * opts.limit + opts.limit)

    const rows = paged.map(toResult)

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
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
