import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getChatDetail } from "../actions"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import { ChatMessages } from "./chat-messages"

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

function getStatusColor(status: string) {
    switch (status?.toLowerCase()) {
        case 'active':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
        case 'closed':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
}

function getChannelIcon(channel: string | null) {
    switch (channel?.toLowerCase()) {
        case 'whatsapp':
            return { icon: 'chat', color: 'text-green-500', label: 'WhatsApp' }
        case 'instagram':
            return { icon: 'photo_camera', color: 'text-pink-500', label: 'Instagram' }
        default:
            return { icon: 'language', color: 'text-blue-500', label: 'Web' }
    }
}

function getCategoryColor(category: string | null) {
    const cat = category?.toLowerCase() || ''
    if (cat.includes('vip')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (cat === 'recurrente') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (cat === 'nuevo') return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

interface ChatDetailPageProps {
    params: Promise<{ id: string }>
}

export default async function ChatDetailPage({ params }: ChatDetailPageProps) {
    const { id } = await params
    const result = await getChatDetail(id)

    if (!result.success) {
        return (
            <DashboardLayout>
                <div className="flex flex-col gap-6 p-8">
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold">Chat</h1>
                        <p className="text-destructive">Error: {result.error}</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    const chat = result.data
    const channelInfo = getChannelIcon(chat.channel)

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-80px)]">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark">
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/dashboard/chats" 
                            className="p-2 rounded-lg hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                        >
                            <span className="material-symbols-outlined text-text-light-secondary dark:text-text-dark-secondary">arrow_back</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/20 rounded-full size-12 flex items-center justify-center">
                                <span className="text-primary font-bold text-lg">
                                    {chat.customer_name?.substring(0, 2).toUpperCase() || "AN"}
                                </span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-text-light-primary dark:text-text-dark-primary">
                                    {chat.customer_name || "Anónimo"}
                                </h1>
                                <div className="flex items-center gap-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                    <span className={`material-symbols-outlined text-[16px] ${channelInfo.color}`}>{channelInfo.icon}</span>
                                    <span>{channelInfo.label}</span>
                                    <span>•</span>
                                    <span>{format(new Date(chat.created_at), "d MMM yyyy, HH:mm", { locale: es })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(chat.status)}`}>
                            {chat.status === 'active' ? 'Activo' : 'Cerrado'}
                        </span>
                    </div>
                </div>

                {/* Main Content - 3 Column Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Customer Info */}
                    <div className="w-72 border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-y-auto">
                        <div className="p-4 space-y-6">
                            {/* Customer Section */}
                            <div>
                                <h3 className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                                    Cliente
                                </h3>
                                {chat.customer ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px] text-text-light-secondary dark:text-text-dark-secondary">person</span>
                                            <span className="text-sm text-text-light-primary dark:text-text-dark-primary font-medium">
                                                {chat.customer.full_name || "Sin nombre"}
                                            </span>
                                        </div>
                                        {chat.customer.phone && (
                                            <a 
                                                href={`https://wa.me/${chat.customer.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                className="flex items-center gap-2 text-green-600 hover:underline"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">call</span>
                                                <span className="text-sm">{chat.customer.phone}</span>
                                            </a>
                                        )}
                                        {chat.customer.email && (
                                            <a 
                                                href={`mailto:${chat.customer.email}`}
                                                className="flex items-center gap-2 text-text-light-secondary dark:text-text-dark-secondary hover:underline"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">mail</span>
                                                <span className="text-sm">{chat.customer.email}</span>
                                            </a>
                                        )}
                                        {chat.customer.address?.city && (
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px] text-text-light-secondary dark:text-text-dark-secondary">location_on</span>
                                                <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                                    {chat.customer.address.city}
                                                    {chat.customer.address.neighborhood && `, ${chat.customer.address.neighborhood}`}
                                                </span>
                                            </div>
                                        )}
                                        {chat.customer.category && (
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px] text-text-light-secondary dark:text-text-dark-secondary">label</span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(chat.customer.category)}`}>
                                                    {chat.customer.category}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                                        Cliente no identificado
                                    </p>
                                )}
                            </div>

                            {/* Stats Section */}
                            {chat.customer && (
                                <div>
                                    <h3 className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                                        Historial
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-background-light dark:bg-background-dark rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">
                                                {chat.customer.total_orders}
                                            </p>
                                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Órdenes</p>
                                        </div>
                                        <div className="bg-background-light dark:bg-background-dark rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">
                                                {formatCurrency(chat.customer.total_spent)}
                                            </p>
                                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Total</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Orders from this chat */}
                            {chat.orders.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                                        Órdenes del Chat
                                    </h3>
                                    <div className="space-y-2">
                                        {chat.orders.map((order) => (
                                            <Link
                                                key={order.id}
                                                href={`/dashboard/orders/${order.id}`}
                                                className="flex items-center justify-between p-2 rounded-lg bg-background-light dark:bg-background-dark hover:bg-primary/10 transition-colors"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                                        #{order.id.substring(0, 8)}
                                                    </p>
                                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary capitalize">
                                                        {order.status}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-semibold text-green-600">
                                                    {formatCurrency(order.total)}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Cart */}
                            {chat.cart && chat.cart.items.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                                        Carrito Activo
                                    </h3>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-text-light-primary dark:text-text-dark-primary">
                                                {chat.cart.items.length} productos
                                            </span>
                                            <span className="text-sm font-semibold text-orange-600">
                                                {formatCurrency(chat.cart.total)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                            Pendiente de checkout
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center - Chat Messages */}
                    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
                        <ChatMessages chatId={id} initialMessages={chat.messages} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
