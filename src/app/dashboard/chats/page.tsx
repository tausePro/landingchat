import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getChatsWithDetails, type ChatWithDetails } from "./actions"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

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
        case 'pending':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
}

function getStatusLabel(status: string) {
    switch (status?.toLowerCase()) {
        case 'active':
            return 'Activo'
        case 'closed':
            return 'Cerrado'
        case 'pending':
            return 'Pendiente'
        default:
            return status || 'Desconocido'
    }
}

function getChannelIcon(channel: string | null) {
    switch (channel?.toLowerCase()) {
        case 'whatsapp':
            return <span className="text-green-500 text-xs font-bold">WA</span>
        case 'instagram':
            return <span className="text-pink-500 text-xs font-bold">IG</span>
        case 'web':
        default:
            return <span className="text-blue-500 text-xs font-bold">WEB</span>
    }
}

function truncateMessage(message: string | null, maxLength: number = 50) {
    if (!message) return "Sin mensajes"
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + "..."
}

export default async function ChatsPage() {
    const result = await getChatsWithDetails()

    if (!result.success) {
        return (
            <DashboardLayout>
                <div className="flex flex-col gap-6 p-8">
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">Conversaciones</h1>
                        <p className="text-destructive">Error: {result.error}</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    const { chats, total } = result.data

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6 p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                            Conversaciones ({total})
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">
                            Gestiona las conversaciones con tus clientes desde todos los canales.
                        </p>
                    </div>
                    {/* Nuevo Chat deshabilitado temporalmente
                    <Button>
                        <span className="material-symbols-outlined mr-2">add</span>
                        Nuevo Chat
                    </Button>
                    */}
                </div>

                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                                <tr>
                                    <th className="px-6 py-3" scope="col">Cliente</th>
                                    <th className="px-6 py-3" scope="col">Último Mensaje</th>
                                    <th className="px-6 py-3" scope="col">Canal</th>
                                    <th className="px-6 py-3" scope="col">Mensajes</th>
                                    <th className="px-6 py-3" scope="col">Conversión</th>
                                    <th className="px-6 py-3" scope="col">Estado</th>
                                    <th className="px-6 py-3" scope="col">Última Actividad</th>
                                    <th className="px-6 py-3 text-right" scope="col">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chats.length === 0 ? (
                                    <tr className="border-b border-border-light dark:border-border-dark">
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="bg-primary/10 p-4 rounded-full mb-4">
                                                    <span className="material-symbols-outlined text-4xl text-primary">chat</span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-2">
                                                    No hay conversaciones aún
                                                </h3>
                                                <p className="text-text-light-secondary dark:text-text-dark-secondary max-w-sm">
                                                    Las conversaciones aparecerán aquí cuando los clientes inicien un chat.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    chats.map((chat) => (
                                        <tr key={chat.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center shrink-0">
                                                        <span className="text-primary font-bold text-sm">
                                                            {chat.customer_name?.substring(0, 2).toUpperCase() || "AN"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-text-light-primary dark:text-text-dark-primary">
                                                            {chat.customer_name || "Anónimo"}
                                                        </span>
                                                        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                                            ID: {chat.id.substring(0, 8)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-text-light-secondary dark:text-text-dark-secondary text-sm">
                                                    {truncateMessage(chat.last_message)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    {getChannelIcon(chat.channel)}
                                                    <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary capitalize">
                                                        {chat.channel || 'web'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[16px] text-text-light-secondary dark:text-text-dark-secondary">chat_bubble</span>
                                                    <span className="text-text-light-primary dark:text-text-dark-primary font-medium">
                                                        {chat.message_count}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {chat.has_order ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-green-600 dark:text-green-400 font-semibold text-sm flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                            {formatCurrency(chat.order_total || 0)}
                                                        </span>
                                                        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary capitalize">
                                                            {chat.order_status}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-text-light-secondary dark:text-text-dark-secondary text-xs">
                                                        Sin orden
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(chat.status)}`}>
                                                    {getStatusLabel(chat.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-text-light-secondary dark:text-text-dark-secondary">
                                                {chat.last_message_at
                                                    ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true, locale: es })
                                                    : formatDistanceToNow(new Date(chat.created_at), { addSuffix: true, locale: es })
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link 
                                                    href={`/dashboard/chats/${chat.id}`} 
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    Ver Chat
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
