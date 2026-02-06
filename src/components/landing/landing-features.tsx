"use client"

import { useState, useEffect } from "react"
import {
    MessageCircle,
    Database,
    Package,
    BrainCircuit,
    Wrench,
    CreditCard,
    Sparkles,
} from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingFeaturesProps {
    config: LandingMainConfig
}

// Animated channel icons component
function OmnichannelAnimation() {
    const [activeIndex, setActiveIndex] = useState(0)
    const channels = [
        { name: "WhatsApp", color: "#25D366", icon: "WA" },
        { name: "Instagram", color: "#E4405F", icon: "IG" },
        { name: "Facebook", color: "#1877F2", icon: "FB" },
        { name: "Web Chat", color: "#6366f1", icon: "💬" },
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % channels.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [channels.length])

    return (
        <div className="relative h-40 flex items-center justify-center">
            {/* Center agent icon */}
            <div className="relative z-10 size-16 bg-landing-deep rounded-2xl flex items-center justify-center text-white shadow-xl">
                <BrainCircuit className="size-8" />
            </div>

            {/* Orbiting channel icons */}
            {channels.map((channel, i) => {
                const angle = (i * 90 + activeIndex * 90) * (Math.PI / 180)
                const radius = 60
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius
                const isActive = i === activeIndex

                return (
                    <div
                        key={channel.name}
                        className={`absolute size-10 rounded-xl flex items-center justify-center text-white text-xs font-bold transition-all duration-500 ${isActive ? "scale-125 shadow-lg" : "scale-100 opacity-60"}`}
                        style={{
                            backgroundColor: channel.color,
                            transform: `translate(${x}px, ${y}px)`,
                        }}
                    >
                        {channel.icon}
                    </div>
                )
            })}

            {/* Connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <circle
                    cx="50%"
                    cy="50%"
                    r="60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-gray-200"
                    strokeDasharray="4 4"
                />
            </svg>
        </div>
    )
}

// CAPI Match Quality table
function CAPIMatchTable() {
    const events = [
        { event: "Purchase", quality: 9.8, color: "bg-green-500" },
        { event: "Lead", quality: 9.5, color: "bg-green-500" },
        { event: "ViewContent", quality: 8.7, color: "bg-yellow-500" },
    ]

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Database className="size-4 text-landing-violet" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Match Quality</span>
                </div>
            </div>
            <div className="divide-y divide-gray-50">
                {events.map((item) => (
                    <div key={item.event} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-gray-600">{item.event}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${item.color} rounded-full`}
                                    style={{ width: `${item.quality * 10}%` }}
                                />
                            </div>
                            <span className="text-xs font-bold text-gray-800 w-10 text-right">{item.quality}/10</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Stock alert card
function StockAlertCard() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex gap-3">
                <div className="size-16 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center">
                    <Package className="size-8 text-pink-500" />
                </div>
                <div className="flex-1">
                    <h5 className="font-semibold text-gray-800 text-sm">Vestido Floral XS</h5>
                    <p className="text-xs text-gray-500 mt-0.5">SKU: VF-2024-XS</p>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            <span className="size-1.5 bg-amber-500 rounded-full animate-pulse" />
                            ¡Últimas 3 unidades!
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Builder toggles panel
function BuilderToggles() {
    const options = [
        { name: "Bundle", active: true },
        { name: "Precios dinámicos", active: true },
        { name: "Suscripción", active: false },
        { name: "Configurable", active: true },
    ]

    return (
        <div className="bg-landing-deep/95 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
                <Wrench className="size-4 text-landing-mint" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">Opciones Avanzadas</span>
            </div>
            {options.map((opt) => (
                <div key={opt.name} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-300">{opt.name}</span>
                    <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${opt.active ? "bg-landing-mint" : "bg-gray-600"}`}>
                        <div className={`size-4 bg-white rounded-full shadow transition-transform ${opt.active ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                </div>
            ))}
        </div>
    )
}

// Payment logos
function PaymentLogos() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {/* Wompi */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-center">
                    <span className="text-lg font-black text-[#00C389]">wompi</span>
                </div>
                {/* ePayco */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-center">
                    <span className="text-lg font-black text-[#009EE3]">ePayco</span>
                </div>
                {/* Addi */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-center">
                    <span className="text-lg font-black text-[#00D1A1]">addi</span>
                </div>
                {/* Bold */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-center">
                    <span className="text-lg font-black text-[#121212]">Bold</span>
                </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <CreditCard className="size-4" />
                <span>Pagos por cuotas disponibles</span>
            </div>
        </div>
    )
}

export function LandingFeatures({ config }: LandingFeaturesProps) {
    return (
        <section className="py-32 bg-gray-50 relative" id="features">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-sm font-bold text-landing-violet uppercase tracking-widest mb-3">
                        {config.features_badge}
                    </h2>
                    <h3 className="text-4xl md:text-5xl font-bold text-landing-deep mb-6">
                        {config.features_title}
                    </h3>
                    <p className="text-gray-500 text-lg">{config.features_subtitle}</p>
                </div>

                {/* Bento grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Omnicanalidad - Wide */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card md:col-span-2">
                        <div className="inline-flex items-center gap-2 mb-4 bg-landing-deep/10 px-3 py-1 rounded-full border border-landing-deep/10">
                            <MessageCircle className="size-4 text-landing-violet" />
                            <span className="text-xs font-bold text-landing-deep uppercase tracking-wider">
                                Omnicanalidad
                            </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            <div>
                                <h4 className="font-bold text-landing-deep text-2xl mb-3">
                                    Un agente, todos los canales
                                </h4>
                                <p className="text-gray-600 leading-relaxed">
                                    WhatsApp, Instagram, Facebook Messenger y web chat integrados en una sola bandeja.
                                    Tu agente responde con contexto unificado sin importar dónde escriba el cliente.
                                </p>
                            </div>
                            <OmnichannelAnimation />
                        </div>
                    </div>

                    {/* CAPI & Data */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card">
                        <div className="size-12 bg-landing-violet/10 rounded-2xl flex items-center justify-center text-landing-violet mb-6">
                            <Database className="size-6" />
                        </div>
                        <h4 className="font-bold text-landing-deep text-lg mb-3">
                            CAPI & First-Party Data
                        </h4>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            Eventos server-side con Match Quality superior al 90%. Optimiza tus campañas con datos propios.
                        </p>
                        <CAPIMatchTable />
                    </div>

                    {/* Stock Inteligente */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card">
                        <div className="size-12 bg-landing-violet/10 rounded-2xl flex items-center justify-center text-landing-violet mb-6">
                            <Package className="size-6" />
                        </div>
                        <h4 className="font-bold text-landing-deep text-lg mb-3">
                            Stock Inteligente
                        </h4>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            Tu agente conoce inventario en tiempo real. Sugiere alternativas cuando un producto se agota.
                        </p>
                        <StockAlertCard />
                    </div>

                    {/* Empleado Digital - Highlight */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card bg-landing-deep/5 flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 mb-4 bg-landing-deep/10 px-3 py-1 rounded-full border border-landing-deep/10">
                            <Sparkles className="size-4 text-landing-violet" />
                            <span className="text-xs font-bold text-landing-deep uppercase tracking-wider">
                                Core
                            </span>
                        </div>
                        <div className="size-20 bg-gradient-to-br from-landing-violet to-landing-mint rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-landing-violet/25">
                            <BrainCircuit className="size-10" />
                        </div>
                        <h4 className="font-bold text-landing-deep text-lg mb-2">
                            Tu Empleado Digital
                        </h4>
                        <p className="text-gray-600 text-sm leading-relaxed mb-3">
                            Entrénalo con tu catálogo y políticas. Responde preguntas, procesa pedidos y cierra ventas 24/7.
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-landing-mint/20 text-landing-deep text-xs font-bold">
                            v4.0 — GPT-4o + RAG
                        </span>
                    </div>

                    {/* Constructor */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card bg-landing-deep text-white">
                        <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center text-landing-mint mb-6">
                            <Wrench className="size-6" />
                        </div>
                        <h4 className="font-bold text-lg mb-3">
                            Constructor de Productos
                        </h4>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            Crea bundles, variantes, suscripciones y productos configurables. Sin código, desde el dashboard.
                        </p>
                        <BuilderToggles />
                    </div>

                    {/* Pagos - Wide */}
                    <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bento-card md:col-span-2">
                        <div className="inline-flex items-center gap-2 mb-4 bg-landing-deep/10 px-3 py-1 rounded-full border border-landing-deep/10">
                            <CreditCard className="size-4 text-landing-violet" />
                            <span className="text-xs font-bold text-landing-deep uppercase tracking-wider">
                                Pagos Integrados
                            </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            <div>
                                <h4 className="font-bold text-landing-deep text-2xl mb-3">
                                    Cobra desde el chat
                                </h4>
                                <p className="text-gray-600 leading-relaxed">
                                    Genera links de pago con un clic. Integración nativa con las principales pasarelas de LATAM.
                                    Tu cliente paga sin salir de WhatsApp.
                                </p>
                            </div>
                            <PaymentLogos />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
