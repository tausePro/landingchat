"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Zap, Star, Clock, Users, Shield, MessageSquare, BarChart3, Sparkles } from "lucide-react"
import {
    type FoundingLandingData,
    formatFoundingPrice,
    calculateAnnualPrice,
} from "@/types"

interface FoundingLandingProps {
    data: FoundingLandingData
}

export function FoundingLanding({ data }: FoundingLandingProps) {
    const { program, tiers, activity_feed } = data

    // Rotating activity feed
    const [currentActivityIndex, setCurrentActivityIndex] = useState(0)

    useEffect(() => {
        if (activity_feed.length <= 1) return

        const interval = setInterval(() => {
            setCurrentActivityIndex((prev) => (prev + 1) % activity_feed.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [activity_feed.length])

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <Zap className="size-5 text-white" />
                        </div>
                        <span className="text-lg font-bold">LandingChat</span>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                            EARLY ADOPTER 2026
                        </Badge>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex size-2 rounded-full bg-red-500"></span>
                            </span>
                            <span className="text-red-400 font-medium">
                                CUPOS CRÍTICOS: {program.slots_remaining}/{program.total_slots}
                            </span>
                        </div>

                        <Button
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold"
                            asChild
                        >
                            <a href="#planes">ASEGURAR MI LUGAR</a>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-4 overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-3xl" />

                <div className="relative mx-auto max-w-5xl text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400 mb-8">
                        <Sparkles className="size-4" />
                        LANZAMIENTO EXCLUSIVO COLOMBIA
                    </div>

                    {/* Title */}
                    <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
                        <span className="block text-white">{program.hero_title}</span>
                        <span className="block bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                            {program.hero_subtitle}
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10">
                        {program.hero_description}
                    </p>

                    {/* Counter */}
                    <div className="relative mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm mb-8">
                        <div className="text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-400 mb-2">
                                Cupos Restantes:
                            </p>
                            <div className="text-5xl sm:text-6xl font-black">
                                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                    {program.slots_remaining}
                                </span>
                                <span className="text-slate-500">/{program.total_slots}</span>
                            </div>
                        </div>

                        {/* Activity Feed Ticker */}
                        {activity_feed.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 h-6 overflow-hidden">
                                    <Users className="size-4 text-emerald-400 flex-shrink-0" />
                                    <span className="animate-fade-in">
                                        {activity_feed[currentActivityIndex]?.message || "Únete a los founding members"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTA Button */}
                    <Button
                        size="lg"
                        className="h-14 px-10 text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold shadow-lg shadow-emerald-500/25"
                        asChild
                    >
                        <a href="#planes">
                            {program.cta_button_text}
                            <Zap className="ml-2 size-5" />
                        </a>
                    </Button>

                    <p className="mt-4 text-sm text-slate-500 flex items-center justify-center gap-2">
                        <Clock className="size-4" />
                        OFERTA EXPIRA AL COMPLETARSE LOS 100 CUPOS
                    </p>
                </div>
            </section>

            {/* Social Proof Logos */}
            <section className="py-10 border-y border-white/5">
                <div className="mx-auto max-w-5xl px-4">
                    <div className="flex flex-wrap items-center justify-center gap-8 text-slate-500">
                        <span className="text-xs uppercase tracking-wider">Empresas que confían:</span>
                        {["COMPANY ONE", "NEXUS CORE", "TECHFLOW", "STRATOS"].map((name) => (
                            <span key={name} className="text-sm font-medium text-slate-600">
                                {name}
                            </span>
                        ))}
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            Meta Business Partner
                        </Badge>
                    </div>
                </div>
            </section>

            {/* Founding Benefits Section */}
            <section className="py-20 px-4">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                            CONVIÉRTETE EN{" "}
                            <span className="bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                                FUNDADOR
                            </span>
                            <br />Y CONGELA TU PRECIO.
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Left: Price Card */}
                        <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-8">
                            <Badge className="absolute -top-3 right-4 bg-red-500 text-white">
                                60% OFF LIFE
                            </Badge>

                            <p className="text-sm uppercase tracking-wider text-amber-400 mb-2">
                                PLAN FUNDADORES
                            </p>

                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-slate-500 line-through text-xl">
                                    {formatFoundingPrice(tiers[1]?.regular_price || 315000)}
                                </span>
                                <span className="text-4xl font-black text-white">
                                    {formatFoundingPrice(tiers[1]?.current_price || 126000)}
                                </span>
                                <span className="text-slate-400">COP/mes</span>
                            </div>

                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-6">
                                PARA SIEMPRE
                            </Badge>

                            <p className="text-sm text-slate-400">
                                Este beneficio es vitalicio. Mientras mantengas tu suscripción activa,
                                tu precio nunca subirá. Incluso cuando la plataforma duplique su valor comercial.
                            </p>
                        </div>

                        {/* Right: Benefits Grid */}
                        <div className="grid gap-4">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="rounded-lg bg-amber-500/20 p-2">
                                        <Star className="size-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Prioridad en el Roadmap</h4>
                                        <p className="text-sm text-slate-400">
                                            Tus sugerencias se convierten en funcionalidades. Influye directamente
                                            en el desarrollo de la plataforma.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="rounded-lg bg-emerald-500/20 p-2">
                                        <MessageSquare className="size-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Soporte Concierge 1:1</h4>
                                        <p className="text-sm text-slate-400">
                                            Canal directo por WhatsApp con nuestro equipo técnico senior.
                                            Sin tickets, sin esperas.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="rounded-lg bg-purple-500/20 p-2">
                                        <Shield className="size-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Insignia de Fundador</h4>
                                        <p className="text-sm text-slate-400">
                                            Reconocimiento público en el ecosistema LandingChat como uno de
                                            los pioneros del 2026.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Plans */}
            <section id="planes" className="py-20 px-4 scroll-mt-20">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                            <Sparkles className="size-3 mr-1" />
                            FOUNDING MEMBERS - ÚLTIMOS CUPOS
                        </Badge>
                        <h2 className="text-3xl sm:text-4xl font-bold">
                            Elige tu Plan Founding
                        </h2>
                        <p className="text-slate-400 mt-2">
                            Paga {12 - program.free_months} meses, obtén 12. Precio congelado mientras mantengas tu suscripción activa.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {tiers.map((tier) => {
                            const annual = calculateAnnualPrice(tier.current_price, program.free_months)
                            const isPopular = tier.is_popular
                            const isSoldOut = tier.slots_remaining <= 0

                            return (
                                <div
                                    key={tier.id}
                                    className={`relative rounded-2xl border ${isPopular
                                        ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-transparent"
                                        : "border-white/10 bg-white/5"
                                        } p-6 ${isSoldOut ? "opacity-50" : ""}`}
                                >
                                    {isPopular && (
                                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white">
                                            MÁS POPULAR
                                        </Badge>
                                    )}

                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold">{tier.name}</h3>
                                        <Badge
                                            className={`${tier.slots_remaining <= 5
                                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                                : "bg-white/10 text-white border-white/20"
                                                }`}
                                        >
                                            {tier.badge_text || `${tier.slots_remaining} CUPOS`}
                                        </Badge>
                                    </div>

                                    <div className="mb-4">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black">
                                                {formatFoundingPrice(tier.current_price / 1000)}K
                                            </span>
                                            <span className="text-slate-400">/mes</span>
                                            <span className="text-slate-500 line-through text-sm">
                                                {formatFoundingPrice(tier.regular_price / 1000)}K
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1">
                                            {tier.description}
                                        </p>
                                    </div>

                                    <ul className="space-y-3 mb-6">
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="size-4 text-emerald-400" />
                                            <span>
                                                {tier.max_products === -1 ? "Productos ilimitados" : `${tier.max_products.toLocaleString("es-CO")} productos`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="size-4 text-emerald-400" />
                                            <span>
                                                {tier.max_agents === -1 ? "Agentes ilimitados" : `${tier.max_agents} Agente${tier.max_agents > 1 ? "s" : ""} AI`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="size-4 text-emerald-400" />
                                            <span>
                                                {tier.max_monthly_conversations === -1
                                                    ? "Conversaciones ilimitadas"
                                                    : `${tier.max_monthly_conversations.toLocaleString("es-CO")} conv/mes`}
                                            </span>
                                        </li>
                                        {tier.features?.crm_integration && (
                                            <li className="flex items-center gap-2 text-sm">
                                                <Check className="size-4 text-emerald-400" />
                                                <span>CRM Integration</span>
                                            </li>
                                        )}
                                        {tier.features?.white_glove_support && (
                                            <li className="flex items-center gap-2 text-sm text-amber-400">
                                                <Star className="size-4" />
                                                <span>Soporte White-Glove</span>
                                            </li>
                                        )}
                                    </ul>

                                    <div className="border-t border-white/10 pt-4 mb-4">
                                        <p className="text-xs text-slate-500 mb-1">Pago anual</p>
                                        <p className="text-lg font-bold">
                                            {formatFoundingPrice(annual.totalPrice)}{" "}
                                            <span className="text-sm font-normal text-slate-400">
                                                (ahorras {formatFoundingPrice(annual.savings)})
                                            </span>
                                        </p>
                                    </div>

                                    <Button
                                        className={`w-full ${isPopular
                                            ? "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                                            : "bg-white/10 hover:bg-white/20"
                                            }`}
                                        disabled={isSoldOut}
                                        asChild={!isSoldOut}
                                    >
                                        {isSoldOut ? (
                                            <span>AGOTADO</span>
                                        ) : (
                                            <Link href={`/registro?plan=${tier.slug}&founding=true`}>
                                                SELECCIONAR {tier.name.toUpperCase()}
                                            </Link>
                                        )}
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <p className="text-sm uppercase tracking-wider text-emerald-400 mb-2">
                            CONSTRUCTOR DE CHAT-COMMERCE PROFESIONAL
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold">
                            Construye experiencias<br />de alto nivel
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: BarChart3,
                                title: "Bundles/Combos",
                                desc: "Agrupa productos con descuento",
                            },
                            {
                                icon: Users,
                                title: "Precios por Cantidad",
                                desc: "Escalas para mayoristas",
                            },
                            {
                                icon: Clock,
                                title: "Vender por Suscripción",
                                desc: "Pagos recurrentes automáticos",
                            },
                            {
                                icon: Sparkles,
                                title: "Producto Configurable",
                                desc: "Personalización vía chat",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-emerald-500/30 transition-colors"
                            >
                                <div className="rounded-lg bg-emerald-500/20 p-2 w-fit mb-3">
                                    <feature.icon className="size-5 text-emerald-400" />
                                </div>
                                <h4 className="font-semibold mb-1">{feature.title}</h4>
                                <p className="text-sm text-slate-400">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-4">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-4xl sm:text-5xl font-black mb-4">
                        ÚNETE A LA ÉLITE
                        <br />
                        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            CONSTRUYE EL 2026.
                        </span>
                    </h2>
                    <p className="text-slate-400 mb-8">
                        No permitas que el mercado te pase por encima. Los early adopters dominan,
                        el resto solo compite por precio.
                    </p>

                    <Button
                        size="lg"
                        className="h-14 px-10 text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold shadow-lg shadow-emerald-500/25"
                        asChild
                    >
                        <a href="#planes">
                            ASEGURAR MI LUGAR AHORA
                            <Zap className="ml-2 size-5" />
                        </a>
                    </Button>

                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Check className="size-4 text-emerald-400" />
                            Acceso Inmediato
                        </span>
                        <span className="flex items-center gap-1">
                            <Check className="size-4 text-emerald-400" />
                            Precio Congelado
                        </span>
                        <span className="flex items-center gap-1">
                            <Check className="size-4 text-emerald-400" />
                            100% Sin Riesgo
                        </span>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-4">
                <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="size-6 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <Zap className="size-4 text-white" />
                        </div>
                        <span className="font-bold">LandingChat</span>
                        <span className="text-slate-500">OS</span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                        <Link href="/terminos" className="hover:text-white transition-colors">
                            TÉRMINOS EARLY ADOPTER
                        </Link>
                        <Link href="/soporte" className="hover:text-white transition-colors">
                            SOPORTE CONCIERGE
                        </Link>
                        <Link href="/roadmap" className="hover:text-white transition-colors">
                            ROADMAP 2026
                        </Link>
                    </div>

                    <span className="text-xs text-slate-600">
                        © 2026 LANDINGCHAT GLOBAL. 100% COLOMBIA
                    </span>
                </div>
            </footer>
        </div>
    )
}
