"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RANGE_PRESETS, DEFAULT_RANGE_KEY, type RangeKey } from "../date-range"

const dateInputClass =
    "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

export function DateRangePicker() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const fromParam = searchParams.get("from") || ""
    const toParam = searchParams.get("to") || ""
    const isCustom = Boolean(fromParam && toParam)
    const activeKey: RangeKey = isCustom
        ? "custom"
        : ((searchParams.get("range") as RangeKey) || DEFAULT_RANGE_KEY)

    const [showCustom, setShowCustom] = useState(isCustom)
    const [from, setFrom] = useState(fromParam)
    const [to, setTo] = useState(toParam)

    const applyPreset = (key: RangeKey) => {
        if (key === "custom") {
            setShowCustom(true)
            return
        }
        setShowCustom(false)
        router.push(`${pathname}?range=${key}`)
    }

    const applyCustom = () => {
        if (!from || !to) return
        const params = new URLSearchParams({ from, to })
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1">
                {RANGE_PRESETS.map((preset) => (
                    <Button
                        key={preset.key}
                        type="button"
                        variant={activeKey === preset.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyPreset(preset.key)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>

            {showCustom && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        aria-label="Fecha desde"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => setFrom(e.target.value)}
                        className={dateInputClass}
                    />
                    <span className="text-sm text-muted-foreground">→</span>
                    <input
                        type="date"
                        aria-label="Fecha hasta"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => setTo(e.target.value)}
                        className={dateInputClass}
                    />
                    <Button type="button" size="sm" onClick={applyCustom} disabled={!from || !to}>
                        Aplicar
                    </Button>
                </div>
            )}
        </div>
    )
}
