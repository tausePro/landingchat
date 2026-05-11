"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Plan } from "@/types"
import { getPlans } from "@/app/admin/plans/actions"
import { assignPlanToOrganization, updateSubscriptionPlan } from "../actions"

interface AssignPlanDialogProps {
    organizationId: string
    organizationName: string
    /**
     * Si viene, el dialog cambia el plan de una sub existente
     * (usa `updateSubscriptionPlan`). Si no viene, hace upsert por organización
     * (usa `assignPlanToOrganization`).
     */
    subscriptionId?: string
    currentPlanId?: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Dialog del superadmin para asignar o cambiar el plan de una organización.
 *
 * Dos modos:
 * - `change` (cuando `subscriptionId` se pasa): cambia plan de una sub existente.
 * - `assign` (sin `subscriptionId`): upsert por organización — crea sub activa
 *   si no hay, o actualiza la activa si sí.
 *
 * Usado desde:
 * - `admin/subscriptions` (modo change): botón por row en la lista.
 * - `admin/organizations` (modo assign): dropdown de acciones por org.
 */
export function AssignPlanDialog({
    organizationId,
    organizationName,
    subscriptionId,
    currentPlanId,
    open,
    onOpenChange,
    onSuccess,
}: AssignPlanDialogProps) {
    // `null` = aún no se han cargado; `[]` = cargados pero vacíos; array con items = cargados.
    // Evita un state `loadingPlans` que requeriría setState síncrono en el useEffect body.
    const [plans, setPlans] = useState<Plan[] | null>(null)
    const [selectedPlanId, setSelectedPlanId] = useState<string>("")
    const [submitting, setSubmitting] = useState(false)
    const loadingPlans = plans === null

    const mode = subscriptionId ? "change" : "assign"
    const title = mode === "change" ? "Cambiar plan" : "Asignar plan"
    const cta = mode === "change" ? "Cambiar plan" : "Asignar plan"

    // Cargar planes al abrir el dialog. El estado de carga se deriva de `plans === null`.
    useEffect(() => {
        if (!open) return

        let cancelled = false
        getPlans().then(result => {
            if (cancelled) return
            if (result.success) {
                setPlans(result.data)
                // Preseleccionar plan actual si existe y está en la lista
                if (currentPlanId && result.data.some(p => p.id === currentPlanId)) {
                    setSelectedPlanId(currentPlanId)
                } else if (result.data.length > 0) {
                    setSelectedPlanId(result.data[0].id)
                }
            } else {
                toast.error(result.error)
                setPlans([])
            }
        })

        return () => {
            cancelled = true
        }
    }, [open, currentPlanId])

    const handleSubmit = async () => {
        if (!selectedPlanId) {
            toast.error("Selecciona un plan")
            return
        }

        // Confirmación si el plan no cambia
        if (selectedPlanId === currentPlanId) {
            toast.info("La organización ya tiene este plan")
            return
        }

        setSubmitting(true)
        const result = mode === "change" && subscriptionId
            ? await updateSubscriptionPlan(subscriptionId, selectedPlanId)
            : await assignPlanToOrganization(organizationId, selectedPlanId)
        setSubmitting(false)

        if (result.success) {
            const planName = plans?.find(p => p.id === selectedPlanId)?.name || "nuevo plan"
            toast.success(`Plan "${planName}" asignado a ${organizationName}`)
            onSuccess?.()
            onOpenChange(false)
        } else {
            toast.error(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {mode === "change"
                            ? `Cambia el plan de la suscripción de ${organizationName}.`
                            : `Asigna un plan a ${organizationName}. Si ya tiene suscripción activa, se actualizará; si no, se creará una nueva.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="plan-select">Plan</Label>
                        {plans === null ? (
                            <div className="text-sm text-muted-foreground">Cargando planes...</div>
                        ) : plans.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                                No hay planes disponibles. Crea uno en{" "}
                                <a href="/admin/plans" className="underline">
                                    /admin/plans
                                </a>
                                .
                            </div>
                        ) : (
                            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                <SelectTrigger id="plan-select" className="w-full">
                                    <SelectValue placeholder="Selecciona un plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {plans.map(plan => (
                                        <SelectItem key={plan.id} value={plan.id}>
                                            <div className="flex w-full items-center justify-between gap-3">
                                                <span>{plan.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {plan.price > 0
                                                        ? new Intl.NumberFormat("es-CO", {
                                                            style: "currency",
                                                            currency: plan.currency || "COP",
                                                            minimumFractionDigits: 0,
                                                        }).format(plan.price)
                                                        : "Gratis"}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {currentPlanId && plans && (
                        <p className="text-xs text-muted-foreground">
                            Plan actual:{" "}
                            <strong>
                                {plans.find(p => p.id === currentPlanId)?.name || "Desconocido"}
                            </strong>
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || loadingPlans || !plans || plans.length === 0}
                    >
                        {submitting ? "Guardando..." : cta}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
