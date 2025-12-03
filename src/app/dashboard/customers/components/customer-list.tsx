"use client"

import { Customer } from "../actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface CustomerListProps {
    customers: Customer[]
    isLoading?: boolean
}

export function CustomerList({ customers, isLoading }: CustomerListProps) {
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
                    Tus clientes aparecerán aquí cuando realicen compras o inicien conversaciones.
                </p>
                <Button>
                    <span className="material-symbols-outlined mr-2">add</span>
                    Nuevo Cliente
                </Button>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cliente</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Contacto</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Categoría</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Canal</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Compras</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {customers.map((customer) => (
                            <tr key={customer.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <td className="p-4 align-middle">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{customer.full_name?.substring(0, 2).toUpperCase() || "CL"}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{customer.full_name || "Cliente Sin Nombre"}</span>
                                            <span className="text-xs text-muted-foreground">Registrado: {new Date(customer.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="flex flex-col gap-1">
                                        {customer.phone && (
                                            <div className="flex items-center gap-1 text-xs">
                                                <span className="material-symbols-outlined text-[14px] text-green-600">call</span>
                                                {customer.phone}
                                            </div>
                                        )}
                                        {customer.email && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <span className="material-symbols-outlined text-[14px]">mail</span>
                                                {customer.email}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 align-middle">
                                    {customer.category ? (
                                        <Badge variant="secondary" className={getCategoryColor(customer.category)}>
                                            {customer.category}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                </td>
                                <td className="p-4 align-middle">
                                    {customer.acquisition_channel && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs capitalize">{customer.acquisition_channel}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(customer.total_spent || 0)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{customer.total_orders || 0} órdenes</span>
                                    </div>
                                </td>
                                <td className="p-4 align-middle text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menú</span>
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(customer.id)}>
                                                Copiar ID
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                                            <DropdownMenuItem>Editar detalles</DropdownMenuItem>
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
    switch (category?.toLowerCase()) {
        case 'vip': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
        case 'nuevo': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
        case 'riesgo': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
        default: return ''
    }
}
