import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function OnboardingWelcome() {
    return (
        <>
            {/* Page Heading */}
            <div className="flex flex-wrap justify-between gap-3 p-4">
                <div className="flex min-w-72 flex-col gap-3">
                    <p className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
                        ¡Bienvenido a LandingChat!
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                        Vamos a configurar tu espacio de trabajo para que empieces a vender y comunicarte con tus clientes en minutos.
                    </p>
                </div>
            </div>

            {/* Benefits Cards */}
            <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-8">
                Empieza a disfrutar de los beneficios clave
            </h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 p-4">
                <div className="flex flex-1 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex-col transition-all hover:shadow-lg hover:border-primary/50">
                    <div className="text-primary">
                        <span className="material-symbols-outlined text-3xl">forum</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-base font-bold leading-tight">
                            Centraliza tus Canales
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Conecta todas tus plataformas de mensajería en un solo lugar.
                        </p>
                    </div>
                </div>
                <div className="flex flex-1 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex-col transition-all hover:shadow-lg hover:border-primary/50">
                    <div className="text-primary">
                        <span className="material-symbols-outlined text-3xl">storefront</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-base font-bold leading-tight">
                            Crea tu Tienda Conversacional
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Diseña una experiencia de compra única a través del chat.
                        </p>
                    </div>
                </div>
                <div className="flex flex-1 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex-col transition-all hover:shadow-lg hover:border-primary/50">
                    <div className="text-primary">
                        <span className="material-symbols-outlined text-3xl">group</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-base font-bold leading-tight">
                            Gestiona tu Equipo
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Colabora y asigna conversaciones a múltiples agentes fácilmente.
                        </p>
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center p-4 mt-8">
                <Link href="/onboarding/store" className="w-full max-w-xs">
                    <Button className="w-full h-12 text-base font-bold gap-2 transition-transform hover:scale-105">
                        <span>Comenzar Configuración</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </Button>
                </Link>
            </div>
        </>
    )
}
