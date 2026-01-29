"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Check,
    Zap,
    Star,
    Clock,
    Users,
    Shield,
    MessageSquare,
    BarChart3,
    Sparkles,
    Heart,
    Rocket,
    Target,
    Award,
    Crown,
    Gem,
    Gift,
} from "lucide-react"
import {
    type FoundingLandingData,
    type FoundingLandingConfig,
    formatFoundingPrice,
    calculateAnnualPrice,
} from "@/types"

interface FoundingLandingProps {
    data: FoundingLandingData
}

// Mapa de iconos disponibles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
    Zap, Star, Shield, MessageSquare, BarChart3, Users, Clock, Sparkles,
    Heart, Rocket, Target, Award, Crown, Gem, Gift, Check
}

// Configuración por defecto
const defaultConfig: FoundingLandingConfig = {
    logo_type: "icon",
    logo_icon: "Zap",
    logo_image_url: null,
    logo_text: "LandingChat",
    primary_gradient_from: "#10b981",
    primary_gradient_to: "#06b6d4",
    accent_color: "#f59e0b",
    header_badge_text: "EARLY ADOPTER 2026",
    header_badge_visible: true,
    hero_badge_text: "LANZAMIENTO EXCLUSIVO COLOMBIA",
    hero_badge_visible: true,
    social_proof_title: "Empresas que confían:",
    social_proof_companies: [
        { name: "COMPANY ONE", logo_url: null },
        { name: "NEXUS CORE", logo_url: null },
        { name: "TECHFLOW", logo_url: null },
        { name: "STRATOS", logo_url: null },
    ],
    social_proof_badge_text: "Meta Business Partner",
    social_proof_badge_visible: true,
    benefits_title: "CONVIÉRTETE EN FUNDADOR Y CONGELA TU PRECIO.",
    benefits_discount_badge: "60% OFF LIFE",
    benefits: [
        {
            icon: "Star",
            icon_color: "amber",
            title: "Prioridad en el Roadmap",
            description: "Tus sugerencias se convierten en funcionalidades."
        },
        {
            icon: "MessageSquare",
            icon_color: "emerald",
            title: "Soporte Concierge 1:1",
            description: "Canal directo por WhatsApp con nuestro equipo."
        },
        {
            icon: "Shield",
            icon_color: "purple",
            title: "Insignia de Fundador",
            description: "Reconocimiento público en el ecosistema."
        },
    ],
    features_subtitle: "CONSTRUCTOR DE CHAT-COMMERCE PROFESIONAL",
    features_title: "Construye experiencias de alto nivel",
    features: [
        { icon: "BarChart3", title: "Bundles/Combos", description: "Agrupa productos con descuento" },
        { icon: "Users", title: "Precios por Cantidad", description: "Escalas para mayoristas" },
        { icon: "Clock", title: "Vender por Suscripción", description: "Pagos recurrentes automáticos" },
        { icon: "Sparkles", title: "Producto Configurable", description: "Personalización vía chat" },
    ],
    final_cta_title: "ÚNETE A LA ÉLITE",
    final_cta_subtitle: "CONSTRUYE EL 2026.",
    final_cta_description: "No permitas que el mercado te pase por encima. Los early adopters dominan, el resto solo compite por precio.",
    final_cta_button_text: "ASEGURAR MI LUGAR AHORA",
    final_cta_badges: ["Acceso Inmediato", "Precio Congelado", "100% Sin Riesgo"],
    footer_links: [
        { label: "TÉRMINOS EARLY ADOPTER", href: "/terminos" },
        { label: "SOPORTE CONCIERGE", href: "/soporte" },
        { label: "ROADMAP 2026", href: "/roadmap" },
    ],
    footer_copyright: "© 2026 LANDINGCHAT GLOBAL. 100% COLOMBIA",
}

// Helper para obtener color de icono
const getIconColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
        amber: "text-amber-400",
        emerald: "text-emerald-400",
        purple: "text-purple-400",
        cyan: "text-cyan-400",
        blue: "text-blue-400",
        red: "text-red-400",
        pink: "text-pink-400",
    }
    return colorMap[color] || "text-emerald-400"
}

const getIconBgClass = (color: string) => {
    const colorMap: Record<string, string> = {
        amber: "bg-amber-500/20",
        emerald: "bg-emerald-500/20",
        purple: "bg-purple-500/20",
        cyan: "bg-cyan-500/20",
        blue: "bg-blue-500/20",
        red: "bg-red-500/20",
        pink: "bg-pink-500/20",
    }
    return colorMap[color] || "bg-emerald-500/20"
}

export function FoundingLanding({ data }: FoundingLandingProps) {
    const { program, tiers, activity_feed, landing_config } = data

    // Merge config with defaults
    const config: FoundingLandingConfig = { ...defaultConfig, ...landing_config }

    // Rotating activity feed
    const [currentActivityIndex, setCurrentActivityIndex] = useState(0)

    useEffect(() => {
        if (activity_feed.length <= 1) return

        const interval = setInterval(() => {
            setCurrentActivityIndex((prev) => (prev + 1) % activity_feed.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [activity_feed.length])

    // Get Logo Icon component
    const LogoIcon = iconMap[config.logo_icon] || Zap

    // Dynamic gradient style
    const gradientStyle = {
        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        {config.logo_type === "icon" && (
                            <div
                                className="size-8 rounded-lg flex items-center justify-center"
                                style={gradientStyle}
                            >
                                <LogoIcon className="size-5 text-white" />
                            </div>
                        )}
                        {config.logo_type === "image" && config.logo_image_url && (
                            <Image
                                src={config.logo_image_url}
                                alt={config.logo_text}
                                width={32}
                                height={32}
                                className="size-8 rounded-lg object-contain"
                            />
                        )}
                        <span className="text-lg font-bold">{config.logo_text}</span>
                        {config.header_badge_visible && (
                            <Badge
                                className="text-[10px]"
                                style={{
                                    backgroundColor: `${config.accent_color}20`,
                                    color: config.accent_color,
                                    borderColor: `${config.accent_color}30`
                                }}
                            >
                                {config.header_badge_text}
                            </Badge>
                        )}
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
                            className="text-white font-semibold"
                            style={gradientStyle}
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
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom, ${config.primary_gradient_from}08, transparent, transparent)`
                    }}
                />
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
                    style={{ backgroundColor: `${config.primary_gradient_from}15` }}
                />

                <div className="relative mx-auto max-w-5xl text-center">
                    {/* Badge */}
                    {config.hero_badge_visible && (
                        <div
                            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm mb-8"
                            style={{
                                backgroundColor: `${config.accent_color}15`,
                                borderColor: `${config.accent_color}30`,
                                color: config.accent_color
                            }}
                        >
                            <Sparkles className="size-4" />
                            {config.hero_badge_text}
                        </div>
                    )}

                    {/* Title */}
                    <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
                        <span className="block text-white">{program.hero_title}</span>
                        <span
                            className="block bg-clip-text text-transparent"
                            style={gradientStyle}
                        >
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
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={gradientStyle}
                                >
                                    {program.slots_remaining}
                                </span>
                                <span className="text-slate-500">/{program.total_slots}</span>
                            </div>
                        </div>

                        {/* Activity Feed Ticker */}
                        {activity_feed.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 h-6 overflow-hidden">
                                    <Users className="size-4 flex-shrink-0" style={{ color: config.primary_gradient_from }} />
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
                        className="h-14 px-10 text-lg text-white font-bold shadow-lg"
                        style={{
                            ...gradientStyle,
                            boxShadow: `0 10px 25px -5px ${config.primary_gradient_from}40`
                        }}
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
                        <span className="text-xs uppercase tracking-wider">{config.social_proof_title}</span>
                        {config.social_proof_companies.map((company, i) => (
                            company.logo_url ? (
                                <Image
                                    key={i}
                                    src={company.logo_url}
                                    alt={company.name}
                                    width={100}
                                    height={32}
                                    className="h-8 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            ) : (
                                <span key={i} className="text-sm font-medium text-slate-600">
                                    {company.name}
                                </span>
                            )
                        ))}
                        {config.social_proof_badge_visible && (
                            <Badge
                                style={{
                                    backgroundColor: `${config.primary_gradient_from}20`,
                                    color: config.primary_gradient_from,
                                    borderColor: `${config.primary_gradient_from}30`
                                }}
                            >
                                {config.social_proof_badge_text}
                            </Badge>
                        )}
                    </div>
                </div>
            </section>

            {/* Founding Benefits Section */}
            <section className="py-20 px-4">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                            {config.benefits_title.split("FUNDADOR").map((part, i) => (
                                i === 0 ? (
                                    <span key={i}>
                                        {part}
                                        <span
                                            className="bg-clip-text text-transparent"
                                            style={gradientStyle}
                                        >
                                            FUNDADOR
                                        </span>
                                    </span>
                                ) : part
                            ))}
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Left: Price Card */}
                        <div
                            className="relative rounded-2xl border p-8"
                            style={{
                                borderColor: `${config.accent_color}30`,
                                background: `linear-gradient(to bottom right, ${config.accent_color}10, transparent)`
                            }}
                        >
                            <Badge className="absolute -top-3 right-4 bg-red-500 text-white">
                                {config.benefits_discount_badge}
                            </Badge>

                            <p
                                className="text-sm uppercase tracking-wider mb-2"
                                style={{ color: config.accent_color }}
                            >
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

                            <Badge
                                className="mb-6"
                                style={{
                                    backgroundColor: `${config.primary_gradient_from}20`,
                                    color: config.primary_gradient_from,
                                    borderColor: `${config.primary_gradient_from}30`
                                }}
                            >
                                PARA SIEMPRE
                            </Badge>

                            <p className="text-sm text-slate-400">
                                Este beneficio es vitalicio. Mientras mantengas tu suscripción activa,
                                tu precio nunca subirá. Incluso cuando la plataforma duplique su valor comercial.
                            </p>
                        </div>

                        {/* Right: Benefits Grid */}
                        <div className="grid gap-4">
                            {config.benefits.map((benefit, i) => {
                                const BenefitIcon = iconMap[benefit.icon] || Star
                                return (
                                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5">
                                        <div className="flex items-start gap-4">
                                            <div className={`rounded-lg p-2 ${getIconBgClass(benefit.icon_color)}`}>
                                                <BenefitIcon className={`size-5 ${getIconColorClass(benefit.icon_color)}`} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-1">{benefit.title}</h4>
                                                <p className="text-sm text-slate-400">{benefit.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Plans */}
            <section id="planes" className="py-20 px-4 scroll-mt-20">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <Badge
                            className="mb-4"
                            style={{
                                backgroundColor: `${config.accent_color}20`,
                                color: config.accent_color,
                                borderColor: `${config.accent_color}30`
                            }}
                        >
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
                                    className={`relative rounded-2xl border p-6 ${isSoldOut ? "opacity-50" : ""}`}
                                    style={{
                                        borderColor: isPopular ? `${config.primary_gradient_from}50` : "rgba(255,255,255,0.1)",
                                        background: isPopular
                                            ? `linear-gradient(to bottom, ${config.primary_gradient_from}10, transparent)`
                                            : "rgba(255,255,255,0.03)"
                                    }}
                                >
                                    {isPopular && (
                                        <Badge
                                            className="absolute -top-3 left-1/2 -translate-x-1/2 text-white"
                                            style={gradientStyle}
                                        >
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
                                            <Check className="size-4" style={{ color: config.primary_gradient_from }} />
                                            <span>
                                                {tier.max_products === -1 ? "Productos ilimitados" : `${tier.max_products.toLocaleString("es-CO")} productos`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="size-4" style={{ color: config.primary_gradient_from }} />
                                            <span>
                                                {tier.max_agents === -1 ? "Agentes ilimitados" : `${tier.max_agents} Agente${tier.max_agents > 1 ? "s" : ""} AI`}
                                            </span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="size-4" style={{ color: config.primary_gradient_from }} />
                                            <span>
                                                {tier.max_monthly_conversations === -1
                                                    ? "Conversaciones ilimitadas"
                                                    : `${tier.max_monthly_conversations.toLocaleString("es-CO")} conv/mes`}
                                            </span>
                                        </li>
                                        {tier.features?.crm_integration && (
                                            <li className="flex items-center gap-2 text-sm">
                                                <Check className="size-4" style={{ color: config.primary_gradient_from }} />
                                                <span>CRM Integration</span>
                                            </li>
                                        )}
                                        {tier.features?.white_glove_support && (
                                            <li className="flex items-center gap-2 text-sm" style={{ color: config.accent_color }}>
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
                                        className={`w-full ${isPopular ? "text-white" : ""}`}
                                        style={isPopular ? gradientStyle : { backgroundColor: "rgba(255,255,255,0.1)" }}
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
            <section
                className="py-20 px-4"
                style={{
                    background: `linear-gradient(to bottom, transparent, ${config.primary_gradient_from}05, transparent)`
                }}
            >
                <div className="mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <p
                            className="text-sm uppercase tracking-wider mb-2"
                            style={{ color: config.primary_gradient_from }}
                        >
                            {config.features_subtitle}
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold">
                            {config.features_title}
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {config.features.map((feature, i) => {
                            const FeatureIcon = iconMap[feature.icon] || Sparkles
                            return (
                                <div
                                    key={i}
                                    className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-opacity-30 transition-colors"
                                    style={{ "--hover-border": config.primary_gradient_from } as React.CSSProperties}
                                >
                                    <div
                                        className="rounded-lg p-2 w-fit mb-3"
                                        style={{ backgroundColor: `${config.primary_gradient_from}20` }}
                                    >
                                        <FeatureIcon className="size-5" style={{ color: config.primary_gradient_from }} />
                                    </div>
                                    <h4 className="font-semibold mb-1">{feature.title}</h4>
                                    <p className="text-sm text-slate-400">{feature.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-4">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-4xl sm:text-5xl font-black mb-4">
                        {config.final_cta_title}
                        <br />
                        <span
                            className="bg-clip-text text-transparent"
                            style={gradientStyle}
                        >
                            {config.final_cta_subtitle}
                        </span>
                    </h2>
                    <p className="text-slate-400 mb-8">
                        {config.final_cta_description}
                    </p>

                    <Button
                        size="lg"
                        className="h-14 px-10 text-lg text-white font-bold shadow-lg"
                        style={{
                            ...gradientStyle,
                            boxShadow: `0 10px 25px -5px ${config.primary_gradient_from}40`
                        }}
                        asChild
                    >
                        <a href="#planes">
                            {config.final_cta_button_text}
                            <Zap className="ml-2 size-5" />
                        </a>
                    </Button>

                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-500">
                        {config.final_cta_badges.map((badge, i) => (
                            <span key={i} className="flex items-center gap-1">
                                <Check className="size-4" style={{ color: config.primary_gradient_from }} />
                                {badge}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-4">
                <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {config.logo_type === "icon" && (
                            <div
                                className="size-6 rounded flex items-center justify-center"
                                style={gradientStyle}
                            >
                                <LogoIcon className="size-4 text-white" />
                            </div>
                        )}
                        <span className="font-bold">{config.logo_text}</span>
                        <span className="text-slate-500">OS</span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                        {config.footer_links.map((link, i) => (
                            <Link key={i} href={link.href} className="hover:text-white transition-colors">
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <span className="text-xs text-slate-600">
                        {config.footer_copyright}
                    </span>
                </div>
            </footer>
        </div>
    )
}
