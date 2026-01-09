"use client"

import { useState } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface Customer {
    id: string
    full_name: string
    email?: string
    phone?: string
    document_type?: string
    document_number?: string
    person_type?: string
    business_name?: string
    created_at: string
    address?: {
        city?: string
        neighborhood?: string
        address?: string
    }
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
    phone?: string
    logo_url?: string
    settings?: {
        branding?: {
            primaryColor?: string
        }
    }
}

interface Chat {
    id: string
    status: string
    created_at: string
    updated_at?: string
    last_message?: string
}

interface ProfileViewProps {
    customer: Customer
    orders: Order[]
    organization: Organization
    chats?: Chat[]
}

export function ProfileView({ customer, orders, organization, chats = [] }: ProfileViewProps) {
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
            {/* Header - Consistente con el resto del sitio */}
            <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Link href={`/store/${organization.slug}`} className="flex items-center gap-3 cursor-pointer">
                        {organization.logo_url ? (
                            <img
                                src={organization.logo_url}
                                alt={organization.name}
                                className="h-10 w-auto object-contain max-w-[120px] md:max-w-[150px]"
                            />
                        ) : (
                            <div 
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-lg" 
                                style={{ backgroundColor: organization.settings?.branding?.primaryColor || '#3B82F6' }}
                            >
                                {organization.name.substring(0, 1)}
                            </div>
                        )}
                        <span className="text-lg md:text-xl font-bold tracking-tight">{organization.name}</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                        <Link href={`/store/${organization.slug}`} className="hover:text-primary transition-colors">Inicio</Link>
                        <Link href={`/store/${organization.slug}/productos`} className="hover:text-primary transition-colors">Productos</Link>
                        <span className="text-primary font-semibold">Mi Cuenta</span>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link 
                            href={`/store/${organization.slug}`} 
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            Volver a la Tienda
                        </Link>
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
                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                <span className="material-symbols-outlined text-sm">smartphone</span>
                                                {customer.phone}
                                            </span>
                                        )}
                                        {customer.email && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                <span className="material-symbols-outlined text-sm">mail</span>
                                                {customer.email}
                                            </span>
                                        )}
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
                                        href={`/chat/${organization.slug}`}
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
                        {/* Chats Recientes */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chats Recientes</h3>
                                {chats.length > 0 && (
                                    <Link href={`/chat/${organization.slug}`} className="text-xs font-medium text-primary hover:underline">
                                        Ver todos
                                    </Link>
                                )}
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                                {chats.length > 0 ? (
                                    chats.slice(0, 3).map((chat) => (
                                        <Link
                                            key={chat.id}
                                            href={`/chat/${organization.slug}`}
                                            className="group flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex-shrink-0">
                                                <div className={`flex size-10 items-center justify-center rounded-full ${
                                                    chat.status === 'active' 
                                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    <span className="material-symbols-outlined text-xl">
                                                        {chat.status === 'active' ? 'support_agent' : 'smart_toy'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {chat.status === 'active' ? 'Conversación Activa' : 'Bot Asistente'}
                                                    </p>
                                                    <span className="text-xs text-slate-400">
                                                        {formatDate(chat.updated_at || chat.created_at)}
                                                    </span>
                                                </div>
                                                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                                                    {chat.status === 'active' ? 'Haz clic para continuar...' : '¿En qué más puedo ayudarte?'}
                                                </p>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="text-center py-4">
                                        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 mx-auto mb-3">
                                            <span className="material-symbols-outlined">chat_bubble</span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Aún no tienes conversaciones
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                                <Link
                                    href={`/chat/${organization.slug}`}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                    <span className="material-symbols-outlined text-lg">chat</span>
                                    {chats.length > 0 ? 'Continuar Chat' : 'Iniciar Chat'}
                                </Link>
                            </div>
                        </div>

                        {/* Help Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">¿Necesitas ayuda?</h3>
                            <ul className="space-y-3">
                                <li>
                                    <Link href={`/chat/${organization.slug}?context=devoluciones`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">undo</span>
                                        Política de devoluciones
                                    </Link>
                                </li>
                                <li>
                                    <Link href={`/chat/${organization.slug}?context=envios`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">local_shipping</span>
                                        Información de envíos
                                    </Link>
                                </li>
                                <li>
                                    <Link href={`/chat/${organization.slug}?context=preguntas`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-primary">
                                        <span className="material-symbols-outlined text-lg">question_answer</span>
                                        Preguntas frecuentes
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>

            {/* Floating WhatsApp/Chat Button */}
            <div className="fixed bottom-6 right-6 z-50">
                {organization.phone ? (
                    <a
                        href={`https://wa.me/${organization.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi pedido`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-300"
                        aria-label="Contactar por WhatsApp"
                    >
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                    </a>
                ) : (
                    <Link
                        href={`/chat/${organization.slug}`}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
                        aria-label="Iniciar chat"
                    >
                        <span className="material-symbols-outlined text-3xl">chat</span>
                    </Link>
                )}
            </div>
        </div>
    )
}