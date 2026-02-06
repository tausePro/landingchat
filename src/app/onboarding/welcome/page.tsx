"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MessageCircle, Store, Bot, ArrowRight, Sparkles } from "lucide-react"

export default function OnboardingWelcome() {
    return (
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
            {/* Hero Section */}
            <div className="flex flex-col items-center gap-4 mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <Sparkles className="size-4" />
                    3 pasos para empezar
                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    ¡Bienvenido a{" "}
                    <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        LandingChat
                    </span>
                    !
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md">
                    Configura tu agente de ventas en minutos y empieza a atender clientes 24/7.
                </p>
            </div>

            {/* Benefits Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
                <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                    <div className="size-14 bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30 rounded-2xl flex items-center justify-center">
                        <Store className="size-7 text-violet-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            Tu Negocio
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Cuéntanos sobre ti
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                    <div className="size-14 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl flex items-center justify-center">
                        <MessageCircle className="size-7 text-green-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            WhatsApp
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Conecta tu número
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                    <div className="size-14 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 rounded-2xl flex items-center justify-center">
                        <Bot className="size-7 text-amber-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            Probar Agente
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Ve la magia en acción
                        </p>
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <Link href="/onboarding/business" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-14 px-10 text-lg font-bold gap-3 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/30">
                    Comenzar Configuración
                    <ArrowRight className="size-5" />
                </Button>
            </Link>

            <p className="text-sm text-slate-400 mt-6">
                Solo tomará ~3 minutos
            </p>
        </div>
    )
}
