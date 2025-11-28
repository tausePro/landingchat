"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart-store"
import { getStoreProducts } from "./actions"

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
    const router = useRouter()

    const [customerId, setCustomerId] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)

    const [input, setInput] = useState("")
    const [products, setProducts] = useState<any[]>([])
    const [agent, setAgent] = useState<any>(null)
    const [organization, setOrganization] = useState<any>(null)
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
            router.push(`/store/${slug}?action=chat`)
            return
        }

        setCustomerId(storedCustomerId)
        setCustomerName(storedCustomerName)

        // Cargar productos, agente y organización
        getStoreProducts(slug).then((data) => {
            if (data) {
                setProducts(data.products)
                setOrganization(data.organization)
                if (!agent) setAgent(data.agent)
            }
        })

        // Inicializar chat
        initializeChat(storedCustomerId, storedChatId)
    }, [slug, router])

    const initializeChat = async (custId: string, existingChatId: string | null) => {
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

                if (productId) {
                    // Aquí podríamos enviar un mensaje automático o sugerencia
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
                    currentProductId: new URLSearchParams(window.location.search).get('product')
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
        <>
            {/* Storefront Header */}
            <div className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    {/* Left: Back button + Store Logo/Name */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push(`/store/${slug}`)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(`/store/${slug}`)}>
                            {organization.logo_url ? (
                                <img
                                    src={organization.logo_url}
                                    alt={organization.name}
                                    className="h-10 w-auto object-contain max-w-[120px] md:max-w-[150px]"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg">
                                    {organization.name.substring(0, 1)}
                                </div>
                            )}
                            {showStoreName && (
                                <span className="text-lg md:text-xl font-bold tracking-tight">{organization.name}</span>
                            )}
                        </div>
                    </div>

                    {/* Right: Cart + Notifications + Agent Info */}
                    <div className="flex items-center gap-3">
                        {/* Cart Button */}
                        <button
                            onClick={toggleCart}
                            className="relative flex cursor-pointer items-center justify-center rounded-full h-10 w-10 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">shopping_cart</span>
                            {items.length > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                    {items.length}
                                </span>
                            )}
                        </button>

                        {/* Agent Info Badge */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-sm font-medium">
                            <div
                                className="w-6 h-6 rounded-full bg-cover bg-center border border-green-200"
                                style={{ backgroundImage: `url("${agentAvatar}")` }}
                            />
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span>Chateando con {agentName}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-gray-950">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-8 h-8 shrink-0 border border-gray-200 dark:border-gray-700"
                                style={{ backgroundImage: `url("${agentAvatar}")` }}></div>
                        )}

                        <div className={`flex flex-1 flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="space-y-2 max-w-[85%]">
                                {msg.content && (
                                    <div className={`text-base font-normal leading-relaxed px-4 py-3 shadow-sm ${msg.role === 'user'
                                        ? 'rounded-2xl rounded-tr-sm bg-primary text-white'
                                        : 'rounded-2xl rounded-tl-sm bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700'
                                        }`}>
                                        {msg.content}
                                    </div>
                                )}

                                {msg.product && (
                                    <div className="flex flex-col gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-64 shadow-md">
                                        <div className="bg-center bg-no-repeat aspect-[4/3] bg-cover rounded-lg w-full" style={{ backgroundImage: `url("${msg.product.image_url}")` }}></div>
                                        <div className="flex flex-col gap-1 px-1">
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{msg.product.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">{msg.product.description}</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatPrice(msg.product.price)}</p>
                                        </div>
                                        <button
                                            onClick={() => addItem(msg.product!)}
                                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-primary text-white gap-2 text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm"
                                        >
                                            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className={`text-xs text-slate-400 font-medium mt-1 ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex items-end gap-3">
                        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-8 h-8 shrink-0 border border-gray-200 dark:border-gray-700"
                            style={{ backgroundImage: `url("${agentAvatar}")` }}></div>
                        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-4 shadow-sm">
                            <div className="flex gap-1.5">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
                <div className="relative max-w-4xl mx-auto">
                    <input
                        className="w-full h-14 rounded-full pl-6 pr-16 bg-slate-100 dark:bg-gray-800 border-transparent focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-slate-400 text-base shadow-inner"
                        placeholder="Escribe tu mensaje aquí..."
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="flex items-center justify-center size-10 rounded-full bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors shadow-md"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-xl">send</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
