"use client"

import { Customer, deleteCustomer } from "../actions"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface CustomerListProps {
    customers: Customer[]
    isLoading?: boolean
}

export function CustomerList({ customers, isLoading }: CustomerListProps) {
    const router = useRouter()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleWhatsApp = (phone: string | null) => {
        if (!phone) return
        const cleanPhone = phone.replace(/\D/g, '')
        window.open(`https://wa.me/${cleanPhone}`, '_blank')
    }

    const handleEmail = (email: string | null) => {
        if (!email) return
        window.open(`mailto:${email}`, '_blank')
    }

    const handleDelete = async (customerId: string, customerName: string) => {
        if (!confirm(`¿Estás seguro de eliminar a ${customerName}? Esta acción no se puede deshacer.`)) {
            return
        }
        setDeletingId(customerId)
        const result = await deleteCustomer(customerId)
        if (result.success) {
            toast.success('Cliente eliminado correctamente')
            router.refresh()
        } else {
            toast.error(result.error || 'Error al eliminar cliente')
        }
        setDeletingId(null)
    }

    if (isLoading) {
        return <div className="p-8 text-center">Cargando clientes...</div>
    }

    if (customers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                    <span className="material-symbols-outlined text-4xl text-slate-400">group</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">No tienes clientes aún</h3>
                <p className="text-muted-foreground max-w-sm mb-6">
                    Importa tu base de datos o espera a que lleguen desde el chat.
                </p>
                <Button>
                    <span className="material-symbols-outlined mr-2">upload</span>
                    Importar Clientes
                </Button>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
            <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                        <tr>
                            <th className="px-6 py-3" scope="col">Cliente</th>
                            <th className="px-6 py-3" scope="col">Contacto</th>
                            <th className="px-6 py-3" scope="col">Ubicación</th>
                            <th className="px-6 py-3" scope="col">Categoría</th>
                            <th className="px-6 py-3" scope="col">Compras</th>
                            <th className="px-6 py-3" scope="col">Última Actividad</th>
                            <th className="px-6 py-3 text-right" scope="col">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((customer) => (
                            <tr key={customer.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center shrink-0">
                                            <span className="text-primary font-bold text-sm">
                                                {customer.full_name?.substring(0, 2).toUpperCase() || "CL"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-text-light-primary dark:text-text-dark-primary">{customer.full_name || "Cliente Sin Nombre"}</span>
                                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">ID: {customer.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {customer.phone && (
                                            <div 
                                                className="flex items-center gap-1.5 text-xs cursor-pointer hover:underline text-green-600" 
                                                onClick={() => handleWhatsApp(customer.phone)}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">call</span>
                                                {customer.phone}
                                            </div>
                                        )}
                                        {customer.email && (
                                            <div 
                                                className="flex items-center gap-1.5 text-xs text-text-light-secondary dark:text-text-dark-secondary cursor-pointer hover:underline"
                                                onClick={() => handleEmail(customer.email)}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">mail</span>
                                                {customer.email}
                                            </div>
                                        )}
                                        {!customer.phone && !customer.email && (
                                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">-</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-text-light-primary dark:text-text-dark-primary">{customer.address?.city || "-"}</span>
                                        {customer.address?.neighborhood && (
                                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">{customer.address.neighborhood}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {customer.category ? (
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(customer.category)}`}>
                                            {getCategoryLabel(customer.category)}
                                        </span>
                                    ) : (
                                        <span className="text-text-light-secondary dark:text-text-dark-secondary text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(customer.total_spent || 0)}
                                        </span>
                                        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">{customer.total_orders || 0} órdenes</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-text-light-secondary dark:text-text-dark-secondary">
                                    {customer.last_interaction_at
                                        ? formatDistanceToNow(new Date(customer.last_interaction_at), { addSuffix: true, locale: es })
                                        : formatDistanceToNow(new Date(customer.created_at), { addSuffix: true, locale: es })
                                    }
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={deletingId === customer.id}>
                                                <span className="sr-only">Abrir menú</span>
                                                <span className="material-symbols-outlined">{deletingId === customer.id ? 'hourglass_empty' : 'more_vert'}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(customer.id)}>
                                                <span className="material-symbols-outlined text-[16px] mr-2">content_copy</span>
                                                Copiar ID
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {customer.phone && (
                                                <DropdownMenuItem onClick={() => handleWhatsApp(customer.phone)}>
                                                    <span className="material-symbols-outlined text-[16px] mr-2 text-green-600">chat</span>
                                                    WhatsApp
                                                </DropdownMenuItem>
                                            )}
                                            {customer.email && (
                                                <DropdownMenuItem onClick={() => handleEmail(customer.email)}>
                                                    <span className="material-symbols-outlined text-[16px] mr-2">mail</span>
                                                    Enviar Email
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                className="text-red-600"
                                                onClick={() => handleDelete(customer.id, customer.full_name || 'este cliente')}
                                            >
                                                <span className="material-symbols-outlined text-[16px] mr-2">delete</span>
                                                Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function getCategoryColor(category: string) {
    const cat = category?.toLowerCase() || ''
    if (cat.includes('vip') || cat.includes('fieles 4')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (cat.includes('fieles 3')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
    if (cat.includes('fieles 2') || cat === 'recurrente') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (cat.includes('fieles 1')) return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    if (cat.includes('recuperar') || cat === 'riesgo' || cat === 'inactivo') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    if (cat === 'nuevo') return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

function getCategoryLabel(category: string) {
    const cat = category?.toLowerCase() || ''
    if (cat.includes('vip') || cat.includes('fieles 4')) return 'VIP'
    if (cat.includes('fieles 3')) return 'Fieles 3'
    if (cat.includes('fieles 2')) return 'Fieles 2'
    if (cat.includes('fieles 1')) return 'Fieles 1'
    if (cat === 'recurrente') return 'Recurrente'
    if (cat.includes('recuperar') || cat === 'riesgo') return 'A Recuperar'
    if (cat === 'inactivo') return 'Inactivo'
    if (cat === 'nuevo') return 'Nuevo'
    return category.charAt(0).toUpperCase() + category.slice(1)
}
