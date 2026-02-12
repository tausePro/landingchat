"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useDebouncedCallback } from "use-debounce"
import type { IntentScoreFilter, CustomerSegment } from "@/types/customer"

interface CustomerSegmentsProps {
    segments: {
        all: number
        whatsappLeads: number
        recurringBuyers: number
        pendingFollowUp: number
    }
    intentScoreCounts: {
        alta: number
        media: number
        baja: number
        riesgo: number
    }
    activeSegment: string
    activeIntentScores?: IntentScoreFilter[]
}

const SEGMENT_ITEMS: {
    key: CustomerSegment
    label: string
    icon: string
    countKey: keyof CustomerSegmentsProps["segments"]
}[] = [
    { key: "all", label: "Todos los Clientes", icon: "group", countKey: "all" },
    { key: "whatsapp_leads", label: "Leads de WhatsApp", icon: "chat", countKey: "whatsappLeads" },
    { key: "recurring", label: "Compradores Recurrentes", icon: "loyalty", countKey: "recurringBuyers" },
    { key: "pending_followup", label: "Pendiente Seguimiento", icon: "schedule", countKey: "pendingFollowUp" },
]

const SCORE_ITEMS: { key: IntentScoreFilter; label: string; color: string }[] = [
    { key: "alta", label: "Intención Alta", color: "text-green-600" },
    { key: "media", label: "Intención Media", color: "text-blue-600" },
    { key: "baja", label: "Intención Baja", color: "text-yellow-600" },
]

export function CustomerSegments({
    segments,
    intentScoreCounts,
    activeSegment,
    activeIntentScores = [],
}: CustomerSegmentsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleSegmentClick = (segmentKey: CustomerSegment) => {
        const params = new URLSearchParams(searchParams)
        if (segmentKey === "all") {
            params.delete("segment")
        } else {
            params.set("segment", segmentKey)
        }
        params.set("page", "1")
        router.replace(`?${params.toString()}`)
    }

    const handleScoreToggle = (scoreKey: IntentScoreFilter) => {
        const params = new URLSearchParams(searchParams)
        const current = new Set(activeIntentScores)

        if (current.has(scoreKey)) {
            current.delete(scoreKey)
        } else {
            current.add(scoreKey)
        }

        if (current.size > 0) {
            params.set("intentScores", Array.from(current).join(","))
        } else {
            params.delete("intentScores")
        }
        params.set("page", "1")
        router.replace(`?${params.toString()}`)
    }

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams)
        if (term) {
            params.set("search", term)
        } else {
            params.delete("search")
        }
        params.set("page", "1")
        router.replace(`?${params.toString()}`)
    }, 300)

    return (
        <div className="flex flex-col gap-4">
            {/* Segmentos */}
            <Card>
                <CardContent className="p-4">
                    <h3 className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                        Segmentos
                    </h3>
                    <ul className="space-y-1">
                        {SEGMENT_ITEMS.map((item) => {
                            const isActive = activeSegment === item.key || (item.key === "all" && !activeSegment)
                            return (
                                <li key={item.key}>
                                    <button
                                        onClick={() => handleSegmentClick(item.key)}
                                        className={cn(
                                            "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                                                : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-50 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className={cn(
                                                "material-symbols-outlined text-[18px]",
                                                isActive ? "text-primary" : "text-slate-400"
                                            )}>
                                                {item.icon}
                                            </span>
                                            <span className="truncate">{item.label}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[28px] text-center",
                                            isActive
                                                ? "bg-primary/20 text-primary"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                        )}>
                                            {segments[item.countKey].toLocaleString("es-CO")}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </CardContent>
            </Card>

            {/* Filtrar por Score */}
            <Card>
                <CardContent className="p-4">
                    <h3 className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                        Filtrar por Score
                    </h3>
                    <div className="space-y-3">
                        {SCORE_ITEMS.map((item) => (
                            <label
                                key={item.key}
                                className="flex items-center justify-between cursor-pointer group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Checkbox
                                        checked={activeIntentScores.includes(item.key)}
                                        onCheckedChange={() => handleScoreToggle(item.key)}
                                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                    <span className="text-sm text-text-light-primary dark:text-text-dark-primary group-hover:text-primary transition-colors">
                                        {item.label}
                                    </span>
                                </div>
                                <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                    {intentScoreCounts[item.key]}
                                </span>
                            </label>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Búsqueda Rápida */}
            <Card className="bg-slate-900 dark:bg-slate-950 border-slate-800">
                <CardContent className="p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Búsqueda Rápida
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                        Encuentra clientes por nombre, teléfono o email.
                    </p>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 material-symbols-outlined text-[18px]">
                            search
                        </span>
                        <Input
                            placeholder="Buscar..."
                            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                            defaultValue={searchParams.get("search")?.toString()}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
