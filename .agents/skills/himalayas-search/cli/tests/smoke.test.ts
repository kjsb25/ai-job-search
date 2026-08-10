import { expect, test, describe } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

// Live smoke tests against the Himalayas public API. They keep request volume low
// (a handful of calls) and assert the portal-skill contract: a search returns real,
// populated results in the {meta, results} shape, and bad input exits 1 with a JSON
// error on stderr. If the API is Cloudflare-blocked at test time, the search test
// surfaces that as a clear failure rather than a false pass.

interface SearchResponse {
  meta: { count: number; page: number; total: number | null }
  results: Array<{
    id: string | null
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string | null
  }>
}

describe("himalayas search (live)", () => {
  test("keyword search returns populated results in contract shape", async () => {
    const res = await runCLI(["search", "-q", "software engineer", "--limit", "5"])
    const body = parseJSON<SearchResponse>(res)

    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.length).toBeLessThanOrEqual(5)
    expect(body.meta.page).toBe(1)

    const first = body.results[0]
    expect(typeof first.title).toBe("string")
    expect(first.title.length).toBeGreaterThan(0)
    expect(first.id).toBeTruthy()
    expect(first.url).toContain("himalayas.app")
  }, 30000)

  test("browse (no query) returns latest postings", async () => {
    const res = await runCLI(["search", "--limit", "3"])
    const body = parseJSON<SearchResponse>(res)
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.length).toBeLessThanOrEqual(3)
  }, 30000)

  test("table format prints a header row", async () => {
    const res = await runCLI(["search", "-q", "engineer", "--limit", "3", "--format", "table"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("TITLE")
    expect(res.stdout).toContain("COMPANY")
  }, 30000)
})

describe("himalayas detail (live)", () => {
  test("detail re-locates a job from a fresh search id", async () => {
    const searchRes = await runCLI(["search", "-q", "software engineer", "--limit", "5"])
    const body = parseJSON<SearchResponse>(searchRes)
    const id = body.results[0]?.id
    expect(id).toBeTruthy()

    const detailRes = await runCLI(["detail", id!, "--format", "plain"])
    expect(detailRes.exitCode).toBe(0)
    expect(detailRes.stdout.length).toBeGreaterThan(0)
    expect(detailRes.stdout).toContain("id:")
  }, 30000)
})

describe("error handling", () => {
  test("detail with no id exits 1 with a JSON error on stderr", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toBe("")
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("NO_ID")
  })

  test("unknown command exits 1 with a JSON error on stderr", async () => {
    const res = await runCLI(["frobnicate"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_CMD")
  })

  test("non-numeric --limit exits 1 with a JSON error", async () => {
    const res = await runCLI(["search", "-q", "x", "--limit", "abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("unparseable detail id exits 1 with BAD_ID", async () => {
    const res = await runCLI(["detail", "!!!not a ref!!!"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_ID")
  }, 30000)
})
