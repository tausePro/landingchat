import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getOrders } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: { page?: string; status?: string; search?: string }
}) {
    const page = Number(searchParams.page) || 1
    const status = searchParams.status || "Todos los estados"
    const search = searchParams.search || ""

    const { orders, total, totalPages } = await getOrders({ page, status, search })

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'delivered':
            case 'completed':
            case 'entregado':
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
            case 'confirmed':
            case 'confirmado':
            case 'paid':
            case 'pagado':
                return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
            case 'shipped':
            case 'enviado':
                return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            case 'processing':
            case 'procesando':
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
            case 'pending':
            case 'pendiente':
                return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
            case 'cancelled':
            case 'cancelado':
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
            case 'refunded':
            case 'reembolsado':
                return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status.toLowerCase()) {
            case 'delivered':
            case 'completed':
            case 'entregado':
                return "Entregado"
            case 'confirmed':
            case 'confirmado':
            case 'paid':
            case 'pagado':
                return "Confirmado"
            case 'shipped':
            case 'enviado':
                return "Enviado"
            case 'processing':
            case 'procesando':
                return "Procesando"
            case 'pending':
            case 'pendiente':
                return "Pendiente"
            case 'cancelled':
            case 'cancelado':
                return "Cancelado"
            case 'refunded':
            case 'reembolsado':
                return "Reembolsado"
            default:
                return status.charAt(0).toUpperCase() + status.slice(1)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">Gestión de Pedidos</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                            Gestiona y haz seguimiento de todos los pedidos de tu tienda.
                        </p>
                    </div>
                    {/* Botones deshabilitados temporalmente
                    <div className="flex items-center gap-2">
                        <button className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-text-light-primary dark:text-text-dark-primary text-sm font-medium shadow-sm hover:bg-background-light dark:hover:bg-background-dark">
                            <span className="material-symbols-outlined text-lg">download</span>
                            <span className="truncate">Exportar</span>
                        </button>
                        <button className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90">
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span className="truncate">Nuevo Pedido</span>
                        </button>
                    </div>
                    */}
                </div>

                <div className="mt-8 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                    <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full sm:max-w-xs">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-light-secondary dark:text-text-dark-secondary text-sm">search</span>
                            <input
                                className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 text-sm font-normal"
                                placeholder="Buscar por cliente o ID..."
                                defaultValue={search}
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Select defaultValue={status}>
                                <SelectTrigger className="w-[180px] rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent focus:outline-none focus:ring-2 focus:ring-primary text-sm h-10">
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todos los estados">Todos los estados</SelectItem>
                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                    <SelectItem value="procesando">Procesando</SelectItem>
                                    <SelectItem value="enviado">Enviado</SelectItem>
                                    <SelectItem value="entregado">Entregado</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                                <tr>
                                    <th className="px-6 py-3" scope="col">ID Pedido</th>
                                    <th className="px-6 py-3" scope="col">Cliente</th>
                                    <th className="px-6 py-3" scope="col">Fecha</th>
                                    <th className="px-6 py-3" scope="col">Estado</th>
                                    <th className="px-6 py-3" scope="col">Total</th>
                                    <th className="px-6 py-3 text-right" scope="col">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 ? (
                                    <tr className="border-b border-border-light dark:border-border-dark">
                                        <td colSpan={6} className="px-6 py-8 text-center text-text-light-secondary dark:text-text-dark-secondary">
                                            No hay pedidos encontrados
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((order) => (
                                        <tr key={order.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                                            <th className="px-6 py-4 font-medium text-text-light-primary dark:text-text-dark-primary whitespace-nowrap" scope="row">
                                                #{order.id.slice(0, 8)}
                                            </th>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-text-light-primary dark:text-text-dark-primary font-medium">{order.customer?.full_name || "Cliente Anónimo"}</span>
                                                    <span className="text-text-light-secondary dark:text-text-dark-secondary text-xs">{order.customer?.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-light-secondary dark:text-text-dark-secondary">
                                                {format(new Date(order.created_at), "d MMM yyyy", { locale: es })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                    <span className={`size-2 rounded-full ${getStatusColor(order.status).replace('text-', 'bg-').replace('100', '500').replace('800', '500').split(' ')[0]}`}></span>
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-text-light-primary dark:text-text-dark-primary font-semibold">
                                                {formatCurrency(order.total_amount)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/dashboard/orders/${order.id}`} className="font-medium text-primary hover:underline">
                                                    Ver Detalles
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination (Static for now based on prototype style) */}
                    <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                            Mostrando <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">1-{orders.length}</span> de <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">{total}</span>
                        </p>
                        <nav className="flex items-center gap-2">
                            <button className="inline-flex items-center justify-center size-8 rounded-lg border border-border-light dark:border-border-dark text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark">
                                <span className="material-symbols-outlined text-xl">chevron_left</span>
                            </button>
                            <button className="inline-flex items-center justify-center size-8 rounded-lg bg-primary text-white text-sm">1</button>
                            <button className="inline-flex items-center justify-center size-8 rounded-lg border border-border-light dark:border-border-dark text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark">
                                <span className="material-symbols-outlined text-xl">chevron_right</span>
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
