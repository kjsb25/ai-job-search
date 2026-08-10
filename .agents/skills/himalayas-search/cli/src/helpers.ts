// Data source: the Himalayas (himalayas.app) public jobs JSON API. Reads are
// unauthenticated — no API key, the same bar as linkedin-search — and unlike the
// HTML-scraping portals there is no markup to parse: we fetch JSON and reshape it
// into the portal-skill contract's result fields. The base URL is swappable via
// HIMALAYAS_API_URL (the API is behind Cloudflare; see the header note below).

export const DEFAULT_BASE_URL = "https://himalayas.app"

/** API base URL: HIMALAYAS_API_URL (for testing/proxying) or the default. */
export function baseUrl(): string {
  const raw = (process.env.HIMALAYAS_API_URL ?? "").trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

// Himalayas' API sits behind Cloudflare, which fingerprints the User-Agent: a
// realistic desktop-Chrome UA passes, while some Linux/older-Chrome UAs get a
// "Just a moment..." interstitial (an HTML challenge, not JSON). Send a full,
// browser-like header set to stay on the passing side of that check.
const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://himalayas.app/jobs",
}

/** The Himalayas jobs-API envelope: pagination metadata plus the jobs array. */
export interface HimalayasResponse {
  comments?: string
  updatedAt?: number
  offset?: number
  limit?: number
  totalCount?: number
  jobs: HimalayasJob[]
}

/**
 * HTTP GET returning `{ status, body }`. Tries Bun's `fetch` first; if fetch throws
 * a connection-level error (e.g. ECONNRESET / "socket connection closed unexpectedly")
 * AND an egress proxy is configured, it retries once via `curl`, which is proxy- and
 * CA-aware. Bun's fetch cannot traverse some egress proxies (notably the Claude Code
 * cloud sandbox's), so this lets the skill work both locally and inside cloud sessions.
 * With no proxy configured the fetch error propagates unchanged — no curl dependency.
 */
async function httpGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(15000) })
    return { status: res.status, body: await res.text() }
  } catch (e) {
    if (!proxyConfigured()) throw e
    return curlGet(url, headers)
  }
}

/** True when an HTTPS egress proxy is configured (so the curl fallback is worth trying). */
function proxyConfigured(): boolean {
  return Boolean(process.env.HTTPS_PROXY || process.env.https_proxy)
}

const STATUS_MARKER = "\n__CCR_HTTP_STATUS__"

/** Proxy-aware GET via curl, the fallback when Bun's fetch can't reach the host. */
async function curlGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  const args = ["-sSL", "--max-time", "20", "-w", `${STATUS_MARKER}%{http_code}`]
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`)
  args.push(url)
  const proc = Bun.spawn(["curl", ...args], { stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const idx = out.lastIndexOf(STATUS_MARKER)
  if (idx < 0) throw new Error(`curl fallback failed (exit ${code})${err ? `: ${err.trim()}` : ""}`)
  return { status: parseInt(out.slice(idx + STATUS_MARKER.length).trim(), 10) || 0, body: out.slice(0, idx) }
}

/**
 * GET a JSON envelope from the Himalayas API. Retries 429/5xx (transient server
 * states) with backoff; returns `null` on a 404. A Cloudflare interstitial (an
 * HTML body where JSON was expected) is surfaced as a clear, non-retryable error
 * so an access block degrades this source rather than looking like an empty result.
 */
export async function apiGet(path: string): Promise<HimalayasResponse | null> {
  const url = `${baseUrl()}${path}`
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let status: number
    let rawBody: string
    try {
      ;({ status, body: rawBody } = await httpGet(url, REQUEST_HEADERS))
    } catch (e) {
      // Connection refused / DNS failure / timeout: the API is unreachable.
      throw new Error(
        `could not reach the Himalayas API at ${baseUrl()} (${e instanceof Error ? e.message : String(e)})`,
      )
    }

    if (status === 429 || status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Himalayas API request failed: ${status}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (status === 404) return null

    // Cloudflare returns 403/503 (or even 200) with an HTML challenge page. Detect
    // the interstitial and give an actionable message instead of a JSON parse error.
    if (/^\s*<!DOCTYPE html>/i.test(rawBody) || rawBody.includes("Just a moment")) {
      throw new Error(
        "Himalayas API returned a Cloudflare challenge page instead of JSON (access temporarily blocked); retry later",
      )
    }
    if (status < 200 || status >= 300) {
      throw new Error(`Himalayas API request failed: ${status}`)
    }
    let body: HimalayasResponse | null
    try {
      body = JSON.parse(rawBody) as HimalayasResponse
    } catch {
      throw new Error("Himalayas API returned an unparseable response body")
    }
    if (!body || !Array.isArray(body.jobs)) {
      throw new Error("Himalayas API returned an unexpected response shape (no jobs array)")
    }
    return body
  }
  // Unreachable in practice; the loop returns or throws on the last attempt.
  throw new Error("Himalayas API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A Himalayas job — the fields this skill reads (the wire shape carries more).
 * Himalayas is remote-only, so geography is expressed as `locationRestrictions`
 * (which countries the remote role may be worked from) and `timezoneRestrictions`.
 */
export interface HimalayasJob {
  title: string
  excerpt?: string
  companyName?: string
  companySlug?: string
  companyLogo?: string
  employmentType?: string
  minSalary?: number | null
  maxSalary?: number | null
  salaryPeriod?: string | null
  currency?: string | null
  seniority?: string[]
  locationRestrictions?: string[]
  timezoneRestrictions?: string[]
  categories?: string[]
  parentCategories?: string[]
  description?: string
  pubDate?: number // unix seconds
  expiryDate?: number // unix seconds
  applicationLink?: string // the job URL, e.g. himalayas.app/companies/<c>/jobs/<j>
  guid?: string // equals applicationLink
}

/**
 * A search result in the portal-skill contract shape. `id` is the derived
 * `<companySlug>/<jobSlug>` key (what `detail <id>` consumes) and `date` is the
 * posting date; missing values are `null`, never omitted. The extra remote-work
 * fields (seniority, salary, remote-from locations, timezones) are a permitted superset.
 */
export interface JobResult {
  id: string | null
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  employment_type: string | null
  seniority: string | null
  salary: string | null
  remote_locations: string[]
  timezones: string[]
}

/** A job detail: the search result plus the cleaned description, categories, excerpt. */
export interface JobDetailResult extends JobResult {
  excerpt: string | null
  categories: string[]
  expires: string | null
  description: string | null
}

/**
 * Derive a stable, compact id (`<companySlug>/<jobSlug>`) from a job's
 * applicationLink/guid URL. Returns null when the link is missing or unparseable.
 */
export function deriveId(link: string | undefined | null): string | null {
  if (!link) return null
  const m = link.match(/\/companies\/([^/?#]+)\/jobs\/([^/?#]+)/)
  return m ? `${m[1]}/${m[2]}` : null
}

/** A parsed job reference: the company and job slug pair used to re-locate a job. */
export interface JobRef {
  companySlug: string
  jobSlug: string
}

/** Parse a job reference from a compact id (`company/job`) or a full Himalayas URL. */
export function parseRef(input: string): JobRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Full /companies/<c>/jobs/<j> URL (or path).
  const url = trimmed.match(/\/companies\/([^/?#]+)\/jobs\/([^/?#]+)/)
  if (url) return { companySlug: url[1], jobSlug: url[2] }
  // Compact "companySlug/jobSlug" id (no scheme, exactly one slash).
  const compact = trimmed.match(/^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/i)
  if (compact) return { companySlug: compact[1], jobSlug: compact[2] }
  return null
}

/** The date portion (YYYY-MM-DD) of a unix-seconds timestamp, or null when absent. */
export function unixToDate(sec: number | undefined | null): string | null {
  if (sec == null || !isFinite(sec)) return null
  return new Date(sec * 1000).toISOString().slice(0, 10)
}

/** Human-readable remote-work location line: the restrictions, or "Worldwide". */
function formatLocation(j: HimalayasJob): string {
  const locs = j.locationRestrictions ?? []
  if (locs.length) return locs.join(", ")
  return "Worldwide (remote)"
}

/** Human-readable salary line from the salary fields, or null when absent. */
function formatSalary(j: HimalayasJob): string | null {
  if (j.minSalary == null && j.maxSalary == null) return null
  const cur = j.currency ? `${j.currency} ` : ""
  const per = j.salaryPeriod ? `/${j.salaryPeriod}` : ""
  if (j.minSalary != null && j.maxSalary != null) return `${cur}${j.minSalary}–${j.maxSalary}${per}`
  return `${cur}${j.minSalary ?? j.maxSalary}${per}`
}

/** Reshape a Himalayas job into the contract search-result fields. */
export function toResult(j: HimalayasJob): JobResult {
  return {
    id: deriveId(j.applicationLink ?? j.guid),
    title: j.title || "(untitled)",
    company: j.companyName || null,
    location: formatLocation(j),
    date: unixToDate(j.pubDate),
    url: j.applicationLink || j.guid || null,
    employment_type: j.employmentType || null,
    seniority: j.seniority && j.seniority.length ? j.seniority.join(", ") : null,
    salary: formatSalary(j),
    remote_locations: j.locationRestrictions ?? [],
    timezones: j.timezoneRestrictions ?? [],
  }
}

/** Reshape a Himalayas job into the detail result (adds cleaned description + more). */
export function toDetail(j: HimalayasJob): JobDetailResult {
  return {
    ...toResult(j),
    excerpt: j.excerpt || null,
    categories: j.categories ?? [],
    expires: unixToDate(j.expiryDate),
    description: cleanHtml(j.description),
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
 * Strip a Himalayas description's HTML into readable prose: block/line-break tags
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
