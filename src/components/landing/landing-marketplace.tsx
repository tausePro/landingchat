import {
    Sparkles,
    Wine,
    Building,
    Download,
    Bot,
    Heart,
    ShoppingBag,
} from "lucide-react"
import type { LandingMainConfig } from "@/types/landing"

interface LandingMarketplaceProps {
    config: LandingMainConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, React.ComponentType<any>> = {
    Sparkles,
    Wine,
    Building,
    Bot,
    Heart,
    ShoppingBag,
}

const colorMap: Record<string, string> = {
    pink: "text-pink-500",
    orange: "text-orange-500",
    blue: "text-blue-500",
    green: "text-green-500",
    purple: "text-purple-500",
}

export function LandingMarketplace({ config }: LandingMarketplaceProps) {
    return (
        <section className="py-24 bg-white relative overflow-hidden" id="marketplace">
            <div className="absolute -left-20 top-1/2 w-96 h-96 bg-landing-violet/10 rounded-full blur-[100px]" />
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-20 items-center">
                    {/* Left: Info */}
                    <div>
                        <span className="text-landing-mint font-bold tracking-wider text-sm uppercase">
                            {config.marketplace_badge}
                        </span>
                        <h2 className="text-4xl font-bold text-landing-deep mt-2 mb-6">
                            {config.marketplace_title}
                        </h2>
                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            {config.marketplace_description}
                        </p>

                        <div className="space-y-4">
                            {config.marketplace_agents.map((agent, i) => {
                                const Icon = iconMap[agent.icon] || Sparkles
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-landing-violet/30 hover:bg-landing-violet/5 transition-all cursor-pointer group"
                                    >
                                        <div className={`size-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center ${colorMap[agent.color] || "text-gray-500"} group-hover:scale-110 transition-transform`}>
                                            <Icon className="size-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-landing-deep">{agent.name}</h4>
                                            <p className="text-sm text-gray-500">{agent.description}</p>
                                        </div>
                                        <Download className="size-5 text-gray-300 group-hover:text-landing-violet" />
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Chat demo mockup */}
                    <div className="relative">
                        <div className="glass-panel-dark rounded-[2.5rem] p-8 shadow-2xl relative z-10 text-white">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center">
                                        <Bot className="size-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">Agente Instalado</h3>
                                        <p className="text-xs text-indigo-300">Dermo-Expert v2.4</p>
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                                    ACTIVO
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="space-y-4 mb-6 text-sm">
                                <div className="bg-white/10 p-3 rounded-xl rounded-tl-none border border-white/5 max-w-[90%]">
                                    Hola, tengo la piel muy seca y con manchas, ¿qué me recomiendas?
                                </div>
                                <div className="bg-indigo-600 p-3 rounded-xl rounded-tr-none shadow-lg max-w-[90%] ml-auto border border-white/10">
                                    Entendido. Para piel seca con hiperpigmentación, te sugiero el{" "}
                                    <span className="font-bold text-pink-200">Serum Vitamina C + Ácido Hialurónico</span>.
                                    <br /><br />
                                    ¿Te gustaría ver los resultados esperados en 2 semanas?
                                </div>
                            </div>

                            {/* Product card */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-4">
                                <div className="size-12 bg-white rounded-lg flex items-center justify-center text-gray-800 font-bold text-xs">
                                    <ShoppingBag className="size-5 text-landing-deep" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold">Kit Luminosidad Total</div>
                                    <div className="text-xs text-gray-400">$245.000 COP</div>
                                </div>
                                <button className="bg-landing-mint text-landing-deep text-xs font-bold px-3 py-2 rounded-lg hover:bg-white transition-colors">
                                    Ver Detalles
                                </button>
                            </div>
                        </div>

                        {/* Blur behind */}
                        <div className="absolute top-10 -right-10 w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] -z-10 blur-xl opacity-30 transform rotate-3" />
                    </div>
                </div>
            </div>
        </section>
    )
}
