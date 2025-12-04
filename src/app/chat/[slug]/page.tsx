"use client"

import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart-store"
import { getStoreProducts } from "./actions"
import { StoreHeader } from "@/components/store/store-header"

interface Product {
    id: string
    name: string
    price: number
    image_url: string
    description: string
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    product?: Product
    timestamp: Date
}

export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const isSubdomain = useIsSubdomain()
    const router = useRouter()

    const [customerId, setCustomerId] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)

    const [input, setInput] = useState("")
    const [products, setProducts] = useState<any[]>([])
    const [agent, setAgent] = useState<any>(null)
    const [organization, setOrganization] = useState<any>(null)
    const [badges, setBadges] = useState<any[]>([])
    const [promotions, setPromotions] = useState<any[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { addItem } = useCartStore()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        // Verificar que el usuario esté identificado
        const storedCustomerId = localStorage.getItem(`customer_${slug}`)
        const storedCustomerName = localStorage.getItem(`customer_name_${slug}`)
        const storedChatId = localStorage.getItem(`chatId_${slug}`)

        if (!storedCustomerId) {
            // No identificado, redirigir al store
            const storeUrl = getStoreLink('/?action=chat', isSubdomain, slug)
            router.push(storeUrl)
            return
        }

        setCustomerId(storedCustomerId)
        setCustomerName(storedCustomerName)

        // Cargar productos, agente y organización
        getStoreProducts(slug).then((data) => {
            if (data) {
                setProducts(data.products)
                setOrganization(data.organization)
                setBadges(data.badges)
                setPromotions(data.promotions)
                if (!agent) setAgent(data.agent)

                // Inicializar chat con los productos cargados
                initializeChat(storedCustomerId, storedChatId, data.products)
            } else {
                // Fallback si falla la carga de productos
                initializeChat(storedCustomerId, storedChatId, [])
            }
        })
    }, [slug, router])

    const initializeChat = async (custId: string, existingChatId: string | null, loadedProducts: any[]) => {
        try {
            const response = await fetch(`/api/store/${slug}/chat/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId: custId })
            })

            const data = await response.json()

            if (data.chatId) {
                setChatId(data.chatId)
                localStorage.setItem(`chatId_${slug}`, data.chatId)

                if (data.agent) {
                    setAgent((prev: any) => ({ ...prev, ...data.agent }))
                }

                // Cargar historial de mensajes
                await fetchHistory(data.chatId)

                // Si hay un producto en la URL, el usuario quería preguntar por él
                const urlParams = new URLSearchParams(window.location.search)
                const productId = urlParams.get('product')
                const context = urlParams.get('context')

                if (productId && context) {
                    // User came from customization flow
                    const product = loadedProducts.find(p => p.id === productId)
                    const productName = product ? product.name : "este producto"
                    const customerName = localStorage.getItem(`customer_name_${slug}`)

                    // Add initial message from agent with context
                    // Only add if it's a new conversation or the last message wasn't this one (simple check)
                    // For now, just add it locally. 
                    const contextMsg: Message = {
                        id: "context-init-" + Date.now(),
                        role: 'assistant',
                        content: `Hola ${customerName || ''}, veo que estás interesado en **${productName}** con las siguientes opciones: **${decodeURIComponent(context)}**. ¿Te gustaría proceder con la compra o tienes alguna duda?`,
                        product: product, // Attach product to show the card
                        timestamp: new Date()
                    }
                    setMessages(prev => [...prev, contextMsg])
                }
            }

            setIsInitializing(false)
        } catch (error) {
            console.error("Error initializing chat:", error)
            setIsInitializing(false)
        }
    }

    const fetchHistory = async (id: string) => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/${id}/messages`)
            const historyData = await res.json()
            if (historyData.messages) {
                const parsedMessages = historyData.messages.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }))
                setMessages(parsedMessages)
            }
        } catch (e) {
            console.error("Error fetching history:", e)
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chatId || !customerId) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        const currentInput = input
        setInput("")
        setIsLoading(true)

        try {
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: currentInput,
                    chatId,
                    slug,
                    customerId, // Enviar customerId explícitamente
                    currentProductId: new URLSearchParams(window.location.search).get('product'),
                    context: new URLSearchParams(window.location.search).get('context')
                })
            })

            if (!response.ok) {
                throw new Error('Failed to get response from AI')
            }

            const data = await response.json()

            // Process actions from AI
            if (data.actions && data.actions.length > 0) {
                for (const action of data.actions) {
                    if (action.type === 'show_product' && action.data.product) {
                        const productMsg: Message = {
                            id: (Date.now() + Math.random()).toString(),
                            role: 'assistant',
                            content: action.data.message || '',
                            product: action.data.product,
                            timestamp: new Date()
                        }
                        setMessages(prev => [...prev, productMsg])
                    } else if (action.type === 'add_to_cart' && action.data.product_id) {
                        const product = products.find(p => p.id === action.data.product_id)
                        if (product) {
                            addItem({
                                id: product.id,
                                name: product.name,
                                price: product.price,
                                image_url: product.image_url || product.images?.[0]
                            }, action.data.quantity || 1)
                        }
                    }
                }
            }

            // Add AI response message
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, aiMsg])

        } catch (error: any) {
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

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Desktop Header */}
            <div className="hidden md:block">
                {organization && (
                    <StoreHeader
                        slug={slug}
                        organization={organization}
                        onStartChat={() => { }}
                        primaryColor={primaryColor}
                        showStoreName={showStoreName}
                        hideChatButton={true}
                    />
                )}
            </div>

            {/* Mobile Header - Prototype Style */}
            <div className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md md:hidden">
                <div className="container mx-auto flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push(getStoreLink('/', isSubdomain, slug))}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">shopping_cart</span>
                        </button>
                        <button
                            onClick={() => router.push(getStoreLink('/', isSubdomain, slug))}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chat Container */}
            <div className="flex-1 flex flex-col overflow-hidden w-full bg-white dark:bg-gray-950">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-gray-950 md:bg-white md:dark:bg-gray-950">
                    {messages.map((msg) => (
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
                                        <div className={`text-sm font-normal leading-normal px-3.5 py-2.5 shadow-sm ${msg.role === 'user'
                                            ? 'rounded-2xl rounded-br-sm bg-primary text-white'
                                            : 'rounded-2xl rounded-bl-sm bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    )}

                                    {msg.product && (
                                        <>
                                            {/* Mobile: Compact Horizontal Layout */}
                                            <div className="md:hidden ml-2 max-w-xs rounded-lg rounded-bl-sm border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-800/50 shadow-sm">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                                                        <div className="flex flex-col">
                                                            <p className="text-sm font-bold leading-tight text-gray-900 dark:text-white line-clamp-2">{msg.product.name}</p>
                                                            <p className="text-sm font-normal leading-normal text-gray-500 dark:text-gray-400 mt-0.5">{formatPrice(msg.product.price)}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => addItem(msg.product!)}
                                                            className="flex h-8 w-fit cursor-pointer items-center justify-center overflow-hidden rounded-md bg-gray-100 px-3 text-xs font-medium leading-normal text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 transition-colors"
                                                        >
                                                            <span>Añadir al carrito</span>
                                                        </button>
                                                    </div>
                                                    <div className="aspect-square w-20 flex-shrink-0 rounded-lg bg-cover bg-center border border-gray-100 dark:border-gray-700"
                                                        style={{ backgroundImage: `url("${msg.product.image_url}")` }}></div>
                                                </div>
                                            </div>

                                            {/* Desktop: Vertical Card Layout */}
                                            <div className="hidden md:flex flex-col gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-64 shadow-md relative overflow-hidden">
                                                <div className="bg-center bg-no-repeat aspect-[4/3] bg-cover rounded-lg w-full relative" style={{ backgroundImage: `url("${msg.product.image_url}")` }}>
                                                    {/* Badges */}
                                                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                                                        {badges.filter(b => b.type === 'manual').map(b => (
                                                            <span key={b.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: b.background_color, color: b.text_color }}>
                                                                {b.display_text}
                                                            </span>
                                                        ))}
                                                        {promotions.some(p => p.applies_to === 'all' || (p.applies_to === 'products' && p.target_ids?.includes(msg.product?.id))) && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                                                                OFERTA
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 px-1">
                                                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{msg.product.name}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">{msg.product.description}</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                                            {(() => {
                                                                let price = msg.product.price
                                                                const promo = promotions.find(p => p.applies_to === 'all' || (p.applies_to === 'products' && p.target_ids?.includes(msg.product?.id)))
                                                                if (promo) {
                                                                    if (promo.type === 'percentage') price = price * (1 - promo.value / 100)
                                                                    else if (promo.type === 'fixed') price = Math.max(0, price - promo.value)
                                                                }
                                                                return formatPrice(price)
                                                            })()}
                                                        </p>
                                                        {promotions.some(p => p.applies_to === 'all' || (p.applies_to === 'products' && p.target_ids?.includes(msg.product?.id))) && (
                                                            <span className="text-xs text-gray-400 line-through">{formatPrice(msg.product.price)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addItem(msg.product!)}
                                                    className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-primary text-white gap-2 text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm"
                                                >
                                                    <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                                                    <span>Agregar</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {msg.role === 'user' && (
                                <div className="aspect-square w-8 shrink-0 rounded-full bg-cover bg-center bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                                    {customerName ? customerName.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                        </div>
                    ))}

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

                {/* Input Area - Prototype Style */}
                <div className="w-full shrink-0 border-t border-solid border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    {/* Quick Action Buttons */}
                    <div className="mb-3 flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            onClick={() => {
                                const link = getStoreLink('/productos', isSubdomain, slug)
                                router.push(link)
                            }}
                            className="flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            Ver más productos
                        </button>
                        <button
                            onClick={() => setInput("Quiero hablar con un humano")}
                            className="flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            Hablar con un agente
                        </button>
                    </div>

                    {/* Text Input */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                className="h-12 w-full rounded-lg border-none bg-gray-100 pl-4 pr-10 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                                placeholder="Escribe tu mensaje..."
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined">send</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )

}
