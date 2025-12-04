"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
    type ActionResult,
    success,
    failure,
    type Plan,
    type CreatePlanInput,
    type UpdatePlanInput,
    CreatePlanInputSchema,
    UpdatePlanInputSchema,
    deserializePlanFromDb,
    serializePlanForDb,
} from "@/types"

/**
 * Obtiene todos los planes (activos e inactivos)
 */
export async function getPlans(): Promise<ActionResult<Plan[]>> {
    try {
        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("plans")
            .select("*")
            .order("price", { ascending: true })

        if (error) {
            console.error("Error fetching plans:", error)
            return failure("Error al obtener los planes")
        }

        const plans = data.map((row) => deserializePlanFromDb(row))
        return success(plans)
    } catch (error) {
        console.error("Error in getPlans:", error)
        return failure("Error inesperado al obtener los planes")
    }
}

/**
 * Obtiene un plan por su ID
 */
export async function getPlanById(id: string): Promise<ActionResult<Plan>> {
    try {
        const supabase = await createServiceClient()

        const { data, error } = await supabase
            .from("plans")
            .select("*")
            .eq("id", id)
            .single()

        if (error) {
            console.error("Error fetching plan:", error)
            return failure("Plan no encontrado")
        }

        const plan = deserializePlanFromDb(data)
        return success(plan)
    } catch (error) {
        console.error("Error in getPlanById:", error)
        return failure("Error inesperado al obtener el plan")
    }
}

/**
 * Crea un nuevo plan
 */
export async function createPlan(input: CreatePlanInput): Promise<ActionResult<Plan>> {
    try {
        // Validar input con Zod
        const validation = CreatePlanInputSchema.safeParse(input)
        if (!validation.success) {
            const errorMessage = validation.error.issues[0]?.message || "Datos inválidos"
            return failure(errorMessage)
        }

        const supabase = await createServiceClient()

        // Verificar que el nombre y slug sean únicos
        const { data: existing } = await supabase
            .from("plans")
            .select("id")
            .or(`name.eq.${validation.data.name},slug.eq.${validation.data.slug}`)
            .limit(1)

        if (existing && existing.length > 0) {
            return failure("Ya existe un plan con ese nombre o slug")
        }

        // Serializar y crear
        const planData = serializePlanForDb(validation.data)

        const { data, error } = await supabase
            .from("plans")
            .insert(planData)
            .select()
            .single()

        if (error) {
            console.error("Error creating plan:", error)
            return failure("Error al crear el plan")
        }

        revalidatePath("/admin/plans")
        const plan = deserializePlanFromDb(data)
        return success(plan)
    } catch (error) {
        console.error("Error in createPlan:", error)
        return failure("Error inesperado al crear el plan")
    }
}

/**
 * Actualiza un plan existente
 */
export async function updatePlan(id: string, input: UpdatePlanInput): Promise<ActionResult<Plan>> {
    try {
        // Validar input con Zod
        const validation = UpdatePlanInputSchema.safeParse(input)
        if (!validation.success) {
            const errorMessage = validation.error.issues[0]?.message || "Datos inválidos"
            return failure(errorMessage)
        }

        const supabase = await createServiceClient()

        // Verificar que el plan existe
        const { data: existingPlan } = await supabase
            .from("plans")
            .select("id")
            .eq("id", id)
            .single()

        if (!existingPlan) {
            return failure("Plan no encontrado")
        }

        // Si se está actualizando nombre o slug, verificar unicidad
        if (validation.data.name || validation.data.slug) {
            const conditions = []
            if (validation.data.name) conditions.push(`name.eq.${validation.data.name}`)
            if (validation.data.slug) conditions.push(`slug.eq.${validation.data.slug}`)

            const { data: duplicate } = await supabase
                .from("plans")
                .select("id")
                .or(conditions.join(","))
                .neq("id", id)
                .limit(1)

            if (duplicate && duplicate.length > 0) {
                return failure("Ya existe otro plan con ese nombre o slug")
            }
        }

        const { data, error } = await supabase
            .from("plans")
            .update(validation.data)
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating plan:", error)
            return failure("Error al actualizar el plan")
        }

        revalidatePath("/admin/plans")
        const plan = deserializePlanFromDb(data)
        return success(plan)
    } catch (error) {
        console.error("Error in updatePlan:", error)
        return failure("Error inesperado al actualizar el plan")
    }
}

/**
 * Activa o desactiva un plan
 */
export async function togglePlanStatus(id: string): Promise<ActionResult<Plan>> {
    try {
        const supabase = await createServiceClient()

        // Obtener estado actual
        const { data: currentPlan, error: fetchError } = await supabase
            .from("plans")
            .select("is_active")
            .eq("id", id)
            .single()

        if (fetchError || !currentPlan) {
            return failure("Plan no encontrado")
        }

        // Cambiar estado
        const newStatus = !currentPlan.is_active

        const { data, error } = await supabase
            .from("plans")
            .update({ is_active: newStatus })
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error toggling plan status:", error)
            return failure("Error al cambiar el estado del plan")
        }

        revalidatePath("/admin/plans")
        const plan = deserializePlanFromDb(data)
        return success(plan)
    } catch (error) {
        console.error("Error in togglePlanStatus:", error)
        return failure("Error inesperado al cambiar el estado del plan")
    }
}

/**
 * Elimina un plan (solo si no tiene suscripciones activas)
 */
export async function deletePlan(id: string): Promise<ActionResult<void>> {
    try {
        const supabase = await createServiceClient()

        // Verificar que no haya suscripciones activas
        const { data: subscriptions } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("plan_id", id)
            .in("status", ["active", "trialing"])
            .limit(1)

        if (subscriptions && subscriptions.length > 0) {
            return failure("No se puede eliminar un plan con suscripciones activas")
        }

        const { error } = await supabase
            .from("plans")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("Error deleting plan:", error)
            return failure("Error al eliminar el plan")
        }

        revalidatePath("/admin/plans")
        return success(undefined)
    } catch (error) {
        console.error("Error in deletePlan:", error)
        return failure("Error inesperado al eliminar el plan")
    }
}
