import { describe, expect, it } from "vitest"
import { getBogotaDayRange, getBogotaRecentDayRanges } from "@/lib/utils/date"

describe("Bogota date ranges", () => {
    it("keeps late Colombia evening in the same local day", () => {
        const range = getBogotaDayRange("2026-05-07T01:45:00.000Z")

        expect(range).toEqual({
            start: "2026-05-06T05:00:00.000Z",
            end: "2026-05-07T05:00:00.000Z",
        })
    })

    it("builds recent day ranges using Colombia day labels", () => {
        const ranges = getBogotaRecentDayRanges(2, "2026-05-07T01:45:00.000Z")

        expect(ranges).toEqual([
            {
                label: "M",
                start: "2026-05-05T05:00:00.000Z",
                end: "2026-05-06T05:00:00.000Z",
            },
            {
                label: "X",
                start: "2026-05-06T05:00:00.000Z",
                end: "2026-05-07T05:00:00.000Z",
            },
        ])
    })
})
