import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProfileView } from "./components/profile-view"
import Link from "next/link"

interface ProfilePageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ email?: string }>
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
    const { slug } = await params
    const { email } = await searchParams
    const supabase = createServiceClient()

    // Get organization
    const { data: org } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", slug)
        .single()

    if (!org) notFound()

    // If no email provided, show login form
    if (!email) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="text-center mb-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                                <span className="material-symbols-outlined text-2xl">person</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                Mi Perfil
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400">
                                Ingresa tu email para ver tu información y pedidos
                            </p>
                        </div>
                        <form action={`/store/${slug}/profile`} method="get" className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="tu@email.com"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-medium"
                            >
                                Ver Mi Perfil
                            </button>
                        </form>
                        <div className="mt-6 text-center">
                            <Link
                                href={`/store/${slug}`}
                                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                            >
                                ← Volver a la tienda
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Get customer data
    const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", org.id)
        .eq("email", email)
        .single()

    if (!customer) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/20 mx-auto mb-4">
                            <span className="material-symbols-outlined text-2xl">person_off</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            Cliente No Encontrado
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            No encontramos un perfil asociado a este email en {org.name}.
                        </p>
                        <div className="space-y-3">
                            <Link
                                href={`/store/${slug}/profile`}
                                className="inline-block w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-medium"
                            >
                                Intentar con otro email
                            </Link>
                            <Link
                                href={`/store/${slug}`}
                                className="inline-block w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 py-2"
                            >
                                Volver a la Tienda
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Get customer orders
    const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_status, created_at, items")
        .eq("organization_id", org.id)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })

    return (
        <ProfileView 
            customer={customer}
            orders={orders || []}
            organization={org}
        />
    )
}