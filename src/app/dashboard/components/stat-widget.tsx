"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatWidgetProps {
    title: string
    value: string
    helper: string
    icon?: string
    trendLabel?: string
    trendDirection?: "up" | "down" | "neutral"
    accentColor?: string
}

const trendColorMap: Record<NonNullable<StatWidgetProps["trendDirection"]>, string> = {
    up: "text-emerald-500",
    down: "text-red-500",
    neutral: "text-muted-foreground",
}

export function StatWidget({
    title,
    value,
    helper,
    icon = "insights",
    trendLabel,
    trendDirection = "neutral",
    accentColor,
}: StatWidgetProps) {
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                    {title}
                </CardTitle>
                <span className="size-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </span>
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-semibold ${accentColor ?? "text-text-light-primary dark:text-text-dark-primary"}`}>
                    {value}
                </div>
                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1 flex items-center gap-2">
                    {trendLabel && (
                        <span className={`flex items-center gap-1 ${trendColorMap[trendDirection]}`}>
                            {trendDirection !== "neutral" && (
                                <span className="material-symbols-outlined text-base">
                                    {trendDirection === "up" ? "trending_up" : "trending_down"}
                                </span>
                            )}
                            {trendLabel}
                        </span>
                    )}
                    <span>{helper}</span>
                </p>
            </CardContent>
        </Card>
    )
}
