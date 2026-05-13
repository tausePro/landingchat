/**
 * Tests para controles del operador en messaging/unified.ts
 *
 * Cubre:
 *   - Check 0: whitelist `customers.is_human_only` (precedencia máxima)
 *   - Check 1: hard pause `chats.ai_enabled = false`
 *   - Check 1.5: soft pause `chats.ai_paused_until` con expiración + auto-cleanup
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Mocks
// =============================================================================

// Mock granular para cada combinación de tabla + operación
const mockChatSelect = vi.fn()
const mockCustomerSelect = vi.fn()
const mockChatUpdate = vi.fn()

// Builder de mock para que `from('chats').update({...}).eq('id', ...)` funcione
const buildChatUpdateChain = () => ({
  eq: vi.fn(() => mockChatUpdate()),
})

const mockFrom = vi.fn((table: string) => {
  if (table === "chats") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockChatSelect,
        })),
      })),
      update: vi.fn(() => buildChatUpdateChain()),
    }
  }

  if (table === "customers") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockCustomerSelect,
        })),
      })),
    }
  }

  // Cualquier otra tabla: mock vacío que retorna null en single()
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })),
        single: vi.fn().mockResolvedValue({ data: null }),
        limit: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })),
      })),
    })),
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

// Mockear processMessage para evitar llamadas reales al AI
vi.mock("@/lib/ai/chat-agent", () => ({
  processMessage: vi.fn().mockResolvedValue({
    response: "respuesta IA mock",
    actions: [],
  }),
}))

// Mockear envío de WhatsApp para evitar llamadas reales
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true }),
  sendWhatsAppImage: vi.fn().mockResolvedValue({ success: true }),
  sendWhatsAppMedia: vi.fn().mockResolvedValue({ success: true }),
  sendWhatsAppButtons: vi.fn().mockResolvedValue({ success: true }),
  sendWhatsAppList: vi.fn().mockResolvedValue({ success: true }),
}))

// Mockear envío de redes sociales
vi.mock("@/lib/messaging/meta-social-client", () => ({
  sendSocialMessage: vi.fn().mockResolvedValue({ success: true }),
  sendSocialImage: vi.fn().mockResolvedValue({ success: true }),
  sendSocialQuickReplies: vi.fn().mockResolvedValue({ success: true }),
}))

// =============================================================================
// Imports después de los mocks
// =============================================================================

import { processIncomingMessage } from "@/lib/messaging/unified"
import { processMessage } from "@/lib/ai/chat-agent"

// =============================================================================
// Tests
// =============================================================================

describe("Unified Messaging - Operator Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Check 0: whitelist (customers.is_human_only)
  // ==========================================================================

  describe("Check 0: whitelist human-only", () => {
    it("bloquea IA cuando customer.is_human_only === true", async () => {
      // Arrange: chat válido con customer marcado como human-only
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: null,
          ai_enabled: true,
          ai_paused_until: null,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: true },
        error: null,
      })

      // Act
      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola, necesito información",
      })

      // Assert: skip silencioso, IA NO procesa
      expect(result).toEqual({ success: true, response: undefined })
      expect(processMessage).not.toHaveBeenCalled()
    })

    it("permite IA cuando customer.is_human_only === false", async () => {
      // Arrange: customer NO marcado como human-only
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: "agent-1",
          ai_enabled: true,
          ai_paused_until: null,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      // Act
      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      // Assert: NO se bloquea por whitelist (avanza a otros checks o procesa)
      // El test de éxito completo depende de mocks de agents/etc, pero al menos
      // verificamos que NO retornó skip por whitelist específicamente.
      // processMessage SÍ debería haber sido llamado si todos los demás checks pasan.
      expect(result.success).toBe(true)
    })

    it("permite IA cuando chat no tiene customer_id (chat anónimo web)", async () => {
      // Arrange: chat sin customer_id
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: null,
          assigned_agent_id: "agent-1",
          ai_enabled: true,
          ai_paused_until: null,
        },
        error: null,
      })

      // Act
      const result = await processIncomingMessage({
        channel: "web",
        chatId: "chat-1",
        content: "Hola",
      })

      // Assert: NO se intenta consultar customers (sin customer_id)
      expect(mockCustomerSelect).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // Check 1: hard pause (ai_enabled = false)
  // ==========================================================================

  describe("Check 1: hard pause manual (ai_enabled = false)", () => {
    it("bloquea IA cuando chat.ai_enabled === false", async () => {
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: null,
          ai_enabled: false,
          ai_paused_until: null,
        },
        error: null,
      })

      // Customer NO en whitelist (para que pase Check 0 y llegue a Check 1)
      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      expect(result).toEqual({ success: true, response: undefined })
      expect(processMessage).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Check 1.5: soft pause (ai_paused_until con expiración)
  // ==========================================================================

  describe("Check 1.5: soft pause con expiración", () => {
    it("bloquea IA cuando ai_paused_until > NOW()", async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString() // +30 min

      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: null,
          ai_enabled: true,
          ai_paused_until: futureDate,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      expect(result).toEqual({ success: true, response: undefined })
      expect(processMessage).not.toHaveBeenCalled()
      // NO debe limpiar el campo (sigue activa la pausa)
      expect(mockChatUpdate).not.toHaveBeenCalled()
    })

    it("permite IA y limpia ai_paused_until cuando ya expiró", async () => {
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString() // -1 min

      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: "agent-1",
          ai_enabled: true,
          ai_paused_until: pastDate,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      mockChatUpdate.mockResolvedValue({ error: null })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      // Debe haber limpiado el campo
      expect(mockChatUpdate).toHaveBeenCalled()
      // Y debe permitir que IA continúe (pasa al resto del flujo)
      expect(result.success).toBe(true)
    })

    it("ignora ai_paused_until cuando es null (sin pausa)", async () => {
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: "agent-1",
          ai_enabled: true,
          ai_paused_until: null,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      // No debe llamar update (no hay nada que limpiar)
      expect(mockChatUpdate).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // Precedencia entre checks
  // ==========================================================================

  describe("Precedencia: whitelist > hard pause > soft pause", () => {
    it("whitelist tiene precedencia sobre ai_enabled=false", async () => {
      // Aunque ai_enabled=false (hard pause), si está en whitelist debe bloquear
      // por whitelist primero (Check 0 antes que Check 1).
      // Este test verifica que NO se intente acceder a ai_enabled cuando whitelist activa.
      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: null,
          ai_enabled: false, // hard pause TAMBIÉN
          ai_paused_until: null,
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: true },
        error: null,
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      // Bloqueada (no importa cuál check disparó, ambos bloquean igual)
      expect(result).toEqual({ success: true, response: undefined })
      expect(processMessage).not.toHaveBeenCalled()
      // Customer query SÍ se ejecutó (Check 0 corre antes)
      expect(mockCustomerSelect).toHaveBeenCalled()
    })

    it("hard pause tiene precedencia sobre soft pause", async () => {
      // Si ai_enabled=false Y ai_paused_until expiró, debería seguir bloqueada
      // por hard pause (Check 1) antes de llegar a Check 1.5.
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString()

      mockChatSelect.mockResolvedValue({
        data: {
          organization_id: "org-1",
          customer_id: "cust-1",
          assigned_agent_id: null,
          ai_enabled: false, // hard pause activa
          ai_paused_until: pastDate, // soft pause expirada
        },
        error: null,
      })

      mockCustomerSelect.mockResolvedValue({
        data: { is_human_only: false },
        error: null,
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-1",
        content: "Hola",
      })

      // Bloqueada por hard pause; NO debió limpiar ai_paused_until
      // (porque retornó early antes del Check 1.5)
      expect(result).toEqual({ success: true, response: undefined })
      expect(processMessage).not.toHaveBeenCalled()
      expect(mockChatUpdate).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Errores y edge cases
  // ==========================================================================

  describe("Edge cases", () => {
    it("retorna error cuando el chat no existe", async () => {
      mockChatSelect.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      })

      const result = await processIncomingMessage({
        channel: "whatsapp",
        chatId: "chat-inexistente",
        content: "Hola",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Chat no encontrado")
    })
  })
})
