"use client"

import { useEffect, useRef, useState } from "react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingMetricsProps {
    config: LandingMainConfig
}

export function LandingMetrics({ config }: LandingMetricsProps) {
    const [visible, setVisible] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])

    if (!config.metrics_visible) return null

    return (
        <section ref={ref} className="py-12 border-y border-white/20 bg-white/40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6">
                <p className="text-center text-xs font-bold text-landing-violet/60 uppercase tracking-[0.2em] mb-8">
                    Proof of Growth - Métricas Reales
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-75">
                    {config.metrics.map((metric, i) => (
                        <div key={i} className="text-center group">
                            <div
                                className={`text-3xl font-black text-landing-deep mb-1 group-hover:text-landing-violet transition-colors ${
                                    visible ? "animate-fade-in" : "opacity-0"
                                }`}
                                style={{ animationDelay: `${i * 150}ms` }}
                            >
                                {metric.value}
                            </div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {metric.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
