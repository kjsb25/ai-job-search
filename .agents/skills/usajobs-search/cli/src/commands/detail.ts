import { apiGet, normalizeId, toDetail, writeError, MissingCredentialsError, type JobDetailResult } from "../helpers.js"

export interface DetailOpts {
  id: string // a numeric control-number id or a ViewDetails URL
  keyword?: string // optional keyword hint to re-locate the job (title words)
  format: "json" | "plain"
}

/**
 * The USAJOBS free Search API has **no fetch-by-id endpoint**, but a `search`
 * result already carries the full description inline. `detail` re-locates a job by
 * running a keyword search and matching on the control number (`MatchedObjectId`):
 * it searches for the numeric id (USAJOBS indexes control numbers), and if the
 * caller passes `--keyword` (e.g. the title), that is used instead for a stronger
 * relevance match. If the job isn't in the returned window, it says so — the full
 * description is already present in the `search` result that produced this id.
 */
export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`could not parse a USAJOBS control-number id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  const keyword = opts.keyword?.trim() || id
  try {
    const env = await apiGet(`/api/search?${new URLSearchParams({ Keyword: keyword, ResultsPerPage: "50" }).toString()}`)
    const items = env?.SearchResult?.SearchResultItems ?? []
    const match = items.find((it) => it.MatchedObjectId === id)

    if (!match) {
      writeError(
        `job "${id}" not found in the USAJOBS search window for "${keyword}". The free Search API has no ` +
          `fetch-by-id endpoint, so detail re-locates jobs via keyword search — pass --keyword "<title words>" ` +
          `to narrow it, or use the full description already present in the search result that produced this id.`,
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
    const code = e instanceof MissingCredentialsError ? "NO_CREDENTIALS" : "DETAIL_FAILED"
    writeError(e instanceof Error ? e.message : String(e), code)
    return 1
  }
}

/** A human-readable rendering of one job: header, present fields, description. */
function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"}${job.department ? ` (${job.department})` : ""} · ${job.location ?? "—"}`]
  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Announcement", job.announcement)
  field("Posted", job.date)
  field("Closes", job.close_date)
  field("Salary", job.salary)
  field("Grade", job.grade)
  field("Schedule", job.schedule)
  if (job.remote) lines.push("Remote: yes")

  lines.push("")
  if (job.qualifications) lines.push("Qualifications:", job.qualifications, "")
  lines.push(job.description ?? "(no description)", "", `URL: ${job.url ?? "—"}`, `id: ${job.id ?? "—"}`)
  return lines.join("\n")
}
