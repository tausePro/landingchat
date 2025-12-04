"use client"

import { useState, useEffect } from "react"
import { type Plan } from "@/types"
import { getPlans } from "./actions"
import { PlanList } from "./components/plan-list"
import { PlanForm } from "./components/plan-form"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

    const loadPlans = async () => {
        setLoading(true)
        const result = await getPlans()
        setLoading(false)

        if (result.success) {
            setPlans(result.data)
        } else {
            toast.error(result.error)
        }
    }

    useEffect(() => {
        loadPlans()
    }, [])

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan)
        setFormOpen(true)
    }

    const handleCloseForm = () => {
        setFormOpen(false)
        setEditingPlan(null)
        loadPlans() // Recargar lista después de cerrar
    }

    const handleNewPlan = () => {
        setEditingPlan(null)
        setFormOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Planes de Suscripción</h2>
                    <p className="text-muted-foreground">
                        Gestiona los planes disponibles para las organizaciones.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={loadPlans} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={handleNewPlan}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Plan
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <PlanList plans={plans} onEdit={handleEdit} />
            )}

            <PlanForm
                plan={editingPlan}
                open={formOpen}
                onClose={handleCloseForm}
            />
        </div>
    )
}
