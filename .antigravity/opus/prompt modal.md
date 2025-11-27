 Código para Antigravity

2.1 Componente: Customer Gate Modal
Archivo: src / components / store / customer - gate - modal.tsx
typescript"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface CustomerGateModalProps {
    isOpen: boolean
    onClose: () => void
    onIdentified: (customer: Customer) => void
    slug: string
    organizationName?: string
}

interface Customer {
    id: string
    full_name: string
    phone: string
    isNew: boolean
}

interface ReturningCustomer {
    id: string
    full_name: string
    phone: string
}

const COUNTRY_CODES = [
    { code: "+57", country: "CO", flag: "🇨🇴", name: "Colombia" },
    { code: "+52", country: "MX", flag: "🇲🇽", name: "México" },
    { code: "+54", country: "AR", flag: "🇦🇷", name: "Argentina" },
    { code: "+56", country: "CL", flag: "🇨🇱", name: "Chile" },
    { code: "+51", country: "PE", flag: "🇵🇪", name: "Perú" },
    { code: "+593", country: "EC", flag: "🇪🇨", name: "Ecuador" },
    { code: "+1", country: "US", flag: "🇺🇸", name: "Estados Unidos" },
]

type ModalState = "register" | "returning" | "loading" | "success"

export function CustomerGateModal({
    isOpen,
    onClose,
    onIdentified,
    slug,
    organizationName = "nuestra tienda"
}: CustomerGateModalProps) {
    const [state, setState] = useState<ModalState>("register")
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [countryCode, setCountryCode] = useState("+57")
    const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
    const [returningCustomer, setReturningCustomer] = useState<ReturningCustomer | null>(null)

    const nameInputRef = useRef<HTMLInputElement>(null)

    // Focus en el primer campo al abrir
    useEffect(() => {
        if (isOpen && state === "register") {
            setTimeout(() => nameInputRef.current?.focus(), 100)
        }
    }, [isOpen, state])

    // Reset state cuando se cierra
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setState("register")
                setName("")
                setPhone("")
                setErrors({})
                setReturningCustomer(null)
            }, 200)
        }
    }, [isOpen])

    const validateForm = (): boolean => {
        const newErrors: { name?: string; phone?: string } = {}

        if (!name.trim()) {
            newErrors.name = "Por favor ingresa tu nombre"
        } else if (name.trim().length < 2) {
            newErrors.name = "El nombre debe tener al menos 2 caracteres"
        }

        const cleanPhone = phone.replace(/\D/g, "")
        if (!cleanPhone) {
            newErrors.phone = "Por favor ingresa tu WhatsApp"
        } else if (cleanPhone.length < 7 || cleanPhone.length > 15) {
            newErrors.phone = "Número de WhatsApp inválido"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) return

        setState("loading")

        try {
            const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`

            const response = await fetch(`/api/store/${slug}/identify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: fullPhone
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Error al identificar")
            }

            // Si es cliente que regresa y el nombre no coincide, preguntar
            if (data.isReturning && data.customer.full_name !== name.trim()) {
                setReturningCustomer(data.customer)
                setState("returning")
                return
            }

            setState("success")

            // Esperar un momento para mostrar el éxito
            setTimeout(() => {
                onIdentified(data.customer)
            }, 1000)

        } catch (error: any) {
            console.error("Error identifying customer:", error)
            setErrors({ phone: error.message || "Error al procesar. Intenta de nuevo." })
            setState("register")
        }
    }

    const handleContinueAsReturning = () => {
        if (returningCustomer) {
            setState("success")
            setTimeout(() => {
                onIdentified({
                    ...returningCustomer,
                    isNew: false
                })
            }, 1000)
        }
    }

    const handleNotMe = () => {
        setReturningCustomer(null)
        setPhone("")
        setState("register")
    }

    const formatPhoneDisplay = (phone: string) => {
        // Ocultar parte del número: +57 300 *** 4567
        if (phone.length < 8) return phone
        const visible = phone.slice(-4)
        const hidden = phone.slice(0, -4).replace(/\d/g, "*").slice(-3)
        return `${phone.slice(0, 3)} ${hidden} ${visible}`
    }

    return (
        <Dialog open= { isOpen } onOpenChange = { onClose } >
            <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" >
                {/* Estado: Registro */ }
    {
        (state === "register" || state === "loading") && (
            <form onSubmit={ handleSubmit }>
                <DialogHeader className="p-6 pb-4 text-center" >
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3" >
                        <span className="material-symbols-outlined text-primary text-2xl" > chat </span>
                            </div>
                            < DialogTitle className = "text-xl font-bold" >
                                ¡Hola! Antes de chatear...
        </DialogTitle>
            < p className = "text-sm text-gray-500 mt-1" >
                Cuéntanos un poco sobre ti para darte una mejor atención
                    </p>
                    </DialogHeader>

                    < div className = "px-6 pb-6 space-y-4" >
                        {/* Campo Nombre */ }
                        < div className = "space-y-2" >
                            <Label htmlFor="name" > Tu nombre </Label>
                                < Input
        ref = { nameInputRef }
        id = "name"
        type = "text"
        placeholder = "¿Cómo te llamas?"
        value = { name }
        onChange = {(e) => {
            setName(e.target.value)
            if (errors.name) setErrors({ ...errors, name: undefined })
        }
    }
    className = { errors.name ? "border-red-500" : "" }
    disabled = { state === "loading"
}
                                />
{
    errors.name && (
        <p className="text-sm text-red-500" > { errors.name } </p>
                                )
}
</div>

{/* Campo WhatsApp */ }
<div className="space-y-2" >
    <Label htmlFor="phone" > Tu WhatsApp </Label>
        < div className = "flex gap-2" >
            <Select
                                        value={ countryCode }
onValueChange = { setCountryCode }
disabled = { state === "loading"}
                                    >
    <SelectTrigger className="w-[100px]" >
        <SelectValue />
        </SelectTrigger>
        <SelectContent>
{
    COUNTRY_CODES.map((c) => (
        <SelectItem key= { c.code } value = { c.code } >
        <span className="flex items-center gap-2" >
        <span>{ c.flag } </span>
        < span > { c.code } </span>
        </span>
    </SelectItem>
    ))
}
</SelectContent>
    </Select>
    < div className = "relative flex-1" >
        <Input
                                            id="phone"
type = "tel"
placeholder = "300 123 4567"
value = { phone }
onChange = {(e) => {
    setPhone(e.target.value)
    if (errors.phone) setErrors({ ...errors, phone: undefined })
}}
className = {`pl-10 ${errors.phone ? "border-red-500" : ""}`}
disabled = { state === "loading"}
                                        />
    < svg
className = "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500"
viewBox = "0 0 24 24"
fill = "currentColor"
    >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        </div>
        </div>
{
    errors.phone && (
        <p className="text-sm text-red-500" > { errors.phone } </p>
                                )
}
</div>

{/* Botón Submit */ }
<Button
                                type="submit"
className = "w-full"
disabled = { state === "loading"}
                            >
    { state === "loading" ? (
        <span className= "flex items-center gap-2" >
<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    Conectando...
</span>
                                ) : (
    <span className= "flex items-center gap-2" >
    Iniciar Chat
        < span className = "material-symbols-outlined text-lg" > arrow_forward </span>
            </span>
                                )}
</Button>

{/* Texto de privacidad */ }
<p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1" >
    <span className="material-symbols-outlined text-sm" > lock </span>
                                Tu información está segura.Solo la usamos para atenderte mejor.
                            </p>
    </div>
    </form>
                )}

{/* Estado: Cliente que regresa */ }
{
    state === "returning" && returningCustomer && (
        <div className="p-6 text-center" >
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4" >
                <span className="text-2xl font-bold text-primary" >
                    { returningCustomer.full_name.charAt(0).toUpperCase() }
                    </span>
                    </div>

                    < h2 className = "text-xl font-bold mb-1" >
                            ¡Hola de nuevo! 👋
    </h2>
        < p className = "text-gray-500 mb-6" >
            Te recordamos de tu última visita
                </p>

                < div className = "bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6" >
                    <p className="font-semibold" > { returningCustomer.full_name } </p>
                        < p className = "text-sm text-gray-500" >
                            { formatPhoneDisplay(returningCustomer.phone) }
                            </p>
                            </div>

                            < div className = "space-y-3" >
                                <Button
                                className="w-full"
    onClick = { handleContinueAsReturning }
        >
        Continuar como { returningCustomer.full_name.split(" ")[0] }
    </Button>
        < Button
    variant = "ghost"
    className = "w-full text-gray-500"
    onClick = { handleNotMe }
        >
        No soy { returningCustomer.full_name.split(" ")[0] }
    </Button>
        </div>
        </div>
                )
}

{/* Estado: Éxito */ }
{
    state === "success" && (
        <div className="p-6 text-center py-12" >
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4" >
                <span className="material-symbols-outlined text-green-600 text-3xl" > check </span>
                    </div>
                    < h2 className = "text-xl font-bold text-green-600 mb-2" >
                            ¡Listo!
        </h2>
        < p className = "text-gray-500" >
            Conectando con el chat...
    </p>
        </div>
                )
}
</DialogContent>
    </Dialog>
    )
}

2.2 API Route: Identify Customer
Archivo: src / app / api / store / [slug] / identify / route.ts
typescriptimport { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()
        const { name, phone } = body

        // Validación
        if (!name?.trim()) {
            return NextResponse.json(
                { error: "El nombre es requerido" },
                { status: 400 }
            )
        }

        if (!phone?.trim()) {
            return NextResponse.json(
                { error: "El WhatsApp es requerido" },
                { status: 400 }
            )
        }

        // Limpiar teléfono (solo números y +)
        const cleanPhone = phone.replace(/[^\d+]/g, "")

        const supabase = await createClient()

        // Obtener organización
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json(
                { error: "Tienda no encontrada" },
                { status: 404 }
            )
        }

        // Buscar cliente existente por teléfono
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id, full_name, phone, email, metadata, total_orders, total_spent")
            .eq("organization_id", organization.id)
            .eq("phone", cleanPhone)
            .single()

        if (existingCustomer) {
            // Cliente existente - actualizar última interacción
            await supabase
                .from("customers")
                .update({
                    updated_at: new Date().toISOString(),
                    // Opcionalmente actualizar el nombre si es diferente
                    // full_name: name.trim()
                })
                .eq("id", existingCustomer.id)

            return NextResponse.json({
                customer: {
                    id: existingCustomer.id,
                    full_name: existingCustomer.full_name,
                    phone: existingCustomer.phone,
                    email: existingCustomer.email,
                    totalOrders: existingCustomer.total_orders || 0,
                    totalSpent: existingCustomer.total_spent || 0
                },
                isNew: false,
                isReturning: true
            })
        }

        // Crear nuevo cliente
        const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({
                organization_id: organization.id,
                full_name: name.trim(),
                phone: cleanPhone,
                metadata: {
                    source: "chat_gate",
                    first_visit: new Date().toISOString()
                }
            })
            .select("id, full_name, phone, email")
            .single()

        if (createError) {
            console.error("Error creating customer:", createError)
            return NextResponse.json(
                { error: "Error al registrar. Intenta de nuevo." },
                { status: 500 }
            )
        }

        return NextResponse.json({
            customer: {
                id: newCustomer.id,
                full_name: newCustomer.full_name,
                phone: newCustomer.phone,
                email: newCustomer.email,
                totalOrders: 0,
                totalSpent: 0
            },
            isNew: true,
            isReturning: false
        })

    } catch (error: any) {
        console.error("Error in identify:", error)
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    }
}

2.3 Actualizar Store Page
Archivo: src / app / store / [slug] / page.tsx
Agregar el modal y la lógica de identificación:
typescript"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"
// ... otros imports existentes

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const router = useRouter()

    const [showGateModal, setShowGateModal] = useState(false)
    const [organization, setOrganization] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    // ... otros estados existentes

    // Cargar datos de la tienda
    useEffect(() => {
        // ... lógica existente de carga
    }, [slug])

    // Función para iniciar chat
    const handleStartChat = (productId?: string) => {
        // Verificar si ya está identificado
        const customerId = localStorage.getItem(`customer_${slug}`)

        if (customerId) {
            // Ya identificado, ir al chat
            const chatUrl = productId
                ? `/chat/${slug}?product=${productId}`
                : `/chat/${slug}`
            router.push(chatUrl)
        } else {
            // Mostrar modal de identificación
            setShowGateModal(true)
        }
    }

    // Callback cuando el usuario se identifica
    const handleCustomerIdentified = (customer: any) => {
        // Guardar en localStorage
        localStorage.setItem(`customer_${slug}`, customer.id)
        localStorage.setItem(`customer_name_${slug}`, customer.full_name)

        // Cerrar modal e ir al chat
        setShowGateModal(false)
        router.push(`/chat/${slug}`)
    }

    return (
        <div>
        {/* ... contenido existente del store ... */ }

            {/* Botón de Iniciar Chat (ejemplo) */ }
    <button
                onClick={ () => handleStartChat() }
    className = "bg-primary text-white px-6 py-3 rounded-lg"
        >
        Iniciar Chat
            </button>

    {/* Botón en producto (ejemplo) */ }
    {
        products.map((product) => (
            <div key= { product.id } >
            {/* ... card del producto ... */ }
            < button
                        onClick = {() => handleStartChat(product.id)}
    className = "..."
        >
        Chatear para Comprar
            </button>
            </div>
            ))
}

{/* Modal de identificación */ }
<CustomerGateModal
                isOpen={ showGateModal }
onClose = {() => setShowGateModal(false)}
onIdentified = { handleCustomerIdentified }
slug = { slug }
organizationName = { organization?.name }
    />
    </div>
    )
}

2.4 Actualizar Chat Page
Archivo: src / app / chat / [slug] / page.tsx
Modificar para usar el customer_id del localStorage:
typescript"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
// ... otros imports

export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const router = useRouter()

    const [customerId, setCustomerId] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    // ... otros estados

    useEffect(() => {
        // Verificar que el usuario esté identificado
        const storedCustomerId = localStorage.getItem(`customer_${slug}`)
        const storedCustomerName = localStorage.getItem(`customer_name_${slug}`)
        const storedChatId = localStorage.getItem(`chatId_${slug}`)

        if (!storedCustomerId) {
            // No identificado, redirigir al store
            router.push(`/store/${slug}?action=chat`)
            return
        }

        setCustomerId(storedCustomerId)
        setCustomerName(storedCustomerName)

        if (storedChatId) {
            setChatId(storedChatId)
        }

        // Inicializar chat
        initializeChat(storedCustomerId, storedChatId)
    }, [slug, router])

    const initializeChat = async (custId: string, existingChatId: string | null) => {
        try {
            // Si no hay chat existente, crear uno nuevo
            if (!existingChatId) {
                const response = await fetch(`/api/store/${slug}/chat/init`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerId: custId })
                })

                const data = await response.json()

                if (data.chatId) {
                    setChatId(data.chatId)
                    localStorage.setItem(`chatId_${slug}`, data.chatId)
                }

                // Mensaje de bienvenida personalizado
                if (data.greeting) {
                    setMessages([{
                        id: "1",
                        role: "assistant",
                        content: data.greeting,
                        timestamp: new Date()
                    }])
                }
            } else {
                // Cargar mensajes existentes
                await loadExistingChat(existingChatId)
            }

            setIsInitializing(false)
        } catch (error) {
            console.error("Error initializing chat:", error)
            setIsInitializing(false)
        }
    }

    const loadExistingChat = async (chatId: string) => {
        // Cargar mensajes del chat existente
        const response = await fetch(`/api/store/${slug}/chat/${chatId}/messages`)
        const data = await response.json()

        if (data.messages) {
            setMessages(data.messages.map((m: any) => ({
                id: m.id,
                role: m.sender_type === "user" ? "user" : "assistant",
                content: m.content,
                timestamp: new Date(m.created_at)
            })))
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chatId) return

        // ... resto de la lógica existente, pero ahora el chatId 
        // ya está vinculado al customerId desde el backend

        const response = await fetch("/api/ai-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: input.trim(),
                chatId,
                slug,
                customerId // Enviar customerId explícitamente
            })
        })

        // ... resto del manejo de respuesta
    }

    if (isInitializing) {
        return (
            <div className= "flex items-center justify-center h-screen" >
            <div className="text-center" >
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500" > Conectando...</p>
                        </div>
                        </div>
        )
    }

    return (
        // ... resto del JSX existente
    )
}

2.5 API Route: Initialize Chat
Archivo: src / app / api / store / [slug] / chat / init / route.ts
typescriptimport { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    try {
        const body = await request.json()
        const { customerId } = body

        if (!customerId) {
            return NextResponse.json(
                { error: "Customer ID requerido" },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Obtener organización
        const { data: organization } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (!organization) {
            return NextResponse.json(
                { error: "Tienda no encontrada" },
                { status: 404 }
            )
        }

        // Obtener cliente
        const { data: customer } = await supabase
            .from("customers")
            .select("id, full_name, total_orders")
            .eq("id", customerId)
            .single()

        if (!customer) {
            return NextResponse.json(
                { error: "Cliente no encontrado" },
                { status: 404 }
            )
        }

        // Buscar agente bot disponible
        const { data: agent } = await supabase
            .from("agents")
            .select("id, name, configuration")
            .eq("organization_id", organization.id)
            .eq("type", "bot")
            .eq("status", "available")
            .single()

        if (!agent) {
            return NextResponse.json(
                { error: "No hay agentes disponibles" },
                { status: 503 }
            )
        }

        // Crear nuevo chat vinculado al customer
        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .insert({
                organization_id: organization.id,
                customer_id: customer.id,
                assigned_agent_id: agent.id,
                status: "active"
            })
            .select("id")
            .single()

        if (chatError) {
            console.error("Error creating chat:", chatError)
            return NextResponse.json(
                { error: "Error al crear chat" },
                { status: 500 }
            )
        }

        // Generar saludo personalizado
        const firstName = customer.full_name.split(" ")[0]
        const isReturning = customer.total_orders > 0

        let greeting: string
        if (isReturning) {
            greeting = `¡Hola ${firstName}! Qué gusto verte de nuevo. ¿En qué puedo ayudarte hoy?`
        } else {
            greeting = agent.configuration?.greeting?.replace("{name}", firstName)
                || `¡Hola ${firstName}! Bienvenido/a a ${organization.name}. Soy ${agent.name}, ¿qué estás buscando hoy?`
        }

        // Guardar mensaje de bienvenida
        await supabase.from("messages").insert({
            chat_id: chat.id,
            sender_type: "bot",
            sender_id: agent.id,
            content: greeting,
            metadata: { type: "greeting" }
        })

        return NextResponse.json({
            chatId: chat.id,
            greeting,
            agent: {
                name: agent.name,
                avatar: agent.avatar_url
            }
        })

    } catch (error: any) {
        console.error("Error initializing chat:", error)
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        )
    }
}

Resumen de archivos a crear / modificar
ArchivoAcciónDescripciónsrc / components / store / customer - gate - modal.tsxCREARModal de identificaciónsrc / app / api / store / [slug] / identify / route.tsCREARAPI para identificar / crear customersrc / app / api / store / [slug] / chat / init / route.tsCREARAPI para inicializar chat con customersrc / app / store / [slug] / page.tsxMODIFICARAgregar lógica del modalsrc / app / chat / [slug] / page.tsxMODIFICARVerificar identificación, usar customerId