/**
 * Tests para el módulo de comandos del operador (whatsapp/operator-commands).
 *
 * Cubre:
 *   - Parsing: isOperatorCommand, parseCommand
 *   - Acciones básicas: applySoftPause, pauseAi, resumeAi (Slice 2)
 *   - Acciones avanzadas: showInfo, whitelist, unwhitelist, closeChat (Slice 3)
 *   - Dispatch del handler principal
 *   - Edge cases: chat no encontrado, comando inválido, customer ausente
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// Mock de Supabase
// =============================================================================

const mockChatSelect = vi.fn()
const mockChatUpdate = vi.fn()
const mockCustomersSingle = vi.fn()
const mockCustomersUpdate = vi.fn()
const mockOrgSettingsSingle = vi.fn()

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

  if (table === "customers") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => mockCustomersSingle()),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => mockCustomersUpdate()),
      })),
    }
  }

  if (table === "organizations") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => mockOrgSettingsSingle()),
        })),
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
  getSoftPauseDurationMin,
  DEFAULT_SOFT_PAUSE_DURATION_MIN,
  MAX_SOFT_PAUSE_DURATION_MIN,
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

    it("usa DEFAULT_SOFT_PAUSE_DURATION_MIN como default", async () => {
      mockChatUpdate.mockResolvedValue({ error: null })

      const before = Date.now()
      const result = await applySoftPause({ from: mockFrom } as unknown as never, "chat-1")

      // Default de 30 min
      expect(result.until.getTime()).toBeGreaterThanOrEqual(
        before + DEFAULT_SOFT_PAUSE_DURATION_MIN * 60 * 1000 - 100
      )
    })

    it("retorna success=false cuando el update falla", async () => {
      mockChatUpdate.mockResolvedValue({ error: { message: "DB error" } })

      const supabase = { from: mockFrom }
      const result = await applySoftPause(supabase as unknown as never, "chat-1")

      expect(result.success).toBe(false)
    })

    describe("durationMinutes <= 0 (pausa desactivada por organizacion)", () => {
      it("con duration 0 no llama a update y retorna success=true sin pausa real", async () => {
        const supabase = { from: mockFrom }
        const result = await applySoftPause(supabase as unknown as never, "chat-1", 0)

        expect(result.success).toBe(true)
        // No debe haber llamado al update porque la pausa esta desactivada.
        expect(mockChatUpdate).not.toHaveBeenCalled()
      })

      it("con duration negativa (-5) tampoco toca BD", async () => {
        const supabase = { from: mockFrom }
        const result = await applySoftPause(supabase as unknown as never, "chat-1", -5)

        expect(result.success).toBe(true)
        expect(mockChatUpdate).not.toHaveBeenCalled()
      })
    })
  })
})

describe("operator-commands - getSoftPauseDurationMin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("devuelve el valor configurado por organizacion (caso clasico 15 min)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: 15 } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(15)
  })

  it("devuelve 0 cuando la organizacion lo configuro asi (pausa desactivada)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: 0 } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(0)
  })

  it("devuelve el default cuando settings no tiene la propiedad", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { branding: { primaryColor: "#fff" } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(DEFAULT_SOFT_PAUSE_DURATION_MIN)
  })

  it("devuelve el default cuando settings es null", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: null },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(DEFAULT_SOFT_PAUSE_DURATION_MIN)
  })

  it("clampea valores arriba del maximo (300 -> 240)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: 300 } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(MAX_SOFT_PAUSE_DURATION_MIN)
  })

  it("clampea valores negativos al minimo (-50 -> 0)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: -50 } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(0)
  })

  it("devuelve el default cuando el valor no es numerico (proteccion contra JSON corrupto)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: "30" } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(DEFAULT_SOFT_PAUSE_DURATION_MIN)
  })

  it("devuelve el default cuando la query falla (resilencia)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: null,
      error: { message: "organization not found" },
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-inexistente"
    )
    expect(result).toBe(DEFAULT_SOFT_PAUSE_DURATION_MIN)
  })

  it("truncate valores decimales (15.7 -> 15)", async () => {
    mockOrgSettingsSingle.mockResolvedValue({
      data: { settings: { whatsapp_operator: { softPauseDurationMin: 15.7 } } },
      error: null,
    })

    const result = await getSoftPauseDurationMin(
      { from: mockFrom } as unknown as never,
      "org-1"
    )
    expect(result).toBe(15)
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

// =============================================================================
// Slice 3: /info, /whitelist, /unwhitelist, /cerrar
// =============================================================================

describe("operator-commands - Slice 3 commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------
  // /info y /estado
  // ---------------------------------------------------------------------

  describe("/info", () => {
    it("muestra estado normal: IA activa, abierto, no whitelisted", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersSingle.mockResolvedValue({
        data: { is_human_only: false, full_name: "Cliente Demo" },
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/info"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Estado del chat")
      expect(result.message).toContain("IA activa")
      expect(result.message).toContain("Abierto")
      // No debe haber mutado nada
      expect(mockChatUpdate).not.toHaveBeenCalled()
      expect(mockCustomersUpdate).not.toHaveBeenCalled()
    })

    it("muestra timestamp restante cuando hay soft-pause vigente", async () => {
      const pausedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: pausedUntil,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersSingle.mockResolvedValue({
        data: { is_human_only: false, full_name: null },
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/info"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Pausa automática")
      expect(result.message).toMatch(/~\d+ min restantes/)
    })

    it("muestra 'IA pausada (hard)' cuando ai_enabled=false y no hay soft-pause", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: false,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersSingle.mockResolvedValue({
        data: { is_human_only: false, full_name: null },
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/info"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("IA pausada (hard)")
    })

    it("muestra whitelist cuando customer.is_human_only === true", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersSingle.mockResolvedValue({
        data: { is_human_only: true, full_name: "Cris" },
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/info"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Sí (solo humano)")
    })

    it("/estado es alias de /info", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: null,
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/estado"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Estado del chat")
    })
  })

  // ---------------------------------------------------------------------
  // /whitelist y /solohumano
  // ---------------------------------------------------------------------

  describe("/whitelist", () => {
    it("marca customer como is_human_only=true", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersUpdate.mockResolvedValue({ error: null })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/whitelist"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("solo humano")
      expect(mockCustomersUpdate).toHaveBeenCalled()
    })

    it("falla con mensaje claro si chat no tiene customer_id", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: null,
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/whitelist"
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain("no tiene cliente asociado")
      expect(mockCustomersUpdate).not.toHaveBeenCalled()
    })

    it("propaga error de DB con mensaje amigable", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersUpdate.mockResolvedValue({ error: { message: "rls policy violation" } })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/whitelist"
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain("rls policy violation")
    })

    it("/solohumano es alias de /whitelist", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersUpdate.mockResolvedValue({ error: null })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/solohumano"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("solo humano")
    })
  })

  // ---------------------------------------------------------------------
  // /unwhitelist
  // ---------------------------------------------------------------------

  describe("/unwhitelist", () => {
    it("marca customer como is_human_only=false", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockCustomersUpdate.mockResolvedValue({ error: null })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/unwhitelist"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("quitado")
      expect(mockCustomersUpdate).toHaveBeenCalled()
    })

    it("falla cuando no hay customer asociado", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: null,
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/unwhitelist"
      )

      expect(result.success).toBe(false)
      expect(mockCustomersUpdate).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------
  // /cerrar y /resolver
  // ---------------------------------------------------------------------

  describe("/cerrar", () => {
    it("cambia status a 'closed' cuando chat está abierto", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockChatUpdate.mockResolvedValue({ error: null })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/cerrar"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Chat cerrado")
      expect(mockChatUpdate).toHaveBeenCalled()
    })

    it("responde idémpotente cuando el chat ya está cerrado (no muta)", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "closed",
        }],
        error: null,
      })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/cerrar"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("ya está cerrado")
      expect(mockChatUpdate).not.toHaveBeenCalled()
    })

    it("/resolver es alias de /cerrar", async () => {
      mockChatSelect.mockResolvedValue({
        data: [{
          id: "chat-1",
          ai_enabled: true,
          ai_paused_until: null,
          customer_id: "cust-1",
          phone_number: "+573001234567",
          status: "active",
        }],
        error: null,
      })
      mockChatUpdate.mockResolvedValue({ error: null })

      const result = await handleOperatorCommand(
        { from: mockFrom } as unknown as never,
        "org-1",
        "+573001234567",
        "/resolver"
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain("Chat cerrado")
    })
  })
})
