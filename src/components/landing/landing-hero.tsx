import Link from "next/link"
import {
    ArrowRight,
    PlayCircle,
    Grid2x2,
    Bell,
    Settings,
    TrendingUp,
    Clock,
    DollarSign,
    PawPrint,
} from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingHeroProps {
    config: LandingMainConfig
}

// Icon mapping for trust badges
const trustIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    PawPrint,
}

export function LandingHero({ config }: LandingHeroProps) {
    return (
        <section className="relative pt-24 pb-32 overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full h-[800px]">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-landing-mint/10 rounded-full blur-[120px] mix-blend-multiply opacity-50" />
                <div className="absolute top-[10%] right-[-5%] w-[500px] h-[500px] bg-landing-violet/10 rounded-full blur-[120px] mix-blend-multiply opacity-50" />
            </div>

            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                {/* Left: Text */}
                <div className="space-y-8 text-center lg:text-left relative z-20">
                    {/* Badge */}
                    {config.hero_badge_visible && (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-white/60 text-landing-deep text-xs font-bold uppercase tracking-wide backdrop-blur-sm shadow-sm">
                            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                            {config.hero_badge_text}
                        </div>
                    )}

                    {/* Title */}
                    <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-landing-deep">
                        {config.hero_title_line1}
                        <br />
                        <span className="landing-text-gradient">
                            {config.hero_title_line2}
                        </span>
                    </h1>

                    {/* Description */}
                    <p className="text-xl text-gray-600 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                        {config.hero_description}
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-2">
                        <Link
                            href={config.hero_cta_primary_href}
                            className="w-full sm:w-auto px-8 py-4 bg-landing-mint text-landing-deep rounded-2xl font-bold text-lg hover-magnetic shadow-2xl shadow-landing-mint/25 flex items-center justify-center gap-2 group"
                        >
                            {config.hero_cta_primary_text}
                            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <a
                            href={config.hero_cta_secondary_href}
                            className="w-full sm:w-auto px-8 py-4 bg-white/50 backdrop-blur-md text-gray-700 border border-white/60 rounded-2xl font-semibold text-lg hover:bg-white/80 transition-colors flex items-center justify-center gap-2"
                        >
                            <PlayCircle className="size-5" />
                            {config.hero_cta_secondary_text}
                        </a>
                    </div>

                    {/* Trust badges */}
                    <div className="pt-6 border-t border-gray-100/50 lg:mr-20">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                            {config.hero_trust_title}
                        </p>
                        <div className="flex flex-wrap justify-center lg:justify-start items-center gap-8 grayscale opacity-60 hover:opacity-100 transition-opacity">
                            {config.hero_trust_badges.map((badge, i) => {
                                const Icon = badge.icon ? trustIconMap[badge.icon] : null
                                return (
                                    <span
                                        key={i}
                                        className={`text-xl font-bold text-gray-800 tracking-tight ${
                                            badge.style === "italic" ? "italic font-serif" : ""
                                        } ${badge.style === "text" ? "font-black tracking-tighter" : ""}`}
                                    >
                                        {Icon && <Icon className="inline size-5 mr-1" />}
                                        {badge.name}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Dashboard mockup */}
                <div className="relative w-full h-[500px] lg:h-[600px] flex items-center justify-center">
                    <div className="relative w-full max-w-lg">
                        {/* Main card */}
                        <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col">
                            {/* Header */}
                            <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="size-8 rounded-lg bg-landing-deep flex items-center justify-center text-white">
                                        <Grid2x2 className="size-4" />
                                    </div>
                                    <div className="text-sm font-bold text-gray-700">Dashboard de Ventas</div>
                                </div>
                                <div className="flex gap-2 text-gray-400">
                                    <Bell className="size-5" />
                                    <Settings className="size-5" />
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-gray-50/30 flex flex-col gap-4">
                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="text-xs text-gray-400 mb-1">Ventas Hoy (COP)</div>
                                        <div className="text-2xl font-bold text-landing-deep">$4.850.200</div>
                                        <div className="flex items-center gap-1 mt-2 text-xs text-green-500 font-medium">
                                            <TrendingUp className="size-3" /> +12% vs ayer
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="text-xs text-gray-400 mb-1">Pedidos Activos</div>
                                        <div className="text-2xl font-bold text-landing-deep">142</div>
                                        <div className="flex items-center gap-1 mt-2 text-xs text-blue-500 font-medium">
                                            <Clock className="size-3" /> 8 pendientes
                                        </div>
                                    </div>
                                </div>

                                {/* Conversations */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-700">Conversaciones Recientes</h4>
                                        <span className="text-xs text-landing-mint font-bold">Ver todo</span>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { name: "Camila R.", msg: "Pago confirmado, envíenme el...", time: "10:42 AM", color: "bg-green-100 text-green-600", label: "WA" },
                                            { name: "Tienda Moda", msg: "¿Tienen stock del vestido rojo?", time: "10:30 AM", color: "bg-pink-100 text-pink-600", label: "IG" },
                                            { name: "Agente Ventas", msg: "Cerrando venta con cliente #4022...", time: "Ahora", color: "bg-indigo-100 text-indigo-600", label: "AI" },
                                        ].map((conv, i) => (
                                            <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                                <div className={`size-8 rounded-full ${conv.color} flex items-center justify-center text-xs font-bold`}>
                                                    {conv.label}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm font-bold text-gray-800">{conv.name}</span>
                                                        <span className="text-[10px] text-gray-400">{conv.time}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">{conv.msg}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating notification */}
                        <div className="absolute -right-8 top-20 z-20 w-52 bg-white/90 backdrop-blur-md rounded-xl p-4 shadow-xl border border-gray-200 animate-bounce hidden lg:block" style={{ animationDuration: "5s" }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-200">
                                    <DollarSign className="size-4" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 font-medium">Nueva Orden</div>
                                    <div className="text-sm font-bold text-landing-deep">$315.000 COP</div>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div className="bg-green-500 h-1.5 rounded-full w-full" />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-gray-400">Pagado</span>
                                <span className="text-[10px] text-green-600 font-bold">Confirmado</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
