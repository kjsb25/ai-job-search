// Data source: the official USAJOBS Search API (https://developer.usajobs.gov),
// the U.S. federal government's job board. Unlike the other portal skills, reads
// require a FREE API key (request one at https://developer.usajobs.gov/apirequest/):
//   - USAJOBS_API_KEY   — the key, sent as the `Authorization-Key` header
//   - USAJOBS_EMAIL     — your registered email, sent as the `User-Agent` header
// There is no markup to parse: we fetch JSON and reshape it into the portal-skill
// contract's result fields. Base URL is swappable via USAJOBS_API_URL.

export const DEFAULT_BASE_URL = "https://data.usajobs.gov"

/** API base URL: USAJOBS_API_URL (for testing/proxying) or the default. */
export function baseUrl(): string {
  const raw = (process.env.USAJOBS_API_URL ?? "").trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** Missing-credentials error is its own code so the CLI can print setup guidance. */
export class MissingCredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MissingCredentialsError"
  }
}

/** Resolve the required API credentials from the environment, or throw with guidance. */
export function credentials(): { key: string; email: string } {
  const key = (process.env.USAJOBS_API_KEY ?? "").trim()
  const email = (process.env.USAJOBS_EMAIL ?? "").trim()
  if (!key || !email) {
    throw new MissingCredentialsError(
      "USAJOBS_API_KEY and USAJOBS_EMAIL must be set. Request a free key at " +
        "https://developer.usajobs.gov/apirequest/ and export both, e.g.:\n" +
        '  export USAJOBS_API_KEY="<your key>"\n' +
        '  export USAJOBS_EMAIL="you@example.com"',
    )
  }
  return { key, email }
}

/** The USAJOBS search-response envelope (only the parts this skill reads). */
export interface UsaJobsResponse {
  SearchResult?: {
    SearchResultCount?: number
    SearchResultCountAll?: number
    SearchResultItems?: SearchResultItem[]
  }
}

export interface SearchResultItem {
  MatchedObjectId?: string
  MatchedObjectDescriptor?: PositionDescriptor
}

export interface PositionDescriptor {
  PositionID?: string
  PositionTitle?: string
  PositionURI?: string
  OrganizationName?: string
  DepartmentName?: string
  PositionLocationDisplay?: string
  PositionRemuneration?: Array<{
    MinimumRange?: string
    MaximumRange?: string
    RateIntervalCode?: string
    Description?: string
  }>
  PublicationStartDate?: string
  ApplicationCloseDate?: string
  QualificationSummary?: string
  PositionFormattedDescription?: Array<{ Label?: string; Content?: string }>
  PositionSchedule?: Array<{ Name?: string; Code?: string }>
  UserArea?: {
    Details?: {
      JobSummary?: string
      MajorDuties?: string
      Requirements?: string
      Education?: string
      HowToApply?: string
      LowGrade?: string
      HighGrade?: string
      PromotionPotential?: string
      TeleworkEligible?: boolean
      RemoteIndicator?: boolean
    }
  }
}

/**
 * GET a JSON envelope from the USAJOBS API. Retries 429/5xx (transient server
 * states) with backoff; returns `null` on a 404. A 401/403 raises a clear
 * credentials error (bad/missing key) rather than a generic failure.
 */
export async function apiGet(path: string): Promise<UsaJobsResponse | null> {
  const { key, email } = credentials()
  const url = `${baseUrl()}${path}`
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          Host: "data.usajobs.gov",
          "User-Agent": email,
          "Authorization-Key": key,
          Accept: "application/json",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      throw new Error(
        `could not reach the USAJOBS API at ${baseUrl()} (${e instanceof Error ? e.message : String(e)})`,
      )
    }

    if (response.status === 401 || response.status === 403) {
      throw new MissingCredentialsError(
        `USAJOBS API rejected the credentials (${response.status}). Check USAJOBS_API_KEY and USAJOBS_EMAIL ` +
          "(the email must match the one you registered at https://developer.usajobs.gov/apirequest/).",
      )
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`USAJOBS API request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`USAJOBS API request failed: ${response.status} ${response.statusText}`)
    }
    const body = (await response.json().catch(() => null)) as UsaJobsResponse | null
    if (!body) throw new Error("USAJOBS API returned an unparseable response body")
    return body
  }
  throw new Error("USAJOBS API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A search result in the portal-skill contract shape. `id` is the MatchedObjectId
 * (the USAJOBS control number, what `detail <id>` consumes) and `date` is the
 * publication date; missing values are `null`, never omitted. The federal-specific
 * extras (announcement number, grades, salary, schedule, remote) are a superset.
 */
export interface JobResult {
  id: string | null
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  announcement: string | null
  salary: string | null
  grade: string | null
  schedule: string | null
  remote: boolean | null
  close_date: string | null
}

/** A job detail: the search result plus the cleaned, assembled description. */
export interface JobDetailResult extends JobResult {
  department: string | null
  qualifications: string | null
  description: string | null
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp, or null when absent. */
export function shortDate(iso: string | undefined | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

/** Human-readable salary line from the first remuneration entry, or null. */
function formatSalary(d: PositionDescriptor): string | null {
  const r = d.PositionRemuneration?.[0]
  if (!r || (r.MinimumRange == null && r.MaximumRange == null)) return null
  const per = r.Description ? ` ${r.Description}` : r.RateIntervalCode ? ` (${r.RateIntervalCode})` : ""
  if (r.MinimumRange && r.MaximumRange) return `$${r.MinimumRange}–$${r.MaximumRange}${per}`
  return `$${r.MinimumRange ?? r.MaximumRange}${per}`
}

/** "GS-12 to GS-13" style grade range from the low/high grade fields, or null. */
function formatGrade(d: PositionDescriptor): string | null {
  const lo = d.UserArea?.Details?.LowGrade
  const hi = d.UserArea?.Details?.HighGrade
  if (!lo && !hi) return null
  if (lo && hi && lo !== hi) return `${lo}–${hi}`
  return lo || hi || null
}

/** Reshape a USAJOBS item into the contract search-result fields. */
export function toResult(item: SearchResultItem): JobResult {
  const d = item.MatchedObjectDescriptor ?? {}
  return {
    id: item.MatchedObjectId || null,
    title: d.PositionTitle || "(untitled)",
    company: d.OrganizationName || null,
    location: d.PositionLocationDisplay || null,
    date: shortDate(d.PublicationStartDate),
    url: d.PositionURI || null,
    announcement: d.PositionID || null,
    salary: formatSalary(d),
    grade: formatGrade(d),
    schedule: d.PositionSchedule?.[0]?.Name || null,
    remote: d.UserArea?.Details?.RemoteIndicator ?? null,
    close_date: shortDate(d.ApplicationCloseDate),
  }
}

/** Reshape a USAJOBS item into the detail result (adds assembled description). */
export function toDetail(item: SearchResultItem): JobDetailResult {
  const d = item.MatchedObjectDescriptor ?? {}
  const det = d.UserArea?.Details ?? {}
  // Prefer the formatted description content; fall back to assembling the
  // structured detail fields into a readable block.
  const formatted = (d.PositionFormattedDescription ?? [])
    .map((s) => s.Content)
    .filter(Boolean)
    .join("\n\n")
  const assembled = [
    det.JobSummary && `Summary:\n${det.JobSummary}`,
    det.MajorDuties && `Duties:\n${det.MajorDuties}`,
    det.Requirements && `Requirements:\n${det.Requirements}`,
    det.Education && `Education:\n${det.Education}`,
    det.HowToApply && `How to apply:\n${det.HowToApply}`,
  ]
    .filter(Boolean)
    .join("\n\n")
  const description = cleanHtml(formatted || assembled)
  return {
    ...toResult(item),
    department: d.DepartmentName || null,
    qualifications: cleanHtml(d.QualificationSummary),
    description,
  }
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Strip a USAJOBS description's HTML into readable prose: block/line-break tags
 * become newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Extract a USAJOBS control-number id from a bare id or a ViewDetails URL. */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Full https://www.usajobs.gov/GetJob/ViewDetails/<id> URL.
  const m = trimmed.match(/ViewDetails\/(\d+)/i)
  if (m) return m[1]
  // A bare numeric control number.
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}
