"use client"

import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import { ChatLayout } from "@/components/layout/chat-layout"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart-store"
import { getStoreProducts } from "./actions"
import { StoreHeader } from "@/components/store/store-header"
import { ChatProductCard } from "@/components/chat/chat-product-card"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Product {
    id: string
    name: string
    price: number
    image_url: string
    description: string
    stock: number
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    product?: Product
    products?: Product[] // Multiple products for carousel
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
    const [customerChats, setCustomerChats] = useState<Array<{ id: string; title: string; created_at: string; updated_at?: string }>>([])
    const [isLoading, setIsLoading] = useState(false)
    const { addItem, items, removeItem, updateQuantity, clearCart, toggleCart, total: cartTotal } = useCartStore()
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
        // Si no hay chatId en localStorage, será null, lo que forzará crear uno nuevo
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

    // Fetch customer's chat history
    useEffect(() => {
        if (!customerId) return
        const fetchCustomerChats = async () => {
            try {
                const res = await fetch(`/api/store/${slug}/customer/${customerId}/chats`)
                const data = await res.json()
                if (data.chats) {
                    setCustomerChats(data.chats)
                }
            } catch (e) {
                console.error("Error fetching customer chats:", e)
            }
        }
        fetchCustomerChats()
    }, [customerId, slug])

    const initializeChat = async (custId: string, existingChatId: string | null, loadedProducts: any[]) => {
        let currentChatId: string | null = null;

        // Si hay un ID de chat existente, intentar retomarlo
        if (existingChatId) {
            const historyLoaded = await fetchHistory(existingChatId)
            
            if (historyLoaded) {
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

                const data = await response.json()

                if (data.chatId) {
                    currentChatId = data.chatId
                    setChatId(data.chatId)
                    localStorage.setItem(`chatId_${slug}`, data.chatId)

                    if (data.agent) {
                        setAgent((prev: any) => ({ ...prev, ...data.agent }))
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

                if (productId) {
                    // Activar indicador de "escribiendo"
                    setIsLoading(true)
                    
                    // Llamada no bloqueante (Background processing)
                    fetch('/api/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: context ? `Hola, me interesa este producto con: ${decodeURIComponent(context)}` : 'Hola, me interesa este producto',
                            chatId: currentChatId,
                            slug,
                            customerId: custId,
                            currentProductId: productId,
                            context: context ? decodeURIComponent(context) : undefined
                        })
                    }).then(async (aiResponse) => {
                        if (aiResponse.ok) {
                            const aiData = await aiResponse.json()

                            // Procesar acciones (show_product)
                            let collectedProducts: any[] = []
                            if (aiData.actions && aiData.actions.length > 0) {
                                for (const action of aiData.actions) {
                                    if (action.type === 'show_product' && action.data.product) {
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
                        }
                    }).catch(err => {
                        console.error("Error calling AI with product context:", err)
                    }).finally(() => {
                        setIsLoading(false)
                    })
                }
            } else {
                 setIsInitializing(false)
            }
        } catch (error) {
            console.error("Error initializing chat:", error)
            setIsInitializing(false)
        }
    }

    const fetchHistory = async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/${id}/messages`)
            if (!res.ok) return false
            
            const historyData = await res.json()
            if (historyData.messages) {
                const parsedMessages = historyData.messages.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }))
                setMessages(parsedMessages)
                return true
            }
            return false
        } catch (e) {
            console.error("Error fetching history:", e)
            return false
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
                    customerId
                    // Note: NOT passing currentProductId here - that context is only for initial message
                    // The AI should use search_products tool to find products for user queries
                })
            })

            if (!response.ok) {
                throw new Error('Failed to get response from AI')
            }

            const data = await response.json()

            // Process actions from AI
            let collectedProducts: Product[] = []
            let hasProductAction = false

            if (data.actions && data.actions.length > 0) {
                for (const action of data.actions) {
                    if (action.type === 'show_product' && action.data.product) {
                        hasProductAction = true
                        collectedProducts.push(action.data.product)
                    } else if (action.type === 'add_to_cart' && action.data.added) {
                        // Producto agregado al carrito
                        const addedProduct = action.data.added
                        addItem({
                            id: action.data.added.product_id || products.find(p => p.name === addedProduct.name)?.id,
                            name: addedProduct.name,
                            price: addedProduct.price,
                            image_url: products.find(p => p.name === addedProduct.name)?.image_url
                        }, addedProduct.quantity || 1)
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
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, aiMsg])
            }

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

    // Calcular productos activos en la conversación para el Living Sidebar
    const activeProducts = messages
        .filter(m => m.product || (m.products && m.products.length > 0))
        .flatMap(m => m.products || (m.product ? [m.product] : []))
        .reduce((unique: any[], item) => {
            return unique.some(u => u.id === item.id) ? unique : [...unique, item]
        }, [])

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
            if (res.ok) {
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
            customHeader={
                <StoreHeader 
                    slug={slug}
                    organization={organization}
                    onStartChat={() => {}} // No-op in chat
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
                    localStorage.setItem(`chatId_${slug}`, selectedChatId)
                    fetchHistory(selectedChatId)
                }
            }}
            onNewConversation={() => {
                // Clear current chat and start fresh
                localStorage.removeItem(`chatId_${slug}`)
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
        >
            {/* Main Chat Container - Now simplified as it's inside layout */}
            <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-gray-950 md:bg-white md:dark:bg-gray-950 relative">

                {/* Mobile Header (Only visible on mobile, Layout sidebar handles desktop) */}
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
                        {/* Mobile Cart Button */}
                        <button
                            onClick={toggleCart}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors relative"
                        >
                            <span className="material-symbols-outlined text-lg">shopping_cart</span>
                            {items.length > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-red-500" />}
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-primary">chat_bubble_outline</span>
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
                                            <div className={`text-sm font-normal leading-normal px-4 py-3 shadow-sm ${msg.role === 'user'
                                                ? 'rounded-2xl rounded-br-none bg-primary text-white'
                                                : 'rounded-2xl rounded-bl-none bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700'
                                                }`}>
                                                {msg.role === 'user' ? (
                                                    msg.content
                                                ) : (
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                                            a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="underline font-medium hover:opacity-80" {...props} />,
                                                            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                                            li: ({node, ...props}) => <li className="" {...props} />,
                                                            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                                                            em: ({node, ...props}) => <em className="italic" {...props} />,
                                                            blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-primary/30 pl-3 italic text-gray-500 dark:text-gray-400 my-2" {...props} />,
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
                                            />
                                        )}

                                        {/* Carousel for multiple products - Stitch 34 style */}
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
                                                            <p className="text-xs font-bold text-primary">{formatPrice(product.price)}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => addItem({
                                                                id: product.id,
                                                                name: product.name,
                                                                price: product.price,
                                                                image_url: product.image_url
                                                            })}
                                                            disabled={product.stock <= 0}
                                                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-md h-8 bg-primary/20 text-primary gap-1 text-xs font-bold leading-normal tracking-[0.015em] hover:bg-primary/30 transition-colors disabled:opacity-50"
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
                                    <div className="aspect-square w-8 shrink-0 rounded-full bg-cover bg-center bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
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

                {/* Input Area */}
                <div className="w-full shrink-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                    <div className="max-w-4xl mx-auto flex items-end gap-2">
                        <div className="flex-1 relative">
                            <input
                                className="w-full min-h-[48px] max-h-32 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 pr-12 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                                placeholder="Escribe tu mensaje..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-xl">send</span>
                            </button>
                        </div>
                    </div>
                    <div className="max-w-4xl mx-auto mt-2 flex justify-center">
                        <p className="text-[10px] text-gray-400 text-center">
                            Desarrollado con inteligencia artificial por LandingChat
                        </p>
                    </div>
                </div>
            </div>
        </ChatLayout>
    )

}
