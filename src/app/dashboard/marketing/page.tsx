import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link"

export default function MarketingPage() {
    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex min-w-72 flex-col">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">Marketing</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                            Gestiona promociones, cupones y configuración de envíos
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Shipping Configuration Card */}
                    <Link href="/dashboard/marketing/shipping">
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                    <span className="material-symbols-outlined text-primary text-2xl">local_shipping</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Envío Gratis</h3>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Configura reglas de envío gratis
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Coupons Card */}
                    <Link href="/dashboard/marketing/coupons">
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                                    <span className="material-symbols-outlined text-success text-2xl">confirmation_number</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Cupones</h3>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Gestiona cupones de descuento
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Badges Card */}
                    <Link href="/dashboard/badges">
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                                    <span className="material-symbols-outlined text-purple-500 text-2xl">badge</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Badges</h3>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Gestiona badges de productos
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Promotions Card */}
                    <Link href="/dashboard/promotions">
                        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6 hover:shadow-lg transition-shadow cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                                    <span className="material-symbols-outlined text-orange-500 text-2xl">percent</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Promociones</h3>
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                        Gestiona promociones activas
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </DashboardLayout>
    )
}
