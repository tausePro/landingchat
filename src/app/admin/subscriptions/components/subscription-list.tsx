"use client"

import { useState } from "react"
import { type SubscriptionWithOrg, type SubscriptionStatus } from "@/types"
import { updateSubscriptionStatus } from "../actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

interface SubscriptionListProps {
    subscriptions: SubscriptionWithOrg[]
    onFilterChange: (status: SubscriptionStatus | "all") => void
    currentFilter: SubscriptionStatus | "all"
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    active: "Activa",
    cancelled: "Cancelada",
    past_due: "Vencida",
    trialing: "Prueba",
    incomplete: "Incompleta",
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    past_due: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    trialing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    incomplete: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
}

export function SubscriptionList({
    subscriptions,
    onFilterChange,
    currentFilter,
}: SubscriptionListProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), "d MMM yyyy", { locale: es })
    }

    const formatPrice = (price: number, currency = "COP") => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
        }).format(price)
    }

    const handleStatusChange = async (id: string, newStatus: SubscriptionStatus) => {
        setLoading(id)
        const result = await updateSubscriptionStatus(id, newStatus)
        setLoading(null)

        if (result.success) {
            toast.success("Estado actualizado")
        } else {
            toast.error(result.error)
        }
    }

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex items-center gap-4">
                <Select
                    value={currentFilter}
                    onValueChange={(value) => onFilterChange(value as SubscriptionStatus | "all")}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="active">Activas</SelectItem>
                        <SelectItem value="trialing">En prueba</SelectItem>
                        <SelectItem value="past_due">Vencidas</SelectItem>
                        <SelectItem value="cancelled">Canceladas</SelectItem>
                        <SelectItem value="incomplete">Incompletas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Tabla */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Organización</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Período Actual</TableHead>
                            <TableHead>Próximo Cobro</TableHead>
                            <TableHead className="w-[150px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subscriptions.map((sub) => (
                            <TableRow key={sub.id}>
                                <TableCell>
                                    <div>
                                        <p className="font-medium">
                                            {sub.organization?.name || "Sin organización"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {sub.organization?.subdomain}.landingchat.co
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div>
                                        <p className="font-medium">{sub.plan?.name || "Sin plan"}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatPrice(sub.plan?.price || 0)}/mes
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={STATUS_COLORS[sub.status]}>
                                        {STATUS_LABELS[sub.status]}
                                    </Badge>
                                    {sub.cancel_at_period_end && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Cancela al final del período
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <p className="text-sm">
                                        {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <p className="text-sm font-medium">
                                        {formatDate(sub.current_period_end)}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={sub.status}
                                        onValueChange={(value) =>
                                            handleStatusChange(sub.id, value as SubscriptionStatus)
                                        }
                                        disabled={loading === sub.id}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Activar</SelectItem>
                                            <SelectItem value="past_due">Marcar vencida</SelectItem>
                                            <SelectItem value="cancelled">Cancelar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                        {subscriptions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No hay suscripciones
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
