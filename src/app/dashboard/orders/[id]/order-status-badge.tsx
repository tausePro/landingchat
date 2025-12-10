"use client"

interface OrderStatusBadgeProps {
    status: string
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'delivered':
            case 'completed':
            case 'entregado':
                return {
                    label: 'Entregado',
                    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
                    dotClassName: 'bg-green-500'
                }
            case 'confirmed':
            case 'confirmado':
            case 'paid':
            case 'pagado':
                return {
                    label: 'Confirmado',
                    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
                    dotClassName: 'bg-emerald-500'
                }
            case 'enviado':
            case 'shipped':
                return {
                    label: 'Enviado',
                    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                    dotClassName: 'bg-blue-500'
                }
            case 'processing':
            case 'procesando':
                return {
                    label: 'Procesando',
                    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
                    dotClassName: 'bg-yellow-500'
                }
            case 'pending':
            case 'pendiente':
                return {
                    label: 'Pendiente',
                    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
                    dotClassName: 'bg-orange-500'
                }
            case 'cancelled':
            case 'cancelado':
                return {
                    label: 'Cancelado',
                    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
                    dotClassName: 'bg-red-500'
                }
            case 'refunded':
            case 'reembolsado':
                return {
                    label: 'Reembolsado',
                    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
                    dotClassName: 'bg-purple-500'
                }
            default:
                return {
                    label: status.charAt(0).toUpperCase() + status.slice(1),
                    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
                    dotClassName: 'bg-gray-500'
                }
        }
    }

    const config = getStatusConfig(status)

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.className}`}>
            <span className={`size-2 rounded-full ${config.dotClassName} animate-pulse`}></span>
            {config.label}
        </span>
    )
}
