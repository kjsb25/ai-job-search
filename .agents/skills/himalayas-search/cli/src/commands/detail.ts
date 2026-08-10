import { apiGet, deriveId, parseRef, toDetail, writeError, type JobDetailResult } from "../helpers.js"

export interface DetailOpts {
  id: string // a compact <companySlug>/<jobSlug> id or a full Himalayas job URL
  format: "json" | "plain"
}

/**
 * Himalayas' public job-detail pages are Cloudflare-protected (they return an HTML
 * challenge, not JSON), and there is no per-job JSON endpoint. But the keyword
 * search endpoint returns each job's *full* description inline, so we re-locate the
 * requested job by searching for keywords derived from its slug and matching on the
 * job's own applicationLink. If it falls outside the relevance window, we say so
 * plainly (the description is already present in the `search` result that produced
 * this id — that is the reliable path).
 */
export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = parseRef(opts.id)
  if (!ref) {
    writeError(`could not parse a Himalayas job reference from "${opts.id}"`, "BAD_ID")
    return 1
  }
  const wantId = `${ref.companySlug}/${ref.jobSlug}`
  const keywords = ref.jobSlug.replace(/-/g, " ")

  try {
    const env = await apiGet(`/jobs/api/search?${new URLSearchParams({ q: keywords }).toString()}`)
    const jobs = env?.jobs ?? []
    const match = jobs.find((j) => deriveId(j.applicationLink ?? j.guid) === wantId)

    if (!match) {
      writeError(
        `job "${wantId}" not found in the Himalayas search window for "${keywords}". ` +
          `Himalayas detail pages are Cloudflare-protected, so detail re-locates jobs via keyword ` +
          `search; this one fell outside the relevance window. The full description is available ` +
          `directly in the search result that produced this id.`,
        "NOT_FOUND",
      )
      return 1
    }

    const job = toDetail(match)
    if (opts.format === "plain") {
      process.stdout.write(renderPlain(job) + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

/** A human-readable rendering of one job: header, present fields, description. */
function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date)
  field("Expires", job.expires)
  field("Seniority", job.seniority)
  field("Employment", job.employment_type)
  field("Salary", job.salary)
  field("Timezones", job.timezones.length ? job.timezones.join(", ") : null)
  field("Categories", job.categories.length ? job.categories.join(", ") : null)

  lines.push("", job.description ?? job.excerpt ?? "(no description)", "", `URL: ${job.url ?? "—"}`, `id: ${job.id ?? "—"}`)
  return lines.join("\n")
}
