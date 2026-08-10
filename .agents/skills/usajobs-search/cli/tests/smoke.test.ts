import { expect, test, describe, beforeAll, afterAll } from "bun:test"
import { join } from "path"
import { runCLI, parseJSON } from "./helpers.js"

// USAJOBS requires a free API key, so these tests do NOT hit the live API. Instead:
//   1. A local fixture server (Bun.serve) returns a realistic USAJOBS response, and
//      USAJOBS_API_URL points the CLI at it — this exercises the real fetch → parse →
//      reshape → render path against the documented response shape.
//   2. Offline tests verify credential-gating and argument validation.
// When you add your own key, run the live checks in the SKILL.md "Activation" section.

const fixture = await Bun.file(join(import.meta.dir, "fixtures/search.json")).text()

let server: ReturnType<typeof Bun.serve>
let PORT = 0

const withCreds = () => ({
  USAJOBS_API_KEY: "test-key",
  USAJOBS_EMAIL: "test@example.com",
  USAJOBS_API_URL: `http://127.0.0.1:${PORT}`,
})

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === "/api/search") {
        return new Response(fixture, { headers: { "Content-Type": "application/json" } })
      }
      return new Response("not found", { status: 404 })
    },
  })
  PORT = server.port
})

afterAll(() => server.stop(true))

interface SearchResponse {
  meta: { count: number; page: number; total: number | null }
  results: Array<{
    id: string | null
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string | null
    salary: string | null
    grade: string | null
    remote: boolean | null
  }>
}

describe("usajobs search (fixture)", () => {
  test("returns contract shape with reshaped federal fields", async () => {
    const res = await runCLI(["search", "-q", "software", "--limit", "10"], withCreds())
    const body = parseJSON<SearchResponse>(res)

    expect(body.meta.total).toBe(137)
    expect(body.results.length).toBe(2)

    const a = body.results[0]
    expect(a.id).toBe("12345678")
    expect(a.title).toBe("IT Specialist (Application Software)")
    expect(a.company).toBe("U.S. Fish and Wildlife Service")
    expect(a.location).toBe("Fort Collins, Colorado")
    expect(a.date).toBe("2026-08-01")
    expect(a.url).toContain("usajobs.gov")
    expect(a.salary).toContain("98496")
    expect(a.grade).toBe("GS-11–GS-12")
    expect(a.remote).toBe(false)

    expect(body.results[1].remote).toBe(true)
    expect(body.results[1].grade).toBe("GS-13")
  })

  test("table format prints a header row", async () => {
    const res = await runCLI(["search", "-q", "software", "--format", "table"], withCreds())
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("TITLE")
    expect(res.stdout).toContain("AGENCY")
  })

  test("detail re-locates a job by id and assembles the description", async () => {
    const res = await runCLI(["detail", "12345678", "--format", "plain"], withCreds())
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("IT Specialist")
    expect(res.stdout).toContain("Endangered Species Act")
    expect(res.stdout).toContain("id: 12345678")
    // HTML in the fixture description must be stripped.
    expect(res.stdout).not.toContain("<p>")
    expect(res.stdout).not.toContain("<ul>")
  })

  test("detail on an unknown id exits 1 with NOT_FOUND", async () => {
    const res = await runCLI(["detail", "99999999"], withCreds())
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("NOT_FOUND")
  })

  test("detail accepts a ViewDetails URL", async () => {
    const res = await runCLI(
      ["detail", "https://www.usajobs.gov/GetJob/ViewDetails/87654321", "--format", "plain"],
      withCreds(),
    )
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("Software Developer")
    expect(res.stdout).toContain("Remote: yes")
  })
})

describe("credential gating", () => {
  test("search without credentials exits 1 with NO_CREDENTIALS", async () => {
    const res = await runCLI(["search", "-q", "software"], {
      USAJOBS_API_KEY: "",
      USAJOBS_EMAIL: "",
      USAJOBS_API_URL: `http://127.0.0.1:${PORT}`,
    })
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toBe("")
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("NO_CREDENTIALS")
    expect(err.error).toContain("developer.usajobs.gov")
  })
})

describe("argument validation", () => {
  test("detail with no id exits 1 with NO_ID", async () => {
    const res = await runCLI(["detail"], withCreds())
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("NO_ID")
  })

  test("unparseable detail id exits 1 with BAD_ID", async () => {
    const res = await runCLI(["detail", "not-a-number"], withCreds())
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ID")
  })

  test("non-numeric --limit exits 1 with BAD_ARG", async () => {
    const res = await runCLI(["search", "-q", "x", "--limit", "abc"], withCreds())
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_ARG")
  })

  test("unknown command exits 1 with BAD_CMD", async () => {
    const res = await runCLI(["frobnicate"], withCreds())
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("BAD_CMD")
  })
})
