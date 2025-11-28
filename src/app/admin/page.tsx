import { createClient } from "@/lib/supabase/server"
import { MaintenanceToggle } from "./components/maintenance-toggle"

export default async function AdminDashboardPage() {
    const supabase = await createClient()

    // Fetch basic stats
    const { count: orgCount } = await supabase.from("organizations").select("*", { count: "exact", head: true })
    const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })
    const { count: chatCount } = await supabase.from("chats").select("*", { count: "exact", head: true })

    // Fetch recent organizations
    const { data: recentOrgs } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)

    return (
        <div className="space-y-8">
            {/* Hero Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Organizaciones Totales</p>
                            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{orgCount || 0}</h3>
                        </div>
                        <div className="rounded-full bg-blue-50 p-3 dark:bg-blue-900/20">
                            <svg className="size-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-600">
                        <svg className="mr-1 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Crecimiento Activo</span>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Usuarios Totales</p>
                            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{userCount || 0}</h3>
                        </div>
                        <div className="rounded-full bg-purple-50 p-3 dark:bg-purple-900/20">
                            <svg className="size-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-600">
                        <svg className="mr-1 size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">En Crecimiento</span>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Conversaciones Totales</p>
                            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{chatCount || 0}</h3>
                        </div>
                        <div className="rounded-full bg-indigo-50 p-3 dark:bg-indigo-900/20">
                            <svg className="size-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-slate-500">
                        <span className="font-medium">Histórico</span>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">MRR Estimado</p>
                            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">$0</h3>
                        </div>
                        <div className="rounded-full bg-green-50 p-3 dark:bg-green-900/20">
                            <svg className="size-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-slate-500">
                        <span className="font-medium">Basado en planes activos</span>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white">Organizaciones Recientes</h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-6">
                            {recentOrgs?.map((org) => (
                                <div key={org.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                            {org.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{org.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{org.subdomain}.landingchat.co</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${org.onboarding_completed
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                            }`}>
                                            {org.onboarding_completed ? "Activo" : "En Onboarding"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {(!recentOrgs || recentOrgs.length === 0) && (
                                <p className="text-center text-sm text-slate-500">No se encontraron organizaciones</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-900 dark:text-white">Estado del Sistema</h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-green-500"></div>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Base de Datos</span>
                                </div>
                                <span className="text-sm text-green-600 dark:text-green-400">Operativo</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-green-500"></div>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Almacenamiento</span>
                                </div>
                                <span className="text-sm text-green-600 dark:text-green-400">Operativo</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-green-500"></div>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Sistema de Autenticación</span>
                                </div>
                                <span className="text-sm text-green-600 dark:text-green-400">Operativo</span>
                            </div>

                            {/* Maintenance Mode Toggle */}
                            <MaintenanceToggle />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
