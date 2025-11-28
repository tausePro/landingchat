//
TAREAS EN ORDEN DE PRIORIDAD
TAREA 1: Arreglar el Chat con IA (CRÍTICO)
Problema actual
El chat retorna "Lo siento, tuve un problema procesando tu mensaje" porque el modelo de Claude está incorrecto.
Solución
1.1 Cambiar el modelo en src/lib/ai/chat-agent.ts
Buscar TODAS las líneas que digan model: y cambiar a:
typescriptmodel: "claude-sonnet-4-20250514"
```

Hay 2 lugares en el archivo donde aparece. Ambos deben usar este modelo exacto.

**1.2 Verificar API Key**

En `.env.local` debe existir:
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
1.3 Agregar mejor logging de errores
En src/lib/ai/chat-agent.ts, en el catch del error, agregar:
typescript} catch (error: any) {
    console.error("[ChatAgent] ========== ERROR COMPLETO ==========")
    console.error("[ChatAgent] Message:", error.message)
    console.error("[ChatAgent] Name:", error.name)
    console.error("[ChatAgent] Status:", error.status)
    console.error("[ChatAgent] Stack:", error.stack)
    console.error("[ChatAgent] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error("[ChatAgent] =====================================")
    
    // ... resto del código existente
}
1.4 Probar
bashnpm run dev
# Abrir http://localhost:3000/chat/demo-store
# Enviar un mensaje
# Revisar la terminal del servidor (NO el browser)
Si sigue fallando, copiar el ERROR COMPLETO de la terminal y compartirlo.

TAREA 2: Implementar Subdominios
Objetivo
Cambiar de landingchat.co/store/tienda a tienda.landingchat.co
2.1 Actualizar Middleware
Archivo: src/middleware.ts
Reemplazar TODO el contenido con:
typescriptimport { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const pathname = request.nextUrl.pathname

    // ============================================
    // RUTAS QUE NUNCA SE REESCRIBEN
    // ============================================
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/onboarding') ||
        pathname.includes('.') // archivos estáticos
    ) {
        return handleAuth(request)
    }

    // ============================================
    // DETECTAR SLUG DE LA TIENDA
    // ============================================
    let slug: string | null = null

    // === DESARROLLO ===
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        // Opción 1: Query param → localhost:3000?store=demo-store
        slug = request.nextUrl.searchParams.get('store')

        // Opción 2: Subdominio local → demo-store.localhost:3000
        if (!slug) {
            const hostPart = hostname.split(':')[0] // quitar puerto
            const parts = hostPart.split('.')
            if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
                slug = parts[0]
            }
        }

        // Opción 3: Path tradicional → localhost:3000/store/demo-store
        if (!slug && (pathname.startsWith('/store/') || pathname.startsWith('/chat/'))) {
            return handleAuth(request)
        }
    }
    // === PRODUCCIÓN ===
    else {
        const parts = hostname.split('.')

        // tienda.landingchat.co → ['tienda', 'landingchat', 'co']
        if (parts.length >= 3) {
            const subdomain = parts[0]

            // Ignorar subdominios reservados
            const reserved = ['www', 'app', 'api', 'dashboard', 'admin', 'wa']
            if (!reserved.includes(subdomain)) {
                slug = subdomain
            }
        }
    }

    // Si no hay slug, continuar normal (landing page principal)
    if (!slug) {
        return handleAuth(request)
    }

    // ============================================
    // REESCRIBIR RUTAS PARA LA TIENDA
    // ============================================
    
    // tienda.landingchat.co/ → /store/tienda
    if (pathname === '/' || pathname === '') {
        const url = new URL(`/store/${slug}`, request.url)
        // Preservar query params
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // tienda.landingchat.co/chat → /chat/tienda
    if (pathname === '/chat' || pathname === '/chat/') {
        const url = new URL(`/chat/${slug}`, request.url)
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'store') url.searchParams.set(key, value)
        })
        return NextResponse.rewrite(url)
    }

    // tienda.landingchat.co/p/123 → /store/tienda/p/123
    if (pathname.startsWith('/p/')) {
        return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
    }

    // Cualquier otra ruta bajo el subdominio
    return NextResponse.rewrite(new URL(`/store/${slug}${pathname}`, request.url))
}

// ============================================
// FUNCIÓN DE AUTENTICACIÓN (existente)
// ============================================
async function handleAuth(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Rutas públicas
    const publicRoutes = ['/', '/store', '/chat', '/api', '/auth']
    const isPublicRoute = publicRoutes.some(route => 
        request.nextUrl.pathname === route || 
        request.nextUrl.pathname.startsWith(route + '/')
    )

    // Redirigir si no hay usuario y es ruta protegida
    if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
2.2 Probar en local
bash# Método fácil (query param):
http://localhost:3000?store=demo-store
http://localhost:3000/chat?store=demo-store

# Método subdominio (editar /etc/hosts primero):
# Agregar línea: 127.0.0.1 demo-store.localhost
http://demo-store.localhost:3000
http://demo-store.localhost:3000/chat
```

### 2.3 Configuración en producción (Felipe lo hace)

**DNS del dominio:**
```
*.landingchat.co  →  CNAME  →  cname.vercel-dns.com
```

**Vercel (Settings > Domains):**
```
Agregar: *.landingchat.co

TAREA 3: Modal de Identificación de Cliente
Objetivo
Antes de entrar al chat, pedir nombre y WhatsApp en un modal.
3.1 Crear componente del modal
Archivo: src/components/store/customer-gate-modal.tsx
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
    const [returningCustomer, setReturningCustomer] = useState<Customer | null>(null)
    
    const nameInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen && state === "register") {
            setTimeout(() => nameInputRef.current?.focus(), 100)
        }
    }, [isOpen, state])

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

            if (data.isReturning && data.customer.full_name.toLowerCase() !== name.trim().toLowerCase()) {
                setReturningCustomer(data.customer)
                setState("returning")
                return
            }

            setState("success")
            setTimeout(() => {
                onIdentified({ ...data.customer, isNew: data.isNew })
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
                onIdentified({ ...returningCustomer, isNew: false })
            }, 1000)
        }
    }

    const handleNotMe = () => {
        setReturningCustomer(null)
        setPhone("")
        setState("register")
    }

    const formatPhoneDisplay = (phone: string) => {
        if (phone.length < 8) return phone
        const visible = phone.slice(-4)
        return `${phone.slice(0, 4)} *** ${visible}`
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
                {/* Estado: Registro */}
                {(state === "register" || state === "loading") && (
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="p-6 pb-4 text-center">
                            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-primary text-2xl">chat</span>
                            </div>
                            <DialogTitle className="text-xl font-bold">
                                ¡Hola! Antes de chatear...
                            </DialogTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                Cuéntanos un poco sobre ti para darte una mejor atención
                            </p>
                        </DialogHeader>

                        <div className="px-6 pb-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tu nombre</Label>
                                <Input
                                    ref={nameInputRef}
                                    id="name"
                                    type="text"
                                    placeholder="¿Cómo te llamas?"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                        if (errors.name) setErrors({ ...errors, name: undefined })
                                    }}
                                    className={errors.name ? "border-red-500" : ""}
                                    disabled={state === "loading"}
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-500">{errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Tu WhatsApp</Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={countryCode}
                                        onValueChange={setCountryCode}
                                        disabled={state === "loading"}
                                    >
                                        <SelectTrigger className="w-[110px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COUNTRY_CODES.map((c) => (
                                                <SelectItem key={c.code} value={c.code}>
                                                    <span className="flex items-center gap-2">
                                                        <span>{c.flag}</span>
                                                        <span>{c.code}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="300 123 4567"
                                        value={phone}
                                        onChange={(e) => {
                                            setPhone(e.target.value)
                                            if (errors.phone) setErrors({ ...errors, phone: undefined })
                                        }}
                                        className={`flex-1 ${errors.phone ? "border-red-500" : ""}`}
                                        disabled={state === "loading"}
                                    />
                                </div>
                                {errors.phone && (
                                    <p className="text-sm text-red-500">{errors.phone}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={state === "loading"}
                            >
                                {state === "loading" ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Conectando...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Iniciar Chat
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </span>
                                )}
                            </Button>

                            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-sm">lock</span>
                                Tu información está segura
                            </p>
                        </div>
                    </form>
                )}

                {/* Estado: Cliente que regresa */}
                {state === "returning" && returningCustomer && (
                    <div className="p-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl font-bold text-primary">
                                {returningCustomer.full_name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        
                        <h2 className="text-xl font-bold mb-1">
                            ¡Hola de nuevo! 👋
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Te recordamos de tu última visita
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                            <p className="font-semibold">{returningCustomer.full_name}</p>
                            <p className="text-sm text-gray-500">
                                {formatPhoneDisplay(returningCustomer.phone)}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button className="w-full" onClick={handleContinueAsReturning}>
                                Continuar como {returningCustomer.full_name.split(" ")[0]}
                            </Button>
                            <Button variant="ghost" className="w-full text-gray-500" onClick={handleNotMe}>
                                No soy {returningCustomer.full_name.split(" ")[0]}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Estado: Éxito */}
                {state === "success" && (
                    <div className="p-6 text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-green-600 text-3xl">check</span>
                        </div>
                        <h2 className="text-xl font-bold text-green-600 mb-2">¡Listo!</h2>
                        <p className="text-gray-500">Conectando con el chat...</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
3.2 Crear API de identificación
Archivo: src/app/api/store/[slug]/identify/route.ts
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

        if (!name?.trim()) {
            return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
        }

        if (!phone?.trim()) {
            return NextResponse.json({ error: "El WhatsApp es requerido" }, { status: 400 })
        }

        const cleanPhone = phone.replace(/[^\d+]/g, "")
        const supabase = await createClient()

        // Obtener organización
        const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (orgError || !organization) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
        }

        // Buscar cliente existente
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id, full_name, phone, email, total_orders, total_spent")
            .eq("organization_id", organization.id)
            .eq("phone", cleanPhone)
            .single()

        if (existingCustomer) {
            await supabase
                .from("customers")
                .update({ updated_at: new Date().toISOString() })
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
            return NextResponse.json({ error: "Error al registrar" }, { status: 500 })
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
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
3.3 Crear API para inicializar chat
Archivo: src/app/api/store/[slug]/chat/init/route.ts
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
            return NextResponse.json({ error: "Customer ID requerido" }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: organization } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (!organization) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
        }

        const { data: customer } = await supabase
            .from("customers")
            .select("id, full_name, total_orders")
            .eq("id", customerId)
            .single()

        if (!customer) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
        }

        const { data: agent } = await supabase
            .from("agents")
            .select("id, name, configuration, avatar_url")
            .eq("organization_id", organization.id)
            .eq("type", "bot")
            .eq("status", "available")
            .single()

        if (!agent) {
            return NextResponse.json({ error: "No hay agentes disponibles" }, { status: 503 })
        }

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
            return NextResponse.json({ error: "Error al crear chat" }, { status: 500 })
        }

        const firstName = customer.full_name.split(" ")[0]
        const isReturning = (customer.total_orders || 0) > 0
        
        let greeting = isReturning
            ? `¡Hola ${firstName}! Qué gusto verte de nuevo. ¿En qué puedo ayudarte hoy?`
            : `¡Hola ${firstName}! Bienvenido/a a ${organization.name}. Soy ${agent.name}, ¿qué estás buscando hoy?`

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
                id: agent.id,
                name: agent.name,
                avatar_url: agent.avatar_url
            }
        })

    } catch (error: any) {
        console.error("Error initializing chat:", error)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
3.4 Actualizar Store Page
Archivo: src/app/store/[slug]/page.tsx
Agregar el modal y la lógica. En el componente existente, agregar:
typescript// Importar al inicio
import { useState } from "react"
import { useRouter } from "next/navigation"
import { CustomerGateModal } from "@/components/store/customer-gate-modal"

// Dentro del componente, agregar estados:
const [showGateModal, setShowGateModal] = useState(false)
const router = useRouter()

// Función para manejar click en "Iniciar Chat"
const handleStartChat = (productId?: string) => {
    const customerId = localStorage.getItem(`customer_${slug}`)
    
    if (customerId) {
        const url = productId ? `/chat/${slug}?product=${productId}` : `/chat/${slug}`
        router.push(url)
    } else {
        setShowGateModal(true)
    }
}

// Callback cuando se identifica
const handleCustomerIdentified = (customer: any) => {
    localStorage.setItem(`customer_${slug}`, customer.id)
    localStorage.setItem(`customer_name_${slug}`, customer.full_name)
    setShowGateModal(false)
    router.push(`/chat/${slug}`)
}

// En el JSX, agregar el modal al final (antes del último </div>):
<CustomerGateModal
    isOpen={showGateModal}
    onClose={() => setShowGateModal(false)}
    onIdentified={handleCustomerIdentified}
    slug={slug}
    organizationName={organization?.name}
/>

// Y cambiar los botones de "Iniciar Chat" para usar handleStartChat():
<Button onClick={() => handleStartChat()}>Iniciar Chat</Button>
<Button onClick={() => handleStartChat(product.id)}>Chatear para Comprar</Button>
3.5 Actualizar Chat Page
Archivo: src/app/chat/[slug]/page.tsx
Modificar el inicio para verificar identificación:
typescript// Al inicio del useEffect principal, agregar:
useEffect(() => {
    const customerId = localStorage.getItem(`customer_${slug}`)
    const customerName = localStorage.getItem(`customer_name_${slug}`)
    
    if (!customerId) {
        // No identificado, redirigir al store
        router.push(`/store/${slug}?action=chat`)
        return
    }
    
    // Guardar en estado si necesitas usarlo
    setCustomerId(customerId)
    setCustomerName(customerName)
    
    // ... resto del código existente
}, [slug])

TAREA 4: Migración de Base de Datos
Ejecutar en Supabase SQL Editor
sql-- =============================================
-- MIGRACIÓN: MVP LandingChat
-- =============================================

-- 1. Agregar customer_id a chats (si no existe)
ALTER TABLE chats ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON customers(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_org_email ON customers(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_chats_customer ON chats(customer_id);
CREATE INDEX IF NOT EXISTS idx_chats_org_status ON chats(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);

-- 3. Campos adicionales en customers (si no existen)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent decimal(10,2) DEFAULT 0;

-- 4. Verificar que todo está OK
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('customers', 'chats') 
AND column_name IN ('customer_id', 'total_orders', 'total_spent', 'phone')
ORDER BY table_name, column_name;
```

---

## 📁 ESTRUCTURA DE ARCHIVOS A CREAR/MODIFICAR
```
src/
├── middleware.ts                              [MODIFICAR]
├── components/
│   └── store/
│       └── customer-gate-modal.tsx            [CREAR]
├── app/
│   ├── api/
│   │   ├── ai-chat/
│   │   │   └── route.ts                       [VERIFICAR MODELO]
│   │   └── store/
│   │       └── [slug]/
│   │           ├── identify/
│   │           │   └── route.ts               [CREAR]
│   │           └── chat/
│   │               └── init/
│   │                   └── route.ts           [CREAR]
│   ├── store/
│   │   └── [slug]/
│   │       └── page.tsx                       [MODIFICAR]
│   └── chat/
│       └── [slug]/
│           └── page.tsx                       [MODIFICAR]
└── lib/
    └── ai/
        └── chat-agent.ts                      [VERIFICAR MODELO]
```

---

## ✅ CHECKLIST DE VERIFICACIÓN
```
[ ] 1. Chat funciona (modelo correcto, sin errores)
[ ] 2. Subdominios funcionan en local (?store=demo-store)
[ ] 3. Modal de identificación aparece al click en "Iniciar Chat"
[ ] 4. Cliente se guarda en tabla customers
[ ] 5. Cliente se guarda en localStorage
[ ] 6. Chat inicia con customer_id vinculado
[ ] 7. Agente saluda por nombre
[ ] 8. Cliente que vuelve es reconocido

🧪 CÓMO PROBAR
bash# 1. Iniciar servidor
npm run dev

# 2. Abrir store
http://localhost:3000?store=demo-store

# 3. Click en "Iniciar Chat"
# → Debe aparecer modal pidiendo nombre y WhatsApp

# 4. Llenar datos y enviar
# → Debe crear customer en DB
# → Debe ir al chat

# 5. En el chat, enviar mensaje
# → Debe responder el agente IA

# 6. Abrir DevTools > Application > Local Storage
# → Debe existir customer_demo-store con el ID

# 7. Cerrar y volver a abrir el chat
# → NO debe pedir datos de nuevo
# → Debe ir directo al chat