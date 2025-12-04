"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { ActionResult } from "@/types/common"
import {
  organizationDetailsSchema,
  agentDataSchema,
  type OrganizationDetailsInput,
  type AgentDataInput,
} from "@/types/organization"

// ============================================================================
// Update Organization Details
// ============================================================================

export async function updateOrganizationDetails(
  input: OrganizationDetailsInput
): Promise<ActionResult<void>> {
  // 1. Validar input
  const parsed = organizationDetailsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    }
  }

  try {
    const supabase = await createClient()

    // 2. Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "User not authenticated" }
    }

    // 3. Obtener organización del usuario con reintentos
    let profile = null
    let attempts = 0
    const maxAttempts = 3

    while (!profile && attempts < maxAttempts) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (profileData?.organization_id) {
        profile = profileData
        break
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      attempts++
    }

    if (!profile?.organization_id) {
      return { 
        success: false, 
        error: "No organization found for user. Please try logging out and back in." 
      }
    }

    // 4. Actualizar organización
    const { error } = await supabase
      .from("organizations")
      .update({
        name: parsed.data.name,
        slug: parsed.data.subdomain,
        subdomain: parsed.data.subdomain,
        contact_email: parsed.data.contactEmail,
        industry: parsed.data.industry,
        logo_url: parsed.data.logoUrl || null,
        onboarding_step: 1
      })
      .eq("id", profile.organization_id)

    if (error) {
      return { success: false, error: `Failed to update organization: ${error.message}` }
    }

    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error updating organization"
    }
  }
}

// ============================================================================
// Create First Agent
// ============================================================================

export async function createFirstAgent(
  input: AgentDataInput
): Promise<ActionResult<void>> {
  // 1. Validar input
  const parsed = agentDataSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    }
  }

  try {
    const supabase = await createClient()

    // 2. Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "User not authenticated" }
    }

    // 3. Obtener organización del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found for user" }
    }

    // 4. Determinar rol del agente según tipo
    const role = parsed.data.type === "sales" ? "sales" : "support"

    // 5. Crear agente
    const { error } = await supabase
      .from("agents")
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        type: "bot",
        role: role,
        status: "available",
        configuration: {
          template: parsed.data.type,
          greeting: parsed.data.type === "sales"
            ? "¡Hola! Estoy aquí para ayudarte a encontrar el producto perfecto. ¿Qué estás buscando hoy?"
            : "¡Hola! ¿En qué puedo ayudarte hoy?"
        }
      })

    if (error) {
      return { success: false, error: `Failed to create agent: ${error.message}` }
    }

    // 6. Actualizar paso de onboarding
    await supabase
      .from("organizations")
      .update({ onboarding_step: 2 })
      .eq("id", profile.organization_id)

    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error creating agent"
    }
  }
}

// ============================================================================
// Complete Onboarding
// ============================================================================

export async function completeOnboarding(): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "User not authenticated" }
    }

    // 2. Obtener organización del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found for user" }
    }

    // 3. Marcar onboarding como completado
    const { error } = await supabase
      .from("organizations")
      .update({
        onboarding_completed: true,
        onboarding_step: 4
      })
      .eq("id", profile.organization_id)

    if (error) {
      return { success: false, error: `Failed to complete onboarding: ${error.message}` }
    }

    // 4. Retornar URL de redirección (el cliente manejará la redirección)
    return { success: true, data: { redirectTo: "/dashboard" } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error completing onboarding"
    }
  }
}

// ============================================================================
// Legacy redirect function (para compatibilidad)
// ============================================================================

export async function completeOnboardingAndRedirect(): Promise<never> {
  const result = await completeOnboarding()
  if (result.success) {
    redirect(result.data.redirectTo)
  } else {
    // Si falla, redirigir al dashboard de todos modos
    redirect("/dashboard")
  }
}
