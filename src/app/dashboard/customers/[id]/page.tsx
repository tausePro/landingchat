import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { getCustomerById } from "../actions"
import {
    computeIntentScore,
    getIntentScoreLabel,
    getIntentScoreColor,
    getIntentScoreIcon,
} from "../lib/intent-score"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { getCurrentTenantLocale } from "@/lib/i18n/tenant-locale-server"

export const dynamic = "force-dynamic"

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
}

const PAID_STATUSES = new Set(["paid", "pagado"])

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const result = await getCustomerById(id)

    if (!result.success) {
        return (
            <DashboardLayout>
                <div className="flex flex-col gap-4">
                    <Link href="/dashboard/customers" className="text-sm font-medium text-text-light-secondary hover:text-primary dark:text-text-dark-secondary">
                        ← Volver a clientes
                    </Link>
                    <p className="text-destructive">{result.error}</p>
                </div>
            </DashboardLayout>
        )
    }

    const c = result.data
    const tenantLocale = await getCurrentTenantLocale()
    const formatCurrency = (amount: number) =>
        formatTenantCurrency(amount, { currency: tenantLocale.currency, locale: tenantLocale.locale })
    const intent = computeIntentScore({
        category: c.category,
        total_orders: c.total_orders,
        total_spent: c.total_spent,
        last_interaction_at: c.last_interaction_at,
    })
    const chatSearch = encodeURIComponent(c.full_name || c.phone || "")
    // El botón del header lleva al chat más reciente; si no hay, a la consola para buscar/iniciar
    const latestChatHref = c.chats.length > 0
        ? `/dashboard/chats/${c.chats[0].id}`
        : `/dashboard/chats/console?search=${chatSearch}`

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <Link href="/dashboard/customers" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-text-light-secondary transition-colors hover:text-primary dark:text-text-dark-secondary">
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Clientes
                    </Link>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
                                {c.full_name}
                            </h1>
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto registrado"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {c.category && (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {c.category}
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getIntentScoreColor(intent)}`}>
                                    <span className="material-symbols-outlined text-sm">{getIntentScoreIcon(intent)}</span>
                                    Intención {getIntentScoreLabel(intent)}
                                </span>
                            </div>
                        </div>
                        {c.chats.length > 0 && (
                            <Link
                                href={latestChatHref}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                            >
                                <span className="material-symbols-outlined text-base">chat</span>
                                Ver conversación
                            </Link>
                        )}
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Card>
                        <CardContent className="p-5">
                            <div className="text-2xl font-bold">{c.total_orders}</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Pedidos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-5">
                            <div className="text-2xl font-bold">{formatCurrency(c.total_spent)}</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Total gastado</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-5">
                            <div className="text-2xl font-bold">{formatCurrency(c.averageOrderValue)}</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Ticket promedio</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-5">
                            <div className="text-2xl font-bold">{formatDate(c.lastOrderAt)}</div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Último pedido</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Pedidos + Conversaciones */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Pedidos ({c.orders.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {c.orders.length > 0 ? c.orders.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/dashboard/orders/${order.id}`}
                                    className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border-light hover:bg-background-light/60 dark:hover:border-border-dark dark:hover:bg-background-dark/60"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                            #{order.order_number || order.id.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                            {formatDate(order.created_at)} · {order.status || "—"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold ${PAID_STATUSES.has((order.payment_status || "").toLowerCase()) ? "text-emerald-600 dark:text-emerald-400" : "text-text-light-primary dark:text-text-dark-primary"}`}>
                                            {formatCurrency(order.total || 0)}
                                        </span>
                                        <span className="material-symbols-outlined text-base text-text-light-secondary dark:text-text-dark-secondary">chevron_right</span>
                                    </div>
                                </Link>
                            )) : (
                                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Sin pedidos registrados
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Conversaciones ({c.chats.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {c.chats.length > 0 ? c.chats.map((chat) => (
                                <Link
                                    key={chat.id}
                                    href={`/dashboard/chats/${chat.id}`}
                                    className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border-light hover:bg-background-light/60 dark:hover:border-border-dark dark:hover:bg-background-dark/60"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-base text-blue-500">
                                            {chat.channel === "whatsapp" ? "chat" : "support_agent"}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium capitalize text-text-light-primary dark:text-text-dark-primary">
                                                {chat.channel || "chat"}
                                            </p>
                                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                {formatDate(chat.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-base text-text-light-secondary dark:text-text-dark-secondary">chevron_right</span>
                                </Link>
                            )) : (
                                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    Sin conversaciones registradas
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Información */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Información</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                                <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Canal de adquisición</dt>
                                <dd className="text-sm font-medium capitalize">{c.acquisition_channel || "—"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Cliente desde</dt>
                                <dd className="text-sm font-medium">{formatDate(c.created_at)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Última interacción</dt>
                                <dd className="text-sm font-medium">{formatDate(c.last_interaction_at)}</dd>
                            </div>
                            {c.address?.city && (
                                <div>
                                    <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Ciudad</dt>
                                    <dd className="text-sm font-medium">{c.address.city}{c.address.zone ? ` · ${c.address.zone}` : ""}</dd>
                                </div>
                            )}
                            {c.document_number && (
                                <div>
                                    <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Documento</dt>
                                    <dd className="text-sm font-medium">{c.document_type || ""} {c.document_number}</dd>
                                </div>
                            )}
                            {c.tags.length > 0 && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <dt className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Etiquetas</dt>
                                    <dd className="mt-1 flex flex-wrap gap-1">
                                        {c.tags.map((tag) => (
                                            <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
