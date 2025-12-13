"use client"

import { useState } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface Customer {
    id: string
    full_name: string
    email: string
    phone?: string
    document_type?: string
    document_number?: string
    person_type?: string
    business_name?: string
    created_at: string
}

interface Order {
    id: string
    order_number?: string
    total: number
    status: string
    payment_status: string
    created_at: string
    items: any[]
}

interface Organization {
    id: string
    name: string
    slug: string
}

interface ProfileViewProps {
    customer: Customer
    orders: Order[]
    organization: Organization
}

export function ProfileView({ customer, orders, organization }: ProfileViewProps) {
    const [activeTab, setActiveTab] = useState<'orders' | 'conversations' | 'tracking'>('orders')
    const [searchTerm, setSearchTerm] = useState('')

    // Filter orders based on search
    const filteredOrders = orders.filter(order => 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Get active shipments (orders that are shipped but not delivered)
    const activeShipments = orders.filter(order => 
        order.status === 'shipped' || order.status === 'processing'
    )

    // Get customer initials for avatar
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    // Get status badge
    const getStatusBadge = (status: string, paymentStatus: string) => {
        if (status === 'delivered') {
            return (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                    Entregado
                </span>
            )
        }
        if (status === 'shipped') {
            return (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    En tránsito
                </span>
            )
        }
        if (status === 'processing' || status === 'confirmed') {
            return (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                    Procesando
                </span>
            )
        }
        if (paymentStatus === 'pending') {
            return (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                    Pendiente Pago
                </span>
            )
        }
        return (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {status}
            </span>
        )
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-200 min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <Link href={`/store/${organization.slug}`} className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                                <span className="material-symbols-outlined">chat_bubble</span>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                {organization.name} <span className="text-slate-400 font-normal text-sm">| Store</span>
                            </span>
                        </Link>
                    </div>
                    <nav className="hidden md:flex items-center gap-8">
                        <span className="text-sm font-semibold text-primary">Mi Cuenta</span>
                        <Link href={`/store/${organization.slug}/profile?email=${customer.email}#orders`} className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                            Pedidos
                        </Link>
                        <Link href={`/store/${organization.slug}`} className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                            Ayuda
                        </Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href={`/store/${organization.slug}`} className="hidden md:flex text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                            Volver a la Tienda
                        </Link>
                        <div className="md:hidden">
                            <span className="material-symbols-outlined icon-light">menu</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        {/* Profile Header */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                <div className="relative">
                                    <div className="flex size-20 items-center justify-center rounded-full bg-blue-50 text-primary dark:bg-blue-900/20">
                                        <span className="text-3xl font-bold">{getInitials(customer.full_name)}</span>
                                    </div>
                                    <div className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        Hola, {customer.full_name}
                                    </h1>
                                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        Es un gusto tenerte de vuelta. Aquí está el resumen de tu actividad.
                                    </p>
                                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                                        {customer.phone && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                <span className="material-symbols-outlined text-sm">smartphone</span>
                                                {customer.phone}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-sm">mail</span>
                                            {customer.email}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="border-b border-slate-200 dark:border-slate-800">
                            <nav aria-label="Tabs" className="-mb-px flex space-x-8 overflow-x-auto">
                                <button
                                    onClick={() => setActiveTab('orders')}
                                    className={`border-b-2 py-4 px-1 text-sm font-semibold ${
                                        activeTab === 'orders'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Mis Pedidos
                                </button>
                                <button
                                    onClick={() => setActiveTab('conversations')}
                                    className={`border-b-2 py-4 px-1 text-sm font-medium ${
                                        activeTab === 'conversations'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Mis Conversaciones
                                </button>
                                <button
                                    onClick={() => setActiveTab('tracking')}
                                    className={`border-b-2 py-4 px-1 text-sm font-medium ${
                                        activeTab === 'tracking'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Seguimiento de Envío
                                </button>
                            </nav>
                        </div>

                        {/* Active Shipments */}
                        {activeTab === 'orders' && activeShipments.length > 0 && (
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Envíos Activos</h3>
                                {activeShipments.map((order) => (
                                    <div key={order.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 dark:border-blue-900/30 dark:bg-blue-900/10 mb-4">
                                        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                                        Pedido {order.order_number || `#${order.id.slice(0, 8)}`}
                                                    </h4>
                                                    {getStatusBadge(order.status, order.payment_status)}
                                                </div>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Entrega estimada: <span className="font-semibold text-slate-900 dark:text-white">Próximamente</span>
                                                </p>
                                            </div>
                                            <Link
                                                href={`/store/${organization.slug}/order/${order.id}`}
                                                className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
                                            >
                                                <span className="material-symbols-outlined text-lg">local_shipping</span>
                                                Ver Detalles
                                            </Link>
                                        </div>
                                        <div className="relative mb-2">
                                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-blue-900">
                                                <div 
                                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary" 
                                                    style={{ width: order.status === 'shipped' ? '70%' : '30%' }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                                <span>Procesado</span>
                                                <span className={order.status === 'shipped' ? 'text-primary font-bold' : ''}>En camino</span>
                                                <span>Entregado</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Orders History */}
                        {activeTab === 'orders' && (
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historial de Pedidos</h3>
                                    <div className="relative">
                                        <input
                                            className="pl-9 pr-4 py-2 text-sm rounded-lg border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 focus:border-primary focus:ring-primary w-48"
                                            placeholder="Buscar pedido..."
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-lg">search</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold" scope="col">ID Pedido</th>
                                                    <th className="px-6 py-4 font-semibold" scope="col">Fecha</th>
                                                    <th className="px-6 py-4 font-semibold" scope="col">Total</th>
                                                    <th className="px-6 py-4 font-semibold" scope="col">Estado</th>
                                                    <th className="px-6 py-4 font-semibold text-right" scope="col">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {filteredOrders.length > 0 ? (
                                                    filteredOrders.map((order) => (
                                                        <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                                {order.order_number || `#${order.id.slice(0, 8)}`}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4">{formatDate(order.created_at)}</td>
                                                            <td className="whitespace-nowrap px-6 py-4">{formatCurrency(order.total)}</td>
                                                            <td className="whitespace-nowrap px-6 py-4">
                                                                {getStatusBadge(order.status, order.payment_status)}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                                <Link
                                                                    href={`/store/${organization.slug}/order/${order.id}`}
                                                                    className="text-primary hover:text-primary-dark font-medium text-sm"
                                                                >
                                                                    Ver Detalles
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                                            {searchTerm ? 'No se encontraron pedidos con ese criterio' : 'No tienes pedidos aún'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {filteredOrders.length > 0 && (
                                        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                                            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                                                Mostrando {filteredOrders.length} de {orders.length} pedidos
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Conversations Tab */}
                        {activeTab === 'conversations' && (
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Mis Conversaciones</h3>
                                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 mx-auto mb-4">
                                        <span className="material-symbols-outlined text-2xl">chat</span>
                                    </div>
                                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                        Inicia una conversación
                                    </h4>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                                        Chatea con nuestro asistente para obtener ayuda con tus pedidos o encontrar productos.
                                    </p>
                                    <Link
                                        href={`/store/${organization.slug}/chat`}
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                                    >
                                        <span className="material-symbols-outlined text-lg">chat</span>
                                        Iniciar Chat
                                    </Link>
                                </div>
                            </section>
                        )}

                        {/* Tracking Tab */}
                        {activeTab === 'tracking' && (
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Seguimiento de Envío</h3>
                                {activeShipments.length > 0 ? (
                                    <div className="space-y-4">
                                        {activeShipments.map((order) => (
                                            <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                                                        Pedido {order.order_number || `#${order.id.slice(0, 8)}`}
                                                    </h4>
                                                    {getStatusBadge(order.status, order.payment_status)}
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20">
                                                            <span className="material-symbols-outlined text-sm">check</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-900 dark:text-white">Pedido confirmado</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(order.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    {order.status !== 'pending' && (
                                                        <div className="flex items-center gap-3">
                                                            <div className={`flex size-8 items-center justify-center rounded-full ${
                                                                order.status === 'shipped' || order.status === 'delivered' 
                                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20' 
                                                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                                            }`}>
                                                                <span className="material-symbols-outlined text-sm">
                                                                    {order.status === 'shipped' || order.status === 'delivered' ? 'check' : 'schedule'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900 dark:text-white">En tránsito</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {order.status === 'shipped' ? 'Enviado' : 'Preparando envío'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center">
                                        <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 mx-auto mb-4">
                                            <span className="material-symbols-outlined text-2xl">local_shipping</span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                            No hay envíos activos
                                        </h4>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Cuando tengas pedidos en camino, aparecerán aquí con información de seguimiento.
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        {/* Chat Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Asistente Virtual</h3>
                            </div>
                            <div className="p-6">
                                <div className="text-center">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                                        <span className="material-symbols-outlined text-2xl">smart_toy</span>
                                    </div>
                                    <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                                        ¿Necesitas ayuda?
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        Nuestro asistente está disponible 24/7 para ayudarte con tus pedidos y preguntas.
                                    </p>
                                    <Link
                                        href={`/store/${organization.slug}/chat`}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                                    >
                                        <span className="material-symbols-outlined text-lg">chat</span>
                                        Iniciar Chat
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Help Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">¿Necesitas ayuda?</h3>
                            <ul className="space-y-3">
                                <li>
                                    <Link href={`/store/${organization.slug}/chat`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">undo</span>
                                        Política de devoluciones
                                    </Link>
                                </li>
                                <li>
                                    <Link href={`/store/${organization.slug}/chat`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">local_shipping</span>
                                        Información de envíos
                                    </Link>
                                </li>
                                <li>
                                    <Link href={`/store/${organization.slug}/chat`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">question_answer</span>
                                        Preguntas frecuentes
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>

            {/* Floating Chat Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <Link
                    href={`/store/${organization.slug}/chat`}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:shadow-blue-900/50"
                >
                    <span className="material-symbols-outlined text-3xl">forum</span>
                </Link>
            </div>
        </div>
    )
}