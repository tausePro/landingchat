import { describe, expect, it } from "vitest"
import {
    formatCentsAsUsd,
    formatCentsAsUsdCompact,
    formatLatency,
    formatPercent,
    formatRelativeTime,
    formatTokens,
} from "@/app/admin/ai-usage/lib/format"

describe("formatCentsAsUsd", () => {
    it("100 cents → $1.00", () => {
        expect(formatCentsAsUsd(100)).toBe("$1.00")
    })

    it("12345 cents → $123.45", () => {
        expect(formatCentsAsUsd(12345)).toBe("$123.45")
    })

    it("0 cents → $0.00", () => {
        expect(formatCentsAsUsd(0)).toBe("$0.00")
    })
})

describe("formatCentsAsUsdCompact", () => {
    it("redondea sin centavos", () => {
        expect(formatCentsAsUsdCompact(12350)).toBe("$124")
        expect(formatCentsAsUsdCompact(12349)).toBe("$123")
    })

    it("separador de miles", () => {
        expect(formatCentsAsUsdCompact(123_400_00)).toBe("$123,400")
    })
})

describe("formatTokens", () => {
    it("< 1000 sin sufijo", () => {
        expect(formatTokens(999)).toBe("999")
        expect(formatTokens(0)).toBe("0")
    })

    it("miles con K", () => {
        expect(formatTokens(1500)).toBe("1.5K")
        expect(formatTokens(12_300)).toBe("12.3K")
    })

    it("millones con M", () => {
        expect(formatTokens(1_500_000)).toBe("1.50M")
        expect(formatTokens(12_345_678)).toBe("12.35M")
    })

    it("billions con B", () => {
        expect(formatTokens(2_500_000_000)).toBe("2.50B")
    })
})

describe("formatPercent", () => {
    it("0.123 con 1 decimal → 12.3%", () => {
        expect(formatPercent(0.123)).toBe("12.3%")
    })

    it("0 → 0.0%", () => {
        expect(formatPercent(0)).toBe("0.0%")
    })

    it("1 con 0 decimales → 100%", () => {
        expect(formatPercent(1, 0)).toBe("100%")
    })
})

describe("formatRelativeTime", () => {
    const now = new Date("2026-06-01T12:00:00Z").getTime()

    it("hace 30 segundos → 'hace segundos'", () => {
        expect(formatRelativeTime("2026-06-01T11:59:30Z", now)).toBe("hace segundos")
    })

    it("hace 5 minutos", () => {
        expect(formatRelativeTime("2026-06-01T11:55:00Z", now)).toBe("hace 5 min")
    })

    it("hace 3 horas", () => {
        expect(formatRelativeTime("2026-06-01T09:00:00Z", now)).toBe("hace 3 h")
    })

    it("hace 5 días", () => {
        expect(formatRelativeTime("2026-05-27T12:00:00Z", now)).toBe("hace 5 d")
    })

    it("hace más de 30 días", () => {
        expect(formatRelativeTime("2026-04-01T12:00:00Z", now)).toBe("hace > 30 d")
    })

    it("ISO inválido → guion largo", () => {
        expect(formatRelativeTime("not-a-date", now)).toBe("—")
    })
})

describe("formatLatency", () => {
    it("< 1000 ms con sufijo ms", () => {
        expect(formatLatency(230)).toBe("230 ms")
    })

    it(">= 1000 ms en segundos", () => {
        expect(formatLatency(1500)).toBe("1.5 s")
        expect(formatLatency(12345)).toBe("12.3 s")
    })
})
