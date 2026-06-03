"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    ChatInput,
    DatePill,
    IntentChips,
    MessageRow,
    PayBar,
    PersonaHeader,
} from "./components"
import {
    FREE_SHIPPING_THRESHOLD,
    GIFT_PRODUCTS,
    PRODUCTS,
    formatPrice,
    type CartLine,
    type ChatMessage,
    type PreviewProduct,
} from "./data"

let idSeq = 0
const nextId = () => `m${++idSeq}`

const CHIPS = [
    { id: "regalo", label: "Recomiéndame un producto para regalar", icon: "auto_awesome" },
    { id: "ofertas", label: "Ver ofertas disponibles", icon: "sell" },
    { id: "pagos", label: "¿Qué métodos de pago aceptan?", icon: "credit_card" },
]

// Carrito inicial: el cliente ya tiene un producto (apertura proactiva del agente).
const INITIAL_CART: CartLine[] = [
    { id: "laminas-jabon", name: "Láminas de Jabón Portátiles", price: 65_000, quantity: 1 },
]

const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: nextId(),
        role: "assistant",
        text: "¡Hola, Felipe! Veo que tienes las **Láminas de Jabón Portátiles** en tu carrito. Combinan increíble con esto 👇",
        products: PRODUCTS,
    },
]

export default function ChatPreviewPage() {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
    const [cart, setCart] = useState<CartLine[]>(INITIAL_CART)
    const scrollRef = useRef<HTMLDivElement>(null)

    const itemCount = cart.reduce((acc, l) => acc + l.quantity, 0)
    const total = cart.reduce((acc, l) => acc + l.price * l.quantity, 0)

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, [messages])

    function pushAssistant(text: string, products?: PreviewProduct[]) {
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text, products }])
    }

    function pushUser(text: string) {
        setMessages((prev) => [...prev, { id: nextId(), role: "user", text }])
    }

    function addToCart(product: PreviewProduct) {
        let newTotal = total
        setCart((prev) => {
            const existing = prev.find((l) => l.id === product.id)
            const next = existing
                ? prev.map((l) => (l.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
                : [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
            newTotal = next.reduce((acc, l) => acc + l.price * l.quantity, 0)
            return next
        })

        const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - newTotal)
        const nudge =
            remaining > 0
                ? ` Te faltan **${formatPrice(remaining)}** para el envío gratis 🚚 ¿Te muestro algo pequeño para completar?`
                : " ¡Y conseguiste el envío gratis! 🎉"
        pushAssistant(`¡Listo, Felipe! Sumé **${product.name}** a tu carrito.${nudge}`)
    }

    function handleChip(id: string) {
        const chip = CHIPS.find((c) => c.id === id)
        if (chip) pushUser(chip.label)

        setTimeout(() => {
            if (id === "regalo") {
                pushAssistant(
                    "¡Me encanta regalar bonito! Para un detalle especial, estas dos son mis favoritas 🎁",
                    GIFT_PRODUCTS,
                )
            } else if (id === "ofertas") {
                pushAssistant(
                    "Esta semana tenemos esta oferta activa, aprovéchala antes de que se agote 🏷️",
                    [PRODUCTS[0]],
                )
            } else if (id === "pagos") {
                pushAssistant(
                    "Aceptamos **Wompi**, **PSE**, **Bancolombia** y tarjetas de crédito/débito. Todo el pago es seguro y se confirma al instante.",
                )
            }
        }, 280)
    }

    function handleSend(text: string) {
        pushUser(text)
        setTimeout(() => {
            pushAssistant(
                "¡Buena pregunta! Cuéntame un poco más de lo que buscas (tipo de piel, presupuesto u ocasión) y te armo una recomendación a tu medida.",
            )
        }, 320)
    }

    function handleCheckout() {
        toast.success("Link de pago generado", {
            description: `${itemCount} ${itemCount === 1 ? "ítem" : "ítems"} · ${formatPrice(total)} (demo)`,
        })
    }

    return (
        <main className="flex min-h-[100dvh] w-full justify-center bg-slate-100">
            <div className="relative flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-[#f7f8fa] sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:ring-1 sm:ring-slate-200/70 sm:shadow-[0_12px_50px_rgba(15,23,42,0.10)]">
                <PersonaHeader />

                <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
                    <DatePill label="Hoy" />
                    {messages.map((m) => (
                        <MessageRow key={m.id} message={m} onAdd={addToCart} />
                    ))}
                </div>

                <div className="shrink-0">
                    <PayBar
                        lines={cart}
                        total={total}
                        itemCount={itemCount}
                        threshold={FREE_SHIPPING_THRESHOLD}
                        onCheckout={handleCheckout}
                    />
                    <IntentChips chips={CHIPS} onPick={handleChip} />
                    <ChatInput onSend={handleSend} />
                </div>
            </div>
        </main>
    )
}
