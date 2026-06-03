"use client"

import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { getStoredUUID, getStoredString, setStoredUUID } from "@/lib/utils/storage"
import { ChatLayout } from "@/components/layout/chat-layout"

import { useState, useEffect, use, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart-store"
import { getTrackingParams, useTrackingParams } from "@/hooks/use-tracking-params"
import { useTracking } from "@/components/analytics/tracking-provider"
import { getStoreProducts } from "./actions"
import { StoreHeader } from "@/components/store/store-header"
import { ChatProductCard } from "@/components/chat/chat-product-card"
import { CartSidebar } from "@/components/chat/cart-sidebar"
import { CartDrawer } from "../components/cart-drawer"
import { ChatPayBar } from "@/components/chat/chat-pay-bar"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import type { CSSProperties } from "react"

interface Product {
    id: string
    name: string
    price: number
    sale_price?: number | null
    image_url: string
    description: string
    stock: number
    categories?: string[]
}

interface MediaAttachment {
    id: string
    name: string
    file_url: string
    file_type: string
    file_name: string
    category: string
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    product?: Product
    products?: Product[] // Multiple products for carousel
    mediaAttachments?: MediaAttachment[]
    timestamp: Date
}

interface Agent {
    id?: string
    name?: string
    avatar_url?: string | null
    [key: string]: unknown
}

interface ChatOrganizationSettings {
    branding?: {
        primaryColor?: string
        logoUrl?: string
        [key: string]: unknown
    }
    storefront?: {
        header?: {
            showStoreName?: boolean
            [key: string]: unknown
        }
        [key: string]: unknown
    }
    agent?: {
        name?: string
        avatar?: string
        [key: string]: unknown
    }
    [key: string]: unknown
}

interface ChatOrganization {
    name: string
    slug?: string
    settings?: ChatOrganizationSettings | null
    [key: string]: unknown
}

interface ShippingConfig {
    free_shipping_enabled: boolean
    free_shipping_min_amount: number | null
    free_shipping_zones: string[] | null
    default_shipping_rate: number
}

interface AddedToCartActionData {
    product_id?: string
    variant_id?: string | null
    variant_title?: string | null
    name: string
    price: number
    unit_price?: number
    compare_at_price?: number | null
    quantity?: number
    image_url?: string | null
    categories?: string[]
}

interface ChatAction {
    type: string
    data?: {
        product?: Product
        added?: AddedToCartActionData
        media?: MediaAttachment
    } & Record<string, unknown>
}

interface ChatInitResponse {
    chatId?: string
    agent?: Agent
}

interface AIChatResponse {
    message: string
    actions?: ChatAction[]
}

interface StoredMessage extends Omit<Message, "timestamp"> {
    timestamp: string
}

type CssWithVariables = CSSProperties & {
    "--tw-ring-color"?: string
    "--hover-color"?: string
}

export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const isSubdomain = useIsSubdomain()
    const router = useRouter()
    const tracking = useTracking()

    const [customerId, setCustomerId] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)

    const [input, setInput] = useState("")
    const [products, setProducts] = useState<Product[]>([])
    const [agent, setAgent] = useState<Agent | null>(null)
    const [organization, setOrganization] = useState<ChatOrganization | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [customerChats, setCustomerChats] = useState<Array<{ id: string; title: string; created_at: string; updated_at?: string }>>([])
    const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { addItem, items, toggleCart, setIsOpen: setCartOpen, total } = useCartStore()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const initializationRef = useRef(false)
    const processedProductIdRef = useRef<string | null>(null)
    const trackedProactiveNudgeChatRef = useRef<string | null>(null)

    useTrackingParams(slug)

    const resetStorefrontState = useCallback(() => {
        try {
            localStorage.removeItem(`customer_${slug}`)
            localStorage.removeItem(`customer_name_${slug}`)
            localStorage.removeItem(`chatId_${slug}`)
        } catch (error) {
            console.error("Error clearing storefront state:", error)
        }

        processedProductIdRef.current = null
        setCustomerId(null)
        setCustomerName(null)
        setChatId(null)
        setCustomerChats([])
        setMessages([])
    }, [slug])

    const redirectToChatGate = useCallback(() => {
        resetStorefrontState()
        const storeUrl = getStoreLink('/?action=chat', isSubdomain, slug)
        router.push(storeUrl)
    }, [isSubdomain, resetStorefrontState, router, slug])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const fetchHistory = useCallback(async (id: string): Promise<"loaded" | "missing" | "invalid-session"> => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/${id}/messages`)
            if (res.status === 401 || res.status === 403) {
                redirectToChatGate()
                return "invalid-session"
            }
            if (!res.ok) return "missing"

            const historyData = await res.json()
            if (historyData.messages) {
                const parsedMessages = (historyData.messages as StoredMessage[]).map((m) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }))
                setMessages(parsedMessages)
                return "loaded"
            }
            return "missing"
        } catch (e) {
            console.error("Error fetching history:", e)
            return "missing"
        }
    }, [redirectToChatGate, slug])

    const initializeChat = useCallback(async (custId: string, existingChatId: string | null, loadedProducts: Product[]) => {
        let currentChatId: string | null = null

        // Si hay un ID de chat existente, intentar retomarlo
        if (existingChatId) {
            const historyLoaded = await fetchHistory(existingChatId)

            if (historyLoaded === "loaded") {
                // Chat retomado exitosamente
                setChatId(existingChatId)
                currentChatId = existingChatId

                // Verificar si hay contexto de producto nuevo para inyectar en la conversación existente
                const urlParams = new URLSearchParams(window.location.search)
                const productId = urlParams.get('product')

                if (!productId) {
                    setIsInitializing(false)
                    return
                }
                // Si hay producto, continuamos para procesarlo abajo...
            } else if (historyLoaded === "invalid-session") {
                setIsInitializing(false)
                return
            } else {
                // Si falló cargar el historial (ej: chat eliminado), continuar para crear uno nuevo
                console.log("Chat existente no válido, creando uno nuevo...")
                setChatId(null) // Reset chatId state
                localStorage.removeItem(`chatId_${slug}`)
            }
        }

        try {
            if (!currentChatId) {
                const response = await fetch(`/api/store/${slug}/chat/init`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerId: custId })
                })

                if (response.status === 401 || response.status === 403 || response.status === 404) {
                    redirectToChatGate()
                    return
                }
                if (!response.ok) {
                    throw new Error("Failed to init chat")
                }

                const data = await response.json() as ChatInitResponse

                if (data.chatId) {
                    currentChatId = data.chatId
                    setChatId(data.chatId)
                    setStoredUUID(`chatId_${slug}`, data.chatId)

                    if (data.agent) {
                        setAgent((prev) => ({ ...(prev ?? {}), ...data.agent }))
                    }

                    // Cargar historial de mensajes (incluyendo el saludo inicial)
                    await fetchHistory(data.chatId)
                }
            }

            if (currentChatId) {
                setIsInitializing(false) // Desbloquear UI inmediatamente

                // Si hay un producto en la URL, mostrar ese producto con contexto en background
                const urlParams = new URLSearchParams(window.location.search)
                const productId = urlParams.get('product')
                const context = urlParams.get('context')
                const trackingParams = getTrackingParams(slug)
                const isProactiveNudgeEntry = trackingParams.entry_point === "proactive_nudge" && Boolean(trackingParams.proactive_nudge_id)

                if (isProactiveNudgeEntry && trackedProactiveNudgeChatRef.current !== currentChatId) {
                    trackedProactiveNudgeChatRef.current = currentChatId
                    tracking.trackEvent("proactive_nudge_chat_started", {
                        sourceChannel: "chat",
                        contentIds: trackingParams.proactive_nudge_product_id ? [trackingParams.proactive_nudge_product_id] : productId ? [productId] : [],
                        properties: {
                            chatId: currentChatId,
                            entryPoint: "proactive_nudge",
                            proactiveNudgeId: trackingParams.proactive_nudge_id,
                            proactiveNudgeProductId: trackingParams.proactive_nudge_product_id,
                            proactiveNudgeProductName: trackingParams.proactive_nudge_product_name,
                            contentName: trackingParams.proactive_nudge_product_name,
                            destination: trackingParams.proactive_nudge_destination,
                        },
                    })
                }

                if (productId) {
                    // Evitar procesar el mismo producto dos veces en la misma sesión
                    if (processedProductIdRef.current === productId) {
                        console.log("Producto ya procesado en esta sesión, omitiendo mensaje inicial.")
                        return
                    }
                    processedProductIdRef.current = productId

                    // Buscar el producto para obtener su nombre y hacer el mensaje más explícito
                    // Esto ayuda al agente a diferenciar del contexto histórico
                    const targetProduct = loadedProducts.find(p => p.id === productId)
                    const productName = targetProduct ? targetProduct.name : 'este producto'

                    // Activar indicador de "escribiendo"
                    setIsLoading(true)

                    // Llamada no bloqueante (Background processing)
                    fetch('/api/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: context ? `Hola, me interesa ${productName} con: ${decodeURIComponent(context)}` : `Hola, me interesa ${productName}`,
                            chatId: currentChatId,
                            slug,
                            customerId: custId,
                            currentProductId: productId,
                            context: context ? decodeURIComponent(context) : undefined,
                            entryPoint: isProactiveNudgeEntry ? "proactive_nudge" : undefined,
                            proactiveNudgeId: trackingParams.proactive_nudge_id,
                            proactiveNudgeProductId: trackingParams.proactive_nudge_product_id,
                            proactiveNudgeProductName: trackingParams.proactive_nudge_product_name,
                            proactiveNudgeDestination: trackingParams.proactive_nudge_destination,
                        })
                    }).then(async (aiResponse) => {
                        if (aiResponse.status === 401 || aiResponse.status === 403) {
                            redirectToChatGate()
                            return
                        }

                        if (aiResponse.status === 404) {
                            localStorage.removeItem(`chatId_${slug}`)
                            setChatId(null)
                            return
                        }

                        if (!aiResponse.ok) {
                            return
                        }

                        const aiData = await aiResponse.json() as AIChatResponse

                        // Procesar acciones (show_product)
                        const collectedProducts: Product[] = []
                        if (aiData.actions && aiData.actions.length > 0) {
                            for (const action of aiData.actions) {
                                if (action.type === 'show_product' && action.data?.product) {
                                    collectedProducts.push(action.data.product)
                                }
                            }
                        }

                        if (collectedProducts.length > 0) {
                            const productMsg: Message = {
                                id: "product-" + Date.now(),
                                role: 'assistant',
                                content: aiData.message,
                                products: collectedProducts.length > 1 ? collectedProducts : undefined,
                                product: collectedProducts.length === 1 ? collectedProducts[0] : undefined,
                                timestamp: new Date()
                            }
                            setMessages(prev => [...prev, productMsg])
                        } else {
                            // Si no hay productos, solo mostrar el mensaje
                            const aiMsg: Message = {
                                id: "ai-init-" + Date.now(),
                                role: 'assistant',
                                content: aiData.message,
                                timestamp: new Date()
                            }
                            setMessages(prev => [...prev, aiMsg])
                        }
                    }).catch(err => {
                        console.error("Error calling AI with product context:", err)
                    }).finally(() => {
                        setIsLoading(false)
                    })
                }
            } else {
                setError("No se pudo iniciar la conversación.")
                setIsInitializing(false)
            }
        } catch (error) {
            console.error("Error initializing chat:", error)
            setError("Error al conectar con el chat.")
            setIsInitializing(false)
        }
    }, [fetchHistory, redirectToChatGate, slug, tracking])

    useEffect(() => {
        if (initializationRef.current) return
        initializationRef.current = true

        const storedCustomerId = getStoredUUID(`customer_${slug}`)
        const storedCustomerName = getStoredString(`customer_name_${slug}`)
        const storedChatId = getStoredUUID(`chatId_${slug}`)

        if (!storedCustomerId) {
            const storeUrl = getStoreLink('/?action=chat', isSubdomain, slug)
            router.push(storeUrl)
            return
        }

        setCustomerId(storedCustomerId)
        setCustomerName(storedCustomerName)

        getStoreProducts(slug).then(async (data) => {
            if (data && data.organization) {
                setProducts(data.products)
                setOrganization(data.organization)
                if (data.agent) setAgent(data.agent)

                try {
                    const shippingRes = await fetch(`/api/store/${slug}/shipping-config`)
                    if (shippingRes.ok) {
                        const config = await shippingRes.json() as ShippingConfig
                        setShippingConfig(config)
                    }
                } catch (e) {
                    console.error("Error loading shipping config:", e)
                }

                initializeChat(storedCustomerId, storedChatId, data.products)
            } else {
                console.error("No se encontró la organización o hubo un error al cargar datos.")
                setError("No se pudo cargar la información de la tienda. Verifica que el enlace sea correcto.")
                setIsInitializing(false)
            }
        }).catch(err => {
            console.error("Error loading store data:", err)
            setError("Ocurrió un error de conexión. Por favor intenta de nuevo.")
            setIsInitializing(false)
        })
    }, [initializeChat, isSubdomain, router, slug])

    useEffect(() => {
        if (!customerId) return
        const fetchCustomerChats = async () => {
            try {
                const res = await fetch(`/api/store/${slug}/customer/${customerId}/chats`)
                if (res.status === 401 || res.status === 403) {
                    redirectToChatGate()
                    return
                }
                if (!res.ok) {
                    return
                }
                const data = await res.json()
                if (data.chats) {
                    setCustomerChats(data.chats)
                }
            } catch (e) {
                console.error("Error fetching customer chats:", e)
            }
        }
        fetchCustomerChats()
    }, [customerId, redirectToChatGate, slug])

    const handleSend = async (textOverride?: string) => {
        const textToSend = typeof textOverride === 'string' ? textOverride : input
        if (!textToSend.trim() || isLoading || !chatId || !customerId) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        if (!textOverride) setInput("")
        setIsLoading(true)

        try {
            const currentProductId = new URLSearchParams(window.location.search).get('product') || undefined
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: textToSend,
                    chatId,
                    slug,
                    customerId,
                    currentProductId,
                    // Sync frontend cart with backend
                    cartItems: items.map(item => ({
                        id: item.id,
                        product_id: item.product_id,
                        variant_id: item.variant_id,
                        variant_title: item.variant_title,
                        name: item.name,
                        product_name: item.product_name,
                        price: item.price,
                        unit_price: item.unit_price,
                        compare_at_price: item.compare_at_price,
                        quantity: item.quantity,
                        image_url: item.image_url,
                        categories: item.categories,
                    })),
                    // Si el chat viene desde una PDP, mantener ese producto como contexto activo
                })
            })

            if (response.status === 401 || response.status === 403) {
                redirectToChatGate()
                return
            }
            if (response.status === 404) {
                localStorage.removeItem(`chatId_${slug}`)
                setChatId(null)
            }
            if (!response.ok) {
                throw new Error('Failed to get response from AI')
            }

            const data = await response.json() as AIChatResponse

            // Process actions from AI
            const collectedProducts: Product[] = []
            const collectedMedia: MediaAttachment[] = []

            if (data.actions && data.actions.length > 0) {
                for (const action of data.actions) {
                    if (action.type === 'show_product' && action.data?.product) {
                        collectedProducts.push(action.data.product)
                    } else if (action.type === 'add_to_cart' && action.data?.added) {
                        // Producto agregado al carrito
                        const addedProduct = action.data.added
                        const matchedProduct = products.find((p) => p.name === addedProduct.name)
                        const productId = addedProduct.product_id ?? matchedProduct?.id

                        if (!productId) {
                            continue
                        }

                        addItem({
                            id: addedProduct.variant_id ?? productId,
                            product_id: productId,
                            variant_id: addedProduct.variant_id ?? null,
                            variant_title: addedProduct.variant_title ?? null,
                            name: addedProduct.name,
                            product_name: addedProduct.name,
                            price: addedProduct.price,
                            unit_price: addedProduct.unit_price ?? addedProduct.price,
                            compare_at_price: addedProduct.compare_at_price ?? null,
                            image_url: addedProduct.image_url ?? matchedProduct?.image_url,
                            categories: addedProduct.categories,
                        }, addedProduct.quantity || 1)
                    } else if (action.type === 'send_media' && action.data?.media) {
                        collectedMedia.push(action.data.media as MediaAttachment)
                    }
                }
            }

            // If we collected products, create a single message with them
            if (collectedProducts.length > 0) {
                const productMsg: Message = {
                    id: (Date.now() + Math.random()).toString(),
                    role: 'assistant',
                    content: data.message,
                    products: collectedProducts.length > 1 ? collectedProducts : undefined,
                    product: collectedProducts.length === 1 ? collectedProducts[0] : undefined,
                    mediaAttachments: collectedMedia.length > 0 ? collectedMedia : undefined,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, productMsg])
            }

            // Solo agregar mensaje de texto si NO hubo productos (para evitar duplicados)
            if (collectedProducts.length === 0) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.message,
                    mediaAttachments: collectedMedia.length > 0 ? collectedMedia : undefined,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, aiMsg])
            }

        } catch (error: unknown) {
            console.error('Error calling AI agent:', error)
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    // Navegación a checkout reutilizando el flujo existente del chat
    const goToCheckout = useCallback(() => {
        const params = new URLSearchParams({ from: 'chat' })
        if (chatId) params.set('chatId', chatId)
        router.push(`${getStoreLink('/checkout', isSubdomain, slug)}?${params.toString()}`)
    }, [chatId, isSubdomain, slug, router])

    // Calcular productos activos en la conversación para el Living Sidebar
    const activeProducts = messages
        .filter(m => m.product || (m.products && m.products.length > 0))
        .flatMap(m => m.products || (m.product ? [m.product] : []))
        .reduce<Product[]>((unique, item) => {
            return unique.some(u => u.id === item.id) ? unique : [...unique, item]
        }, [])

    // Smart Recommendations Logic
    // 1. Identify the most relevant category from the last active product
    const lastActiveProduct = activeProducts.length > 0 ? activeProducts[activeProducts.length - 1] : null

    let recommendedProducts: Product[] = []

    if (lastActiveProduct && lastActiveProduct.categories && Array.isArray(lastActiveProduct.categories) && lastActiveProduct.categories.length > 0) {
        // 2. Filter products by matching category, excluding current active products
        recommendedProducts = products.filter(p =>
            p.id !== lastActiveProduct.id && // Not the same product
            !activeProducts.find((ap) => ap.id === p.id) && // Not already in conversation
            p.categories?.some((c: string) => lastActiveProduct.categories?.includes(c)) // Matches any category
        ).slice(0, 5)
    }

    // 3. Fallback: If not enough recommendations, fill with other available products
    if (recommendedProducts.length < 5) {
        const fallback = products.filter(p =>
            !activeProducts.find((ap) => ap.id === p.id) &&
            !recommendedProducts.find(rp => rp.id === p.id)
        ).slice(0, 5 - recommendedProducts.length)

        recommendedProducts = [...recommendedProducts, ...fallback]
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900 flex-col gap-4 p-8 text-center">
                <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                    <span className="material-symbols-outlined text-3xl">error_outline</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Algo salió mal</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    Intentar de nuevo
                </button>
            </div>
        )
    }

    if (isInitializing || !organization) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Conectando con {agent?.name || 'el asistente'}...</p>
                </div>
            </div>
        )
    }

    const primaryColor = organization.settings?.branding?.primaryColor || "#2b7cee"
    const showStoreName = organization.settings?.storefront?.header?.showStoreName ?? true

    // Agent Settings
    const agentSettings = organization.settings?.agent || {}
    const agentName = agentSettings.name || agent?.name || 'Asistente'
    const agentAvatar = agentSettings.avatar || agent?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8bCAgEiNHMf7yLmgdo4Eurg3eWJYu2kbW3T_0NLJkhwPKQI0uBc2hI9DkwLseU3GBIQ3lZQaj7qqDrKE7OFoirx0C0Nlw8Poynk2naibQQ89RPvWM6n4FfDGwa9GMOHSZ6lURVzS1xH3d1b50c4xMLJk7A8NEUEvc0NiU58K6fetJ-LfldTWwYYb1b-2Sob5l4enhIUtGqOD0ePBgGiFmcz-jGyKBAq38346mulOzBOTu-juxtWlkXg3R2sT96vVBL2L0RkJPe2o'

    // Handler to delete a chat
    const handleDeleteChat = async (deleteChatId: string) => {
        if (!customerId || !confirm('¿Estás seguro de eliminar esta conversación?')) return

        try {
            const res = await fetch(`/api/store/${slug}/customer/${customerId}/chats/${deleteChatId}`, {
                method: 'DELETE'
            })
            if (res.status === 401 || res.status === 403) {
                redirectToChatGate()
                return
            }
            if (res.ok || res.status === 404) {
                // Remove from local state
                setCustomerChats(prev => prev.filter(c => c.id !== deleteChatId))
                // If we deleted the current chat, start a new one
                if (deleteChatId === chatId) {
                    localStorage.removeItem(`chatId_${slug}`)
                    setMessages([])
                    setChatId(null)
                }
            }
        } catch (e) {
            console.error('Error deleting chat:', e)
        }
    }

    return (
        <ChatLayout
            organizationName={organization.name || "LandingChat"}
            logoUrl={organization.settings?.branding?.logoUrl}
            chatHistory={customerChats}
            currentChatId={chatId || undefined}
            cartItemCount={items.length}
            activeProducts={activeProducts} // Living Sidebar Data
            recommendedProducts={recommendedProducts}
            shippingConfig={shippingConfig}
            customHeader={
                <StoreHeader
                    slug={slug}
                    organization={organization}
                    onStartChat={() => { }} // No-op in chat
                    primaryColor={primaryColor}
                    showStoreName={showStoreName}
                    isChatMode={true}
                    onCloseChat={() => {
                        const storeUrl = getStoreLink('/', isSubdomain, slug)
                        router.push(storeUrl)
                    }}
                />
            }
            onChatSelect={(selectedChatId) => {
                // Navigate to selected chat or reload messages
                if (selectedChatId !== chatId) {
                    setChatId(selectedChatId)
                    setStoredUUID(`chatId_${slug}`, selectedChatId)
                    fetchHistory(selectedChatId)
                }
            }}
            onNewConversation={() => {
                // Clear current chat and start fresh
                try { localStorage.removeItem(`chatId_${slug}`) } catch { /* ignore */ }
                setMessages([])
                setChatId(null)

                // IMPORTANT: Clear URL parameters so old product doesn't persist
                const cleanUrl = window.location.pathname
                window.history.replaceState({}, '', cleanUrl)

                if (customerId) {
                    initializeChat(customerId, null, products)
                }
            }}
            onCartClick={toggleCart}
            onDeleteChat={handleDeleteChat}
            rightSidebar={
                <CartSidebar
                    slug={slug}
                    primaryColor={primaryColor}
                    recommendations={products.filter(p => !items.find(i => i.id === p.id)).slice(0, 3)}
                    onCheckout={() => {
                        const params = new URLSearchParams({ from: 'chat' })
                        if (chatId) params.set('chatId', chatId)
                        router.push(`${getStoreLink('/checkout', isSubdomain, slug)}?${params.toString()}`)
                    }}
                    shippingConfig={shippingConfig}
                />
            }
            primaryColor={primaryColor}
        >
            {/* Main Chat Container - Now simplified as it's inside layout */}
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-gray-950 md:bg-white md:dark:bg-gray-950 relative">

                {/* Mobile Header (Only visible on mobile, Layout sidebar handles desktop) */}
                <div className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md md:hidden">
                    <div className="container mx-auto flex h-14 items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="size-8 rounded-full flex items-center justify-center text-white"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <span className="material-symbols-outlined text-lg">smart_toy</span>
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                                    {agentName}
                                </h2>
                                <span className="text-[10px] text-green-500 font-medium flex items-center gap-1">
                                    <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                    En línea
                                </span>
                            </div>
                        </div>
                        {/* Mobile Cart Button */}
                        <button
                            onClick={toggleCart}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors relative"
                        >
                            <span className="material-symbols-outlined text-lg">shopping_cart</span>
                            {items.length > 0 && <span className="absolute top-1 right-1 size-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                                style={{ backgroundColor: `${primaryColor}20` }}
                            >
                                <span className="material-symbols-outlined text-4xl" style={{ color: primaryColor }}>chat_bubble_outline</span>
                            </div>
                            <h3 className="text-lg font-bold">¡Hola! Soy {agentName}</h3>
                            <p className="max-w-xs mt-2">Estoy aquí para ayudarte a encontrar los mejores productos.</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="aspect-square w-8 shrink-0 rounded-full bg-cover bg-center shadow-sm"
                                        style={{ backgroundImage: `url("${agentAvatar}")` }}></div>
                                )}

                                <div className={`flex flex-1 flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <p className="text-xs font-normal leading-normal text-gray-500 dark:text-gray-400 ml-1">{agentName}</p>
                                    )}

                                    <div className="space-y-2 max-w-[85%]">
                                        {msg.content && (
                                            <div
                                                className={`text-sm font-normal leading-normal px-4 py-3 shadow-sm ${msg.role === 'user'
                                                    ? 'rounded-2xl rounded-br-none text-white'
                                                    : 'rounded-2xl rounded-bl-none bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700'
                                                    }`}
                                                style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                                            >
                                                {msg.role === 'user' ? (
                                                    msg.content
                                                ) : (
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                                                            a: (props) => <a target="_blank" rel="noopener noreferrer" className="underline font-medium hover:opacity-80" style={{ color: primaryColor }} {...props} />,
                                                            ul: (props) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                                            ol: (props) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                                            li: (props) => <li className="" {...props} />,
                                                            strong: (props) => <strong className="font-bold" {...props} />,
                                                            em: (props) => <em className="italic" {...props} />,
                                                            blockquote: (props) => <blockquote className="border-l-2 pl-3 italic text-gray-500 dark:text-gray-400 my-2" style={{ borderColor: `${primaryColor}50` }} {...props} />,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        )}

                                        {msg.product && (
                                            <ChatProductCard
                                                product={msg.product}
                                                formatPrice={formatPrice}
                                                primaryColor={primaryColor}
                                            />
                                        )}

                                        {/* Archivos adjuntos del agente */}
                                        {msg.mediaAttachments && msg.mediaAttachments.length > 0 && (
                                            <div className="flex flex-col gap-2 w-full max-w-sm">
                                                {msg.mediaAttachments.map((media) => {
                                                    const isAudio = media.category === 'audio' || media.file_type.startsWith('audio/')
                                                    const isImage = media.category === 'image' || media.file_type.startsWith('image/')
                                                    const isPdf = media.file_type === 'application/pdf'
                                                    const isVideo = media.category === 'video' || media.file_type.startsWith('video/')

                                                    return (
                                                        <div key={media.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                                            {isImage && (
                                                                <a href={media.file_url} target="_blank" rel="noopener noreferrer">
                                                                    <div className="aspect-video bg-gray-100 relative">
                                                                        <Image src={media.file_url} alt={media.name} fill className="object-contain" unoptimized />
                                                                    </div>
                                                                </a>
                                                            )}
                                                            {isAudio && (
                                                                <div className="p-3">
                                                                    <audio controls className="w-full" preload="metadata">
                                                                        <source src={media.file_url} type={media.file_type} />
                                                                    </audio>
                                                                </div>
                                                            )}
                                                            {isVideo && (
                                                                <video controls className="w-full aspect-video" preload="metadata">
                                                                    <source src={media.file_url} type={media.file_type} />
                                                                </video>
                                                            )}
                                                            <a
                                                                href={media.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                                            >
                                                                <div className="size-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                    style={{ backgroundColor: `${primaryColor}20` }}>
                                                                    <span className="material-symbols-outlined text-lg" style={{ color: primaryColor }}>
                                                                        {isPdf ? 'picture_as_pdf' : isAudio ? 'audio_file' : isImage ? 'image' : isVideo ? 'video_file' : 'attach_file'}
                                                                    </span>
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{media.name}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {isPdf ? 'Documento PDF' : isAudio ? 'Audio' : isImage ? 'Imagen' : isVideo ? 'Video' : 'Archivo'}
                                                                        {' · Toca para abrir'}
                                                                    </p>
                                                                </div>
                                                                <span className="material-symbols-outlined text-gray-400 text-lg">open_in_new</span>
                                                            </a>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Carousel for multiple products */}
                                        {msg.products && msg.products.length > 0 && (
                                            <div className="flex overflow-x-auto space-x-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md max-w-[85vw] md:max-w-lg">
                                                {msg.products.map((product) => (
                                                    <div key={product.id} className="flex-none w-40 flex flex-col gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                                        <div
                                                            className="bg-center bg-no-repeat aspect-video bg-cover rounded-md w-full"
                                                            style={{ backgroundImage: `url("${product.image_url}")` }}
                                                        />
                                                        <div className="flex flex-col gap-0.5">
                                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{product.name}</h3>
                                                            <p className="text-xs font-bold" style={{ color: primaryColor }}>{formatPrice(product.price)}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => addItem({
                                                                id: product.id,
                                                                name: product.name,
                                                                price: product.sale_price || product.price,
                                                                image_url: product.image_url
                                                            })}
                                                            disabled={product.stock <= 0}
                                                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 gap-1 text-xs font-bold leading-normal tracking-[0.015em] transition-colors disabled:opacity-50"
                                                            style={{
                                                                backgroundColor: `${primaryColor}20`,
                                                                color: primaryColor
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                                                            <span>Agregar</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div className="aspect-square w-8 shrink-0 rounded-full bg-cover bg-center bg-gray-200 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>
                                        {customerName ? customerName.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Typing Indicator */}
                    {isLoading && (
                        <div className="flex items-end gap-2.5">
                            <div className="aspect-square w-8 shrink-0 rounded-full bg-cover bg-center shadow-sm"
                                style={{ backgroundImage: `url("${agentAvatar}")` }}></div>
                            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <div className="flex gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Barra de pago persistente (aditiva: lee el carrito compartido) */}
                <ChatPayBar
                    itemCount={items.length}
                    total={total()}
                    formatPrice={formatPrice}
                    primaryColor={primaryColor}
                    onCheckout={goToCheckout}
                    onExpand={toggleCart}
                />

                {/* Magic Input Area */}
                <div className="w-full shrink-0 p-5 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative z-30">
                    {/* Quick Replies - Floating above input */}
                    <div className="absolute -top-12 left-6 flex gap-2 overflow-x-auto max-w-[95%] pb-2 scrollbar-hide mask-fade-right z-10">
                        {[
                            { text: "Recomiéndame un producto para...", icon: "auto_awesome" },
                            { text: "Quiero ver ofertas disponibles", icon: "local_offer" },
                            { text: "¿Qué métodos de pago aceptan?", icon: "credit_card" }
                        ].map((qr, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(qr.text)}
                                className="whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur border text-xs font-bold rounded-full shadow-sm transition-all transform hover:-translate-y-0.5"
                                style={{
                                    color: primaryColor,
                                    borderColor: `${primaryColor}30`,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = `${primaryColor}10`
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = ''
                                }}
                            >
                                <span className="material-symbols-outlined text-[16px]">{qr.icon}</span>
                                {qr.text.split("...")[0]}...
                            </button>
                        ))}
                    </div>

                    <div className="max-w-4xl mx-auto relative">
                        {/* Magic Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-50 to-indigo-100 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 rounded-2xl opacity-50 blur-sm pointer-events-none"></div>

                        <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-2 flex items-center gap-2 focus-within:ring-2 transition-all"
                            style={{ '--tw-ring-color': `${primaryColor}30` } as CssWithVariables}
                        >
                            <div className="flex-1 px-2 py-1">
                                <textarea
                                    className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0 placeholder:text-gray-400 text-gray-800 dark:text-gray-200 font-medium resize-none max-h-32 py-0.5 scrollbar-thin"
                                    placeholder="Escribe tu mensaje aquí..."
                                    rows={1}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isLoading}
                                    style={{ minHeight: '24px' }}
                                />
                            </div>

                            <div className="flex items-center gap-1 border-l border-gray-100 dark:border-gray-700 pl-2">
                                <button className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors" title="Adjuntar imagen (Próximamente)"
                                    style={{ '--hover-color': primaryColor } as CssWithVariables}
                                    onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
                                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                >
                                    <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                                </button>
                                <button className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-xl transition-colors" title="Emoji (Próximamente)">
                                    <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                                </button>

                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className="ml-1 p-2 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center h-9 w-9 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                    style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">send</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-4xl mx-auto mt-3 flex justify-center">
                        <p className="text-[10px] text-gray-400 text-center font-medium">
                            LandingChat AI • Recomendaciones personalizadas basadas en tu navegación.
                        </p>
                    </div>
                </div>
            </div>
            <CartDrawer
                slug={slug}
                primaryColor={primaryColor}
                recommendations={products.filter(p => !items.find(i => i.id === p.id)).slice(0, 3)}
                onlyMobile={true}
                shippingConfig={shippingConfig}
                onCheckout={() => {
                    setCartOpen(false)
                    const params = new URLSearchParams({ from: 'chat' })
                    if (chatId) params.set('chatId', chatId)
                    router.push(`${getStoreLink('/checkout', isSubdomain, slug)}?${params.toString()}`)
                }}
            />
        </ChatLayout>
    )

}
