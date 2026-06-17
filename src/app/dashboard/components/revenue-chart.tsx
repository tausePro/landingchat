"use client"

import { useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface RevenueChartProps {
    // Serie diaria de los últimos 30 días (rellena con 0), etiqueta d/m
    series: { date: string; value: number }[]
    growth: number
    className?: string
}

const RANGES = [7, 14, 30]

function formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        notation: "compact",
    }).format(value)
}

function formatFullCurrency(value: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
    }).format(value)
}

export function RevenueChart({ series, growth, className }: RevenueChartProps) {
    const [days, setDays] = useState(7)
    const data = series.slice(-days)
    const total = data.reduce((sum, d) => sum + d.value, 0)
    const up = growth >= 0

    return (
        <Card className={`overflow-hidden border-border-light/80 shadow-sm dark:border-border-dark/80 ${className ?? ""}`}>
            <CardHeader className="flex flex-col gap-4 pb-0 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">Ingresos</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold tracking-tight">{formatCompactCurrency(total)}</span>
                        <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                        >
                            {up ? "+" : ""}{growth}%
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 self-start">
                    {RANGES.map((r) => (
                        <Button
                            key={r}
                            type="button"
                            size="sm"
                            variant={days === r ? "default" : "outline"}
                            onClick={() => setDays(r)}
                        >
                            {r}d
                        </Button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="pt-5">
                {total > 0 ? (
                    <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="dashRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2b7cee" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#2b7cee" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={20}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    width={52}
                                    tickFormatter={(v) => formatCompactCurrency(Number(v))}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                    formatter={(value: number) => [formatFullCurrency(value), "Ingresos"]}
                                    labelFormatter={(label) => `Día ${label}`}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#2b7cee"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#dashRevenueGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex h-56 items-center justify-center rounded-2xl bg-background-light text-sm text-text-light-secondary dark:bg-background-dark dark:text-text-dark-secondary">
                        Sin ingresos registrados en este período
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
