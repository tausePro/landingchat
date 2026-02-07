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
    BrainCircuit,
    Package,
    CreditCard,
    Database,
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
    Heart, Rocket, Target, Award, Crown, Gem, Gift, Check, BrainCircuit,
    Package, CreditCard, Database
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

    // Dynamic gradient style (para fondos/botones)
    const gradientStyle = {
        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`
    }

    // Gradient para texto (bg-clip-text necesita las propiedades webkit explícitas)
    const gradientTextStyle = {
        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    } as React.CSSProperties

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
                            className="block"
                            style={gradientTextStyle}
                        >
                            {program.hero_subtitle}
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10">
                        {program.hero_description}
                    </p>

                    {/* Counter with Progress */}
                    <div className="relative mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm mb-8 overflow-hidden group">
                        {/* Animated border glow */}
                        <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${config.primary_gradient_from}10, transparent)`,
                                animation: "shimmer 2s infinite"
                            }}
                        />

                        <div className="relative z-10 text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-400 mb-3">
                                Cupos Restantes:
                            </p>
                            <div className="text-5xl sm:text-6xl font-black mb-4">
                                <span style={gradientTextStyle}>
                                    {program.slots_remaining}
                                </span>
                                <span className="text-slate-500">/{program.total_slots}</span>
                            </div>

                            {/* Progress bar */}
                            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${((program.total_slots - program.slots_remaining) / program.total_slots) * 100}%`,
                                        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`
                                    }}
                                />
                                {/* Animated shine */}
                                <div
                                    className="absolute inset-y-0 left-0 w-20 rounded-full opacity-30"
                                    style={{
                                        background: `linear-gradient(90deg, transparent, white, transparent)`,
                                        animation: "shimmer 2s infinite"
                                    }}
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                {program.total_slots - program.slots_remaining} fundadores ya aseguraron su lugar
                            </p>
                        </div>

                        {/* Activity Feed Ticker - Enhanced */}
                        {activity_feed.length > 0 && (
                            <div className="mt-6 pt-5 border-t border-white/10">
                                <div className="relative">
                                    {/* Notification card style */}
                                    <div
                                        className="flex items-center gap-3 rounded-xl p-3 transition-all duration-500"
                                        style={{ backgroundColor: `${config.primary_gradient_from}10` }}
                                    >
                                        {/* Animated avatar */}
                                        <div
                                            className="relative size-10 rounded-full flex items-center justify-center shrink-0"
                                            style={{ background: `linear-gradient(135deg, ${config.primary_gradient_from}, ${config.primary_gradient_to})` }}
                                        >
                                            <Users className="size-5 text-white" />
                                            {/* Pulse ring */}
                                            <span
                                                className="absolute inset-0 rounded-full animate-ping opacity-30"
                                                style={{ backgroundColor: config.primary_gradient_from }}
                                            />
                                        </div>

                                        {/* Message with slide animation */}
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <p
                                                key={currentActivityIndex}
                                                className="text-sm text-white font-medium truncate animate-slide-up"
                                            >
                                                {activity_feed[currentActivityIndex]?.message || "Únete a los founding members"}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Hace unos momentos</p>
                                        </div>

                                        {/* Live indicator */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="relative flex size-2">
                                                <span
                                                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                                                    style={{ backgroundColor: config.primary_gradient_from }}
                                                />
                                                <span
                                                    className="relative inline-flex size-2 rounded-full"
                                                    style={{ backgroundColor: config.primary_gradient_from }}
                                                />
                                            </span>
                                            <span className="text-xs font-medium" style={{ color: config.primary_gradient_from }}>
                                                EN VIVO
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dots indicator */}
                                    {activity_feed.length > 1 && (
                                        <div className="flex justify-center gap-1.5 mt-3">
                                            {activity_feed.slice(0, 5).map((_, i) => (
                                                <span
                                                    key={i}
                                                    className="size-1.5 rounded-full transition-all duration-300"
                                                    style={{
                                                        backgroundColor: i === currentActivityIndex % 5
                                                            ? config.primary_gradient_from
                                                            : "rgba(255,255,255,0.2)"
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
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
                                        <span style={gradientTextStyle}>
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

            {/* Features Bento Grid Section */}
            <section
                className="py-24 px-4 relative"
                style={{
                    background: `linear-gradient(to bottom, transparent, ${config.primary_gradient_from}08, transparent)`
                }}
            >
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />

                <div className="mx-auto max-w-6xl relative z-10">
                    <div className="text-center mb-16">
                        <div
                            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-4"
                            style={{
                                backgroundColor: `${config.primary_gradient_from}15`,
                                borderColor: `${config.primary_gradient_from}30`,
                                color: config.primary_gradient_from
                            }}
                        >
                            <Sparkles className="size-3" />
                            {config.features_subtitle}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold">
                            {config.features_title}
                        </h2>
                    </div>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Agente IA - Large card */}
                        <div
                            className="md:col-span-2 group relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05]"
                        >
                            {/* Glow effect on hover */}
                            <div
                                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                style={{ background: `linear-gradient(to right, ${config.primary_gradient_from}20, ${config.primary_gradient_to}20)` }}
                            />

                            <div className="relative z-10">
                                <div className="flex items-start justify-between mb-6">
                                    <div
                                        className="size-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                        style={{ background: `linear-gradient(135deg, ${config.primary_gradient_from}, ${config.primary_gradient_to})` }}
                                    >
                                        <BrainCircuit className="size-7 text-white" />
                                    </div>
                                    <span
                                        className="text-xs font-bold px-2 py-1 rounded-full"
                                        style={{
                                            backgroundColor: `${config.primary_gradient_from}20`,
                                            color: config.primary_gradient_from
                                        }}
                                    >
                                        CORE
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold mb-2 text-white group-hover:text-white/90 transition-colors">
                                    Tu Empleado Digital 24/7
                                </h4>
                                <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                                    Entrénalo con tu catálogo y políticas. Responde preguntas, procesa pedidos y cierra ventas mientras duermes. Powered by GPT-4o + RAG.
                                </p>

                                {/* Animated stats */}
                                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-black" style={{ color: config.primary_gradient_from }}>24/7</div>
                                        <div className="text-xs text-slate-500">Disponible</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black" style={{ color: config.primary_gradient_from }}>&lt;3s</div>
                                        <div className="text-xs text-slate-500">Respuesta</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black" style={{ color: config.primary_gradient_from }}>95%</div>
                                        <div className="text-xs text-slate-500">Precisión</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CAPI & Data */}
                        <div
                            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05]"
                        >
                            <div
                                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                style={{ background: `${config.primary_gradient_to}20` }}
                            />

                            <div className="relative z-10">
                                <div
                                    className="size-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                                    style={{ backgroundColor: `${config.primary_gradient_to}20` }}
                                >
                                    <Database className="size-6" style={{ color: config.primary_gradient_to }} />
                                </div>
                                <h4 className="font-bold mb-2 text-white">CAPI & First-Party Data</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    Eventos server-side con Match Quality superior al 90%.
                                </p>

                                {/* Mini progress bars */}
                                <div className="space-y-2">
                                    {[
                                        { label: "Purchase", value: 98 },
                                        { label: "Lead", value: 95 },
                                        { label: "ViewContent", value: 87 },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-20">{item.label}</span>
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 group-hover:w-full"
                                                    style={{
                                                        width: `${item.value}%`,
                                                        background: `linear-gradient(to right, ${config.primary_gradient_from}, ${config.primary_gradient_to})`
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: config.primary_gradient_from }}>{item.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Stock Inteligente */}
                        <div
                            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05]"
                        >
                            <div
                                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                style={{ background: `${config.accent_color}20` }}
                            />

                            <div className="relative z-10">
                                <div
                                    className="size-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                                    style={{ backgroundColor: `${config.accent_color}20` }}
                                >
                                    <Package className="size-6" style={{ color: config.accent_color }} />
                                </div>
                                <h4 className="font-bold mb-2 text-white">Stock Inteligente</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    Tu agente conoce inventario en tiempo real y sugiere alternativas.
                                </p>

                                {/* Mini product card */}
                                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                    <div className="flex gap-3">
                                        <div className="size-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                                            <Package className="size-5 text-pink-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-white truncate">Vestido Floral XS</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="size-1.5 bg-amber-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] text-amber-400">¡Últimas 3!</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pagos - Wide */}
                        <div
                            className="md:col-span-2 group relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 overflow-hidden transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05]"
                        >
                            <div
                                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                style={{ background: `linear-gradient(to right, ${config.primary_gradient_from}20, ${config.primary_gradient_to}20)` }}
                            />

                            <div className="relative z-10 grid md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <div
                                        className="size-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                                        style={{ backgroundColor: `${config.primary_gradient_from}20` }}
                                    >
                                        <CreditCard className="size-6" style={{ color: config.primary_gradient_from }} />
                                    </div>
                                    <h4 className="text-xl font-bold mb-2 text-white">Cobra desde el Chat</h4>
                                    <p className="text-slate-400 leading-relaxed">
                                        Genera links de pago con un clic. Integración nativa con las principales pasarelas de LATAM.
                                    </p>
                                </div>

                                {/* Payment logos grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { name: "wompi", color: "#00C389" },
                                        { name: "ePayco", color: "#009EE3" },
                                        { name: "addi", color: "#00D1A1" },
                                        { name: "Bold", color: "#ffffff" },
                                    ].map((gateway) => (
                                        <div
                                            key={gateway.name}
                                            className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-105"
                                        >
                                            <span
                                                className="text-sm font-black"
                                                style={{ color: gateway.color }}
                                            >
                                                {gateway.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 px-4">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="text-4xl sm:text-5xl font-black mb-4">
                        {config.final_cta_title}
                        <br />
                        <span style={gradientTextStyle}>
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
