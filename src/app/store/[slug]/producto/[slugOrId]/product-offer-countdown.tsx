"use client"

import { useState, useEffect } from "react"

export interface CountdownTime {
    days: number
    hours: number
    minutes: number
    seconds: number
}

export function getCountdownTime(endsAt: string): CountdownTime | null {
    const target = new Date(endsAt).getTime()
    if (!Number.isFinite(target)) return null

    const totalSeconds = Math.floor((target - Date.now()) / 1000)
    if (totalSeconds <= 0) return null

    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
}

function formatCountdownPart(value: number): string {
    return value.toString().padStart(2, "0")
}

export function OfferCountdown({ endsAt, accentColor, label }: { endsAt: string; accentColor: string; label: string }) {
    const [remaining, setRemaining] = useState<CountdownTime | null>(null)

    useEffect(() => {
        const updateRemaining = () => setRemaining(getCountdownTime(endsAt))

        updateRemaining()
        const intervalId = window.setInterval(updateRemaining, 1000)

        return () => window.clearInterval(intervalId)
    }, [endsAt])

    if (!remaining) return null

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="material-symbols-outlined text-[17px]" style={{ color: accentColor }}>timer</span>
            <span>{label}</span>
            <span className="ml-auto tabular-nums">
                {remaining.days > 0 ? `${remaining.days}d ` : ""}
                {formatCountdownPart(remaining.hours)}:{formatCountdownPart(remaining.minutes)}:{formatCountdownPart(remaining.seconds)}
            </span>
        </div>
    )
}
