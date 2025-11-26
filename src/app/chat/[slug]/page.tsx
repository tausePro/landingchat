"use client"

import { useState, useEffect, use } from "react"
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
    const [isMounted, setIsMounted] = useState(false)
    const [input, setInput] = useState("")
    const [products, setProducts] = useState<any[]>([])
    const [agent, setAgent] = useState<any>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const { addItem } = useCartStore()

    useEffect(() => {
        setIsMounted(true)
        // Fetch products and agent on mount
        getStoreProducts(slug).then((data) => {
            if (data) {
                setProducts(data.products)
                setAgent(data.agent)

                // Set initial greeting
                setMessages([{
                    id: '1',
                    role: 'assistant',
                    content: data.agent?.configuration?.greeting || `¡Hola! Soy ${data.agent?.name || 'tu asistente'}. ¿Qué buscas hoy?`,
                    timestamp: new Date()
                }])
            }
        })
    }, [slug])

    const handleSend = () => {
        if (!input.trim()) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        setInput("")

        // Simulate AI response with real product search
        setTimeout(() => {
            const lowerInput = input.toLowerCase()

            // Simple keyword search
            const foundProduct = products.find(p =>
                p.name.toLowerCase().includes(lowerInput) ||
                p.description?.toLowerCase().includes(lowerInput)
            )

            if (foundProduct) {
                const productMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `¡He encontrado esto para ti! El ${foundProduct.name} es una excelente opción.`,
                    product: {
                        id: foundProduct.id,
                        name: foundProduct.name,
                        price: foundProduct.price,
                        image_url: foundProduct.image_url || 'https://via.placeholder.com/300',
                        description: foundProduct.description || ''
                    },
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, productMsg])
            } else {
                // Fallback if no product found
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Entiendo lo que buscas. ¿Podrías ser más específico? Tenemos varios productos disponibles.',
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, aiMsg])
            }
        }, 1000)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(price)
    }

    if (!isMounted) {
        return null // Prevent hydration mismatch by not rendering until mounted
    }

    return (
        <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-gray-200 dark:border-gray-700"
                    style={{ backgroundImage: `url("${agent?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8bCAgEiNHMf7yLmgdo4Eurg3eWJYu2kbW3T_0NLJkhwPKQI0uBc2hI9DkwLseU3GBIQ3lZQaj7qqDrKE7OFoirx0C0Nlw8Poynk2naibQQ89RPvWM6n4FfDGwa9GMOHSZ6lURVzS1xH3d1b50c4xMLJk7A8NEUEvc0NiU58K6fetJ-LfldTWwYYb1b-2Sob5l4enhIUtGqOD0ePBgGiFmcz-jGyKBAq38346mulOzBOTu-juxtWlkXg3R2sT96vVBL2L0RkJPe2o'}")` }}></div>
                <div className="flex flex-col">
                    <h1 className="text-base font-medium leading-normal text-text-primary dark:text-white">{agent?.name || 'Asistente de Compras'}</h1>
                    <p className="text-green-500 text-sm font-normal leading-normal">Online</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0 border border-gray-200 dark:border-gray-700"
                                style={{ backgroundImage: `url("${agent?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8bCAgEiNHMf7yLmgdo4Eurg3eWJYu2kbW3T_0NLJkhwPKQI0uBc2hI9DkwLseU3GBIQ3lZQaj7qqDrKE7OFoirx0C0Nlw8Poynk2naibQQ89RPvWM6n4FfDGwa9GMOHSZ6lURVzS1xH3d1b50c4xMLJk7A8NEUEvc0NiU58K6fetJ-LfldTWwYYb1b-2Sob5l4enhIUtGqOD0ePBgGiFmcz-jGyKBAq38346mulOzBOTu-juxtWlkXg3R2sT96vVBL2L0RkJPe2o'}")` }}></div>
                        )}

                        <div className={`flex flex-1 flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <p className={`text-text-secondary text-[13px] font-normal leading-normal max-w-full ${msg.role === 'user' ? 'text-right' : ''}`}>
                                {msg.role === 'assistant' ? (agent?.name || 'Asistente') : 'Tú'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>

                            <div className="space-y-2">
                                {msg.content && (
                                    <p className={`text-base font-normal leading-normal flex max-w-lg rounded-lg px-4 py-3 shadow-sm ${msg.role === 'user'
                                        ? 'rounded-br-none bg-primary text-white'
                                        : 'rounded-bl-none bg-chat-assistant dark:bg-gray-700 text-text-primary dark:text-gray-200'
                                        }`}>
                                        {msg.content}
                                    </p>
                                )}

                                {msg.product && (
                                    <div className="flex flex-col gap-3 p-3 rounded-lg bg-chat-assistant dark:bg-gray-700 border border-gray-200 dark:border-gray-600 max-w-xs shadow-sm">
                                        <div className="bg-center bg-no-repeat aspect-video bg-cover rounded-lg w-full" style={{ backgroundImage: `url("${msg.product.image_url}")` }}></div>
                                        <div className="flex flex-col gap-1 px-1">
                                            <h3 className="text-base font-bold text-text-primary dark:text-white">{msg.product.name}</h3>
                                            <p className="text-sm text-text-secondary dark:text-gray-400 line-clamp-2">{msg.product.description}</p>
                                            <p className="text-lg font-bold text-primary">{formatPrice(msg.product.price)}</p>
                                        </div>
                                        <button
                                            onClick={() => addItem(msg.product!)}
                                            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-primary/20 text-primary gap-2 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/30 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                                            <span>Añadir al Carrito</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {msg.role === 'user' && (
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBez3Wh3agYQeBwWeASILSTqaBe3tIarckNMJm5uni28U-Z11srs7519cWP45jUQlvdS8FggmImC-hpa8LgZYTE3ddw_g_z3kCP6PmZ82eE5XB3cKus1H45UFA__-6UdPiJ-NyVy2qMGq4RHtS7q0WiOM2_35U0Spgx9E8eI2c6zKEkVct9XymP0Jc33bq5dBbihPgeWUAInDNMwC7GDXkCqoWhsIlFCIQdyCtc3UISdbxxjq2JPQjGPN4XOz0FhLZ8w269JN6Z-dk")' }}></div>
                        )}
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                    <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-full text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Ver ofertas</button>
                    <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-full text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Seguir mi pedido</button>
                    <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-full text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">¿Necesitas ayuda?</button>
                </div>
                <div className="relative">
                    <input
                        className="w-full h-12 rounded-lg pl-4 pr-28 bg-gray-100 dark:bg-gray-800 border-transparent focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-secondary"
                        placeholder="Escribe tu mensaje aquí..."
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button className="flex items-center justify-center size-9 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-text-secondary dark:text-gray-400">
                            <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="flex items-center justify-center size-9 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-xl">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
