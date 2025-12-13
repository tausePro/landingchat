import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Wrench, Clock, ArrowLeft } from "lucide-react"

interface MaintenancePageProps {
    params: Promise<{ slug: string }>
}

export default async function StoreMaintenancePage({ params }: MaintenancePageProps) {
    const { slug } = await params
    const supabase = createServiceClient()

    // Get organization
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, maintenance_message, logo_url, settings")
        .eq("slug", slug)
        .single()

    if (!org) {
        notFound()
    }

    const primaryColor = org.settings?.branding?.primaryColor || "#3b82f6"
    const message = org.maintenance_message || "Estamos realizando mejoras en nuestra tienda. Volveremos pronto con novedades increíbles."

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full text-center">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
                    {/* Store Logo/Icon */}
                    <div className="flex justify-center mb-8">
                        {org.logo_url ? (
                            <img
                                src={org.logo_url}
                                alt={org.name}
                                className="h-16 w-auto object-contain max-w-[200px]"
                            />
                        ) : (
                            <div className="relative">
                                <div 
                                    className="size-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {org.name.substring(0, 1)}
                                </div>
                                <div className="absolute -top-2 -right-2 size-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                                    <Wrench className="size-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Store Name */}
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {org.name}
                    </h1>

                    {/* Maintenance Title */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />
                        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                            Temporalmente Cerrado
                        </h2>
                    </div>

                    {/* Custom Message */}
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                        {message}
                    </p>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                            ¿Qué está pasando?
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 text-left">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>Estamos mejorando nuestra tienda para ofrecerte una mejor experiencia</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>Todos tus datos y pedidos están seguros</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>Volveremos pronto con novedades increíbles</span>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        <p>¿Tienes alguna pregunta urgente?</p>
                        <p className="mt-1">
                            Puedes contactarnos y te responderemos lo antes posible
                        </p>
                    </div>

                    {/* Back to Main Site */}
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                        <ArrowLeft className="size-4" />
                        Volver al sitio principal
                    </Link>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Powered by LandingChat
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}