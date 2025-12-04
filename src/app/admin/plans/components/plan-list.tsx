"use client"

import { useState } from "react"
import { type Plan } from "@/types"
import { togglePlanStatus, deletePlan } from "../actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface PlanListProps {
    plans: Plan[]
    onEdit: (plan: Plan) => void
}

export function PlanList({ plans, onEdit }: PlanListProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(price)
    }

    const handleToggleStatus = async (id: string) => {
        setLoading(id)
        const result = await togglePlanStatus(id)
        setLoading(null)

        if (result.success) {
            toast.success(result.data.is_active ? "Plan activado" : "Plan desactivado")
        } else {
            toast.error(result.error)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el plan "${name}"?`)) return

        setLoading(id)
        const result = await deletePlan(id)
        setLoading(null)

        if (result.success) {
            toast.success("Plan eliminado")
        } else {
            toast.error(result.error)
        }
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Límites</TableHead>
                        <TableHead>Features</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {plans.map((plan) => (
                        <TableRow key={plan.id}>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{plan.name}</p>
                                    <p className="text-sm text-muted-foreground">{plan.slug}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{formatPrice(plan.price, plan.currency)}</p>
                                    <p className="text-sm text-muted-foreground">/{plan.billing_period === 'monthly' ? 'mes' : 'año'}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm space-y-1">
                                    <p>{plan.max_products} productos</p>
                                    <p>{plan.max_agents} agentes</p>
                                    <p>{plan.max_monthly_conversations.toLocaleString()} conv/mes</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {Object.entries(plan.features).map(([key, value]) => (
                                        <Badge
                                            key={key}
                                            variant={value ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {key}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={plan.is_active ? "default" : "secondary"}>
                                    {plan.is_active ? "Activo" : "Inactivo"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={loading === plan.id}
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(plan)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleToggleStatus(plan.id)}>
                                            <Power className="mr-2 h-4 w-4" />
                                            {plan.is_active ? "Desactivar" : "Activar"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(plan.id, plan.name)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {plans.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No hay planes configurados
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
