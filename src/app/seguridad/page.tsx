import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Shield, Lock, Server, Eye, Bell, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
    title: "Seguridad | LandingChat",
    description: "Conoce las medidas de seguridad que protegen tu negocio y los datos de tus clientes en LandingChat",
}

export default function SeguridadPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto max-w-3xl px-6 py-16">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8"
                >
                    <ArrowLeft className="size-4" />
                    Volver al inicio
                </Link>

                <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Seguridad
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-300 mb-12">
                    Tu negocio y los datos de tus clientes están protegidos con las mejores prácticas de seguridad.
                </p>

                <div className="space-y-12">
                    {/* Cifrado */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <Lock className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Cifrado de Extremo a Extremo
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                Toda la comunicación entre tu navegador y nuestros servidores está cifrada con TLS 1.3.
                                Los datos sensibles se almacenan cifrados en reposo con AES-256.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    HTTPS forzado en todas las conexiones
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Certificados SSL/TLS renovados automáticamente
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Tokens de acceso encriptados
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Infraestructura */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Infraestructura Segura
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                Nuestra infraestructura está alojada en proveedores certificados con los más altos
                                estándares de seguridad.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Base de datos en Supabase (SOC 2 Tipo II)
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Hosting en Vercel (ISO 27001)
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    CDN global con protección DDoS
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Backups automáticos diarios
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Autenticación */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Autenticación Segura
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                Protegemos el acceso a tu cuenta con múltiples capas de seguridad.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Inicio de sesión con Google OAuth
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Tokens JWT con expiración automática
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Sesiones revocables desde el panel
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Detección de inicios de sesión sospechosos
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Control de Acceso */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Eye className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Control de Acceso
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                Implementamos políticas estrictas de acceso a datos siguiendo el principio de
                                mínimo privilegio.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Row Level Security (RLS) en base de datos
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Aislamiento completo entre organizaciones
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Auditoría de acceso a datos sensibles
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    API keys con permisos granulares
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Monitoreo */}
                    <section className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                                <Bell className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Monitoreo Continuo
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 mb-4">
                                Monitoreamos activamente nuestra infraestructura para detectar y responder
                                a amenazas en tiempo real.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Alertas automáticas 24/7
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Logs de auditoría inmutables
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Detección de anomalías con IA
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Plan de respuesta a incidentes
                                </li>
                            </ul>
                        </div>
                    </section>
                </div>

                {/* Cumplimiento */}
                <div className="mt-16 p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                        Cumplimiento Normativo
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                        LandingChat cumple con las regulaciones de protección de datos aplicables:
                    </p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Ley 1581 de 2012 (Colombia)
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Políticas de WhatsApp Business
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Estándares PCI-DSS (vía pasarelas)
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            Políticas de uso de Meta
                        </li>
                    </ul>
                </div>

                {/* Reportar vulnerabilidad */}
                <div className="mt-8 p-6 border border-slate-200 dark:border-slate-700 rounded-2xl">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        ¿Encontraste una vulnerabilidad?
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                        Si descubres una vulnerabilidad de seguridad, por favor repórtala de forma responsable:
                    </p>
                    <p className="text-slate-900 dark:text-white font-medium">
                        seguridad@landingchat.co
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        Agradecemos tu colaboración para mantener LandingChat seguro.
                    </p>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        © 2026 LandingChat. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    )
}
