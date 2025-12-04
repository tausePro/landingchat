"use client"

import { useState, useEffect } from "react"
import { type Plan } from "@/types"
import { getPlans } from "./actions"
import { PlanList } from "./components/plan-list"
import { PlanForm } from "./components/plan-form"
import { Button } from "@/components/ui/button"
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
        loadPlans()
    }

    const handleNewPlan = () => {
        setEditingPlan(null)
        setFormOpen(true)
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
                        Gestión de Planes de Suscripción
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                        Crea, edita y gestiona los planes de suscripción globales.
                    </p>
                </div>
                <Button
                    onClick={handleNewPlan}
                    className="flex items-center justify-center gap-2 min-w-[84px] cursor-pointer rounded-lg h-10 px-4 bg-blue-600 text-white text-sm font-bold leading-normal tracking-wide shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    <span className="truncate">Crear Nuevo Plan</span>
                </Button>
            </div>

            {/* Content */}
            <div className="py-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <span>Cargando planes...</span>
                        </div>
                    </div>
                ) : (
                    <PlanList plans={plans} onEdit={handleEdit} />
                )}
            </div>

            {/* Form Modal */}
            <PlanForm
                plan={editingPlan}
                open={formOpen}
                onClose={handleCloseForm}
            />
        </div>
    )
}
