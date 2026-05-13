/**
 * Tests para el módulo de comandos del operador (whatsapp/operator-commands).
 *
 * Cubre:
 *   - Parsing: isOperatorCommand, parseCommand
 *   - Acciones: applySoftPause, pauseAi, resumeAi (vía handleOperatorCommand)
 *   - Dispatch del handler principal
 *   - Edge cases: chat no encontrado, comando inválido
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Mock de Supabase
// =============================================================================

const mockChatSelect = vi.fn()
const mockChatUpdate = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === "chats") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => mockChatSelect()),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => mockChatUpdate()),
      })),
    }
  }

  return {
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
    update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
  }
})

vi.mock("@/lib/utils/phone", () => ({
  getPhoneVariants: (phone: string) => [phone, phone.replace(/^\+/, "")],
}))

// =============================================================================
// Imports después de mocks
// =============================================================================

import {
  isOperatorCommand,
  parseCommand,
  applySoftPause,
  findActiveChatByPhone,
  handleOperatorCommand,
  SOFT_PAUSE_DURATION_MIN,
} from "@/lib/whatsapp/operator-commands"

// =============================================================================
// Tests
// =============================================================================

describe("operator-commands - parsing", () => {
  describe("isOperatorCommand", () => {
    it.each([
      ["/yo", true],
      ["/help", true],
      ["/HELP", true],
      ["/info ahora mismo", true],
      ["  /yo  ", true], // tolera espacios
      ["hola /yo", false], // debe empezar con /
      ["", false],
      ["/", false], // solo el slash sin letra
      ["/123", false], // empieza con número
      ["mensaje normal", false],
    ])("isOperatorCommand(%j) === %s", (input, expected) => {
      expect(isOperatorCommand(input)).toBe(expected)
    })
  })

  describe("parseCommand", () => {
    it("parsea comando sin args", () => {
      expect(parseCommand("/yo")).toEqual({
        command: "yo",
        args: [],
        raw: "/yo",
      })
    })

    it("parsea comando con args múltiples", () => {
      expect(parseCommand("/notas hola dos tres")).toEqual({
        command: "notas",
        args: ["hola", "dos", "tres"],
        raw: "/notas hola dos tres",
      })
    })

    it("normaliza command a lowercase", () => {
      expect(parseCommand("/YO")?.command).toBe("yo")
      expect(parseCommand("/Help")?.command).toBe("help")
    })

    it("retorna null cuando no es comando", () => {
      expect(parseCommand("hola")).toBeNull()
      expect(parseCommand("")).toBeNull()
      expect(parseCommand("/")).toBeNull()
    })

    it("trimea espacios al inicio/fin", () => {
      const result = parseCommand("  /info  ")
      expect(result?.command).toBe("info")
      expect(result?.raw).toBe("/info")
    })
  })
})

describe("operator-commands - acciones", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("applySoftPause", () => {
    it("aplica timestamp de duración correcta y retorna success", async () => {
      mockChatUpdate.mockResolvedValue({ error: null })

      const before = Date.now()
      const supabase = { from: mockFrom }
      const result = await applySoftPause(supabase as unknown as never, "chat-1", 30)
      const after = Date.now()

      expect(result.success).toBe(true)
      expect(result.until.getTime()).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
      expect(result.until.getTime()).toBeLessThanOrEqual(after + 30 * 60 * 1000)
    })

    it("usa SOFT_PAUSE_DURATION_MIN como default", async () => {
      mockChatUpdate.mockResolvedValue({ error: null })

      const before = Date.now()
      const result = await applySoftPause({ from: mockFrom } as unknown as never, "chat-1")

      // Default de 30 min
      expect(result.until.getTime()).toBeGreaterThanOrEqual(
        before + SOFT_PAUSE_DURATION_MIN * 60 * 1000 - 100
      )
    })

    it("retorna success=false cuando el update falla", async () => {
      mockChatUpdate.mockResolvedValue({ error: { message: "DB error" } })

      const supabase = { from: mockFrom }
      const result = await applySoftPause(supabase as unknown as never, "chat-1")

      expect(result.success).toBe(false)
    })
  })
})

describe("operator-commands - findActiveChatByPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("encuentra chat existente por teléfono", async () => {
    mockChatSelect.mockResolvedValue({
      data: [
        {
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
        },
      ],
      error: null,
    })

    const supabase = { from: mockFrom }
    const chat = await findActiveChatByPhone(
      supabase as unknown as never,
      "org-1",
      "+573001234567"
    )

    expect(chat).not.toBeNull()
    expect(chat?.id).toBe("chat-1")
  })

  it("retorna null cuando no hay chat", async () => {
    mockChatSelect.mockResolvedValue({ data: [], error: null })

    const supabase = { from: mockFrom }
    const chat = await findActiveChatByPhone(
      supabase as unknown as never,
      "org-1",
      "+573009999999"
    )

    expect(chat).toBeNull()
  })

  it("retorna null cuando hay error de DB", async () => {
    mockChatSelect.mockResolvedValue({
      data: null,
      error: { message: "DB connection lost" },
    })

    const supabase = { from: mockFrom }
    const chat = await findActiveChatByPhone(
      supabase as unknown as never,
      "org-1",
      "+573001234567"
    )

    expect(chat).toBeNull()
  })
})

describe("operator-commands - handleOperatorCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("/help responde con la lista de comandos sin requerir chat activo", async () => {
    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/help"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("Comandos del operador")
    expect(result.message).toContain("/yo")
    expect(result.message).toContain("/bot")
    // No debió consultar la DB de chats para mostrar help
    expect(mockChatSelect).not.toHaveBeenCalled()
  })

  it("/ayuda es alias de /help", async () => {
    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/ayuda"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("Comandos del operador")
  })

  it("/yo pausa la IA (ai_enabled=false) cuando hay chat activo", async () => {
    mockChatSelect.mockResolvedValue({
      data: [{ id: "chat-1", ai_enabled: true, ai_paused_until: null, customer_id: "cust-1", phone_number: "+573001234567" }],
      error: null,
    })
    mockChatUpdate.mockResolvedValue({ error: null })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/yo"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("IA pausada")
    expect(mockChatUpdate).toHaveBeenCalled()
  })

  it("/pausar es alias de /yo", async () => {
    mockChatSelect.mockResolvedValue({
      data: [{ id: "chat-1", ai_enabled: true, ai_paused_until: null, customer_id: null, phone_number: "+573001234567" }],
      error: null,
    })
    mockChatUpdate.mockResolvedValue({ error: null })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/pausar"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("IA pausada")
  })

  it("/bot reactiva la IA cuando hay chat activo", async () => {
    mockChatSelect.mockResolvedValue({
      data: [{ id: "chat-1", ai_enabled: false, ai_paused_until: null, customer_id: null, phone_number: "+573001234567" }],
      error: null,
    })
    mockChatUpdate.mockResolvedValue({ error: null })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/bot"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("IA reactivada")
    expect(mockChatUpdate).toHaveBeenCalled()
  })

  it("/reanudar es alias de /bot", async () => {
    mockChatSelect.mockResolvedValue({
      data: [{ id: "chat-1", ai_enabled: false, ai_paused_until: null, customer_id: null, phone_number: "+573001234567" }],
      error: null,
    })
    mockChatUpdate.mockResolvedValue({ error: null })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/reanudar"
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("IA reactivada")
  })

  it("retorna error amigable cuando no hay chat activo", async () => {
    mockChatSelect.mockResolvedValue({ data: [], error: null })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573009999999",
      "/yo"
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("No hay conversación activa")
  })

  it("retorna error cuando comando es desconocido", async () => {
    mockChatSelect.mockResolvedValue({
      data: [{ id: "chat-1", ai_enabled: true, ai_paused_until: null, customer_id: null, phone_number: "+573001234567" }],
      error: null,
    })

    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "/foobar"
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("no reconocido")
    expect(result.message).toContain("/help")
  })

  it("retorna error cuando texto no es comando válido", async () => {
    const supabase = { from: mockFrom }
    const result = await handleOperatorCommand(
      supabase as unknown as never,
      "org-1",
      "+573001234567",
      "esto no es comando"
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("inválido")
  })
})
