import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/event-names"

function extractLatestAnalyticsEventConstraintNames(): string[] {
    const migrationsDir = path.resolve(process.cwd(), "migrations")
    const migrationFiles = readdirSync(migrationsDir)
        .filter((fileName) => fileName.endsWith(".sql"))
        .sort()

    const constraintMatches: string[][] = []

    migrationFiles.forEach((fileName) => {
        const sql = readFileSync(path.join(migrationsDir, fileName), "utf8")
        const matches = sql.matchAll(/event_name\s+(?:TEXT\s+NOT\s+NULL\s+)?(?:CONSTRAINT\s+\w+\s+)?CHECK\s*\(\s*event_name\s+IN\s*\(([\s\S]*?)\)\s*\)|ADD\s+CONSTRAINT\s+analytics_events_event_name_check\s+CHECK\s*\(\s*event_name\s+IN\s*\(([\s\S]*?)\)\s*\)/gi)

        Array.from(matches).forEach((match) => {
            const rawList = match[1] ?? match[2]
            const eventNames = Array.from(rawList.matchAll(/'([^']+)'/g)).map((eventMatch) => eventMatch[1])
            if (eventNames.length > 0) {
                constraintMatches.push(eventNames)
            }
        })
    })

    return constraintMatches.at(-1) ?? []
}

describe("analytics event names contract", () => {
    it("keeps TypeScript event names aligned with the latest analytics_events SQL constraint", () => {
        const sqlEventNames = extractLatestAnalyticsEventConstraintNames()

        expect(sqlEventNames.length).toBeGreaterThan(0)
        expect([...ANALYTICS_EVENT_NAMES].sort()).toEqual([...sqlEventNames].sort())
    })
})
