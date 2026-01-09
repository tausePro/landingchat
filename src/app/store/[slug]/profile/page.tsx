import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProfileView } from "./components/profile-view"
import Link from "next/link"

interface ProfilePageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ phone?: string }>
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
    const { slug } = await params
    const { phone } = await searchParams
    const supabase = createServiceClient()

    // Get organization
    const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, settings")
        .eq("slug", slug)
        .single()

    if (!org || orgError) {
        console.error("[Profile] Organization not found:", slug, orgError)
        notFound()
    }
    
    // Get WhatsApp phone from whatsapp_instances table (corporate instance)
    const { data: whatsappInstance } = await supabase
        .from("whatsapp_instances")
        .select("phone_number")
        .eq("organization_id", org.id)
        .eq("instance_type", "corporate")
        .eq("status", "connected")
        .single()
    
    const orgPhone = whatsappInstance?.phone_number || org.settings?.contact?.phone || null

    // If no phone provided, show login form (WhatsApp-first)
    if (!phone) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="text-center mb-6">
                            <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 mx-auto mb-4">
                                <span className="material-symbols-outlined text-2xl">smartphone</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                Mi Cuenta
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400">
                                Ingresa tu número de WhatsApp para ver tu información y pedidos
                            </p>
                        </div>
                        <form action="" method="get" className="space-y-4">
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Número de WhatsApp
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-sm">
                                        +57
                                    </span>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        required
                                        pattern="[0-9]{10}"
                                        maxLength={10}
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-r-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="300 123 4567"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                    El mismo número que usaste para chatear con nosotros
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">login</span>
                                Ver Mi Cuenta
                            </button>
                        </form>
                        <div className="mt-6 text-center">
                            <Link
                                href="/"
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

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/\D/g, '')
    
    // Get customer data by phone
    const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", org.id)
        .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${normalizedPhone.slice(-10)}%`)
        .single()

    if (!customer) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex size-16 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 mx-auto mb-4">
                            <span className="material-symbols-outlined text-2xl">search_off</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            No encontramos tu cuenta
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            No encontramos pedidos asociados a este número en {org.name}. ¿Ya has comprado con nosotros?
                        </p>
                        <div className="space-y-3">
                            <Link
                                href="/profile"
                                className="inline-block w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-medium"
                            >
                                Intentar con otro número
                            </Link>
                            <Link
                                href="/chat"
                                className="inline-flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors font-medium"
                            >
                                <span className="material-symbols-outlined text-lg">chat</span>
                                Chatear para comprar
                            </Link>
                            <Link
                                href="/"
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

    // Get customer chats
    const { data: chats } = await supabase
        .from("chats")
        .select("id, status, created_at, updated_at")
        .eq("organization_id", org.id)
        .eq("customer_id", customer.id)
        .order("updated_at", { ascending: false })
        .limit(5)

    // Enrich organization with phone for WhatsApp button
    const enrichedOrg = {
        ...org,
        phone: orgPhone
    }

    return (
        <ProfileView 
            customer={customer}
            orders={orders || []}
            organization={enrichedOrg}
            chats={chats || []}
        />
    )
}