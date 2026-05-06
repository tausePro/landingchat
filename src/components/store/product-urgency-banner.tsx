"use client"

import { useEffect, useState } from "react"

interface ProductUrgencyBannerProps {
    desktopText: string
    mobileText?: string
    countdownEndsAt: string
    backgroundColor?: string
    textColor?: string
    generatedAt: string
}

interface CountdownTime {
    days: number
    hours: number
    minutes: number
    seconds: number
}

function getCountdownTime(endsAt: string, nowMs: number): CountdownTime | null {
    const target = new Date(endsAt).getTime()
    if (!Number.isFinite(target)) return null

    const totalSeconds = Math.floor((target - nowMs) / 1000)
    if (totalSeconds <= 0) return null

    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
}

function formatPart(value: number): string {
    return value.toString().padStart(2, "0")
}

export function ProductUrgencyBanner({ desktopText, mobileText, countdownEndsAt, backgroundColor = "#14532d", textColor = "#ffffff", generatedAt }: ProductUrgencyBannerProps) {
    const initialNow = new Date(generatedAt).getTime()
    const [remaining, setRemaining] = useState<CountdownTime | null>(() => getCountdownTime(countdownEndsAt, Number.isFinite(initialNow) ? initialNow : Date.now()))

    useEffect(() => {
        const updateRemaining = () => setRemaining(getCountdownTime(countdownEndsAt, Date.now()))
        updateRemaining()
        const intervalId = window.setInterval(updateRemaining, 1000)

        return () => window.clearInterval(intervalId)
    }, [countdownEndsAt])

    if (!remaining) return null

    return (
        <div className="w-full px-3 py-2 text-center text-[12.5px] font-bold shadow-sm sm:text-sm" style={{ backgroundColor, color: textColor }}>
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <span className="hidden md:inline">{desktopText}</span>
                <span className="md:hidden">{mobileText || desktopText}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2.5 py-1 text-[11px] tabular-nums ring-1 ring-white/20 sm:text-xs">
                    <span className="material-symbols-outlined text-[15px]">timer</span>
                    {remaining.days > 0 ? `${remaining.days}d ` : ""}{formatPart(remaining.hours)}:{formatPart(remaining.minutes)}:{formatPart(remaining.seconds)}
                </span>
            </div>
        </div>
    )
}
