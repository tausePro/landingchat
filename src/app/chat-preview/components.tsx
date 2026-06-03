"use client"

import { useState } from "react"
import {
    BRAND,
    formatPrice,
    type CartLine,
    type ChatMessage,
    type PreviewProduct,
} from "./data"

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"

const ACCENT: Record<PreviewProduct["accent"], { surface: string; icon: string }> = {
    rose: { surface: "from-rose-50 to-rose-100/50", icon: "text-rose-400" },
    violet: { surface: "from-violet-50 to-violet-100/50", icon: "text-violet-400" },
    teal: { surface: "from-cyan-50 to-teal-100/50", icon: "text-teal-500" },
}

/* ---------------------------------------------------------------- Header */

export function PersonaHeader({ onClose }: { onClose?: () => void }) {
    return (
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
                <span className="relative inline-flex">
                    <span
                        className="flex size-10 items-center justify-center rounded-full text-base font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` }}
                    >
                        {BRAND.advisor.charAt(0)}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
                </span>
                <span className="leading-tight">
                    <span className="block text-sm font-bold text-slate-900">{BRAND.advisor}</span>
                    <span className="block text-xs text-slate-500">Asistente de {BRAND.name}</span>
                </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
                <button type="button" aria-label="Historial" className="grid size-9 place-items-center rounded-full hover:bg-slate-100">
                    <span className="material-symbols-outlined text-[20px]">history</span>
                </button>
                <button type="button" aria-label="Cerrar" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-slate-100">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
        </header>
    )
}

export function DatePill({ label }: { label: string }) {
    return (
        <div className="flex justify-center py-1">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {label}
            </span>
        </div>
    )
}

/* --------------------------------------------------------------- Avatars */

function AssistantAvatar() {
    return (
        <span
            className="mt-1 flex size-7 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-bold lowercase ring-1 ring-slate-200"
            style={{ color: BRAND.primaryDark, backgroundColor: `${BRAND.primary}1a` }}
        >
            {BRAND.name}
        </span>
    )
}

/* -------------------------------------------------------------- Bubbles */

function RichText({ text }: { text: string }) {
    // Soporta **negritas** sin dependencias (el prototipo usa marcado simple).
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return (
        <>
            {parts.map((part, i) =>
                part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={i} className="font-bold text-slate-900">
                        {part.slice(2, -2)}
                    </strong>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </>
    )
}

export function ProductCard({
    product,
    onAdd,
}: {
    product: PreviewProduct
    onAdd: (p: PreviewProduct) => void
}) {
    const accent = ACCENT[product.accent]
    return (
        <div className="flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className={`relative flex h-24 items-center justify-center bg-gradient-to-br ${accent.surface}`}>
                {product.badge && (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {product.badge}
                    </span>
                )}
                <span className={`material-symbols-outlined text-[40px] ${accent.icon}`}>{product.icon}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-bold leading-snug text-slate-900">{product.name}</p>
                <p className="text-xs leading-snug text-slate-500">{product.description}</p>
                <div className="mt-auto flex items-end justify-between pt-2">
                    <span className="leading-tight">
                        <span className="block text-sm font-bold" style={{ color: BRAND.primaryDark }}>
                            {formatPrice(product.price)}
                        </span>
                        {product.compareAtPrice && (
                            <span className="block text-[11px] text-slate-400 line-through">
                                {formatPrice(product.compareAtPrice)}
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={() => onAdd(product)}
                        aria-label={`Agregar ${product.name} al carrito`}
                        className="grid size-9 place-items-center rounded-xl text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
                        style={{ backgroundColor: BRAND.primary, transitionTimingFunction: EASE }}
                    >
                        <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export function MessageRow({
    message,
    onAdd,
}: {
    message: ChatMessage
    onAdd: (p: PreviewProduct) => void
}) {
    if (message.role === "user") {
        return (
            <div className="flex justify-end px-4 py-1.5">
                <div
                    className="animate-slide-up max-w-[78%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                    style={{ backgroundColor: BRAND.primary }}
                >
                    {message.text}
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-2 px-4 py-1.5">
            <AssistantAvatar />
            <div className="animate-slide-up flex max-w-[82%] flex-col gap-2">
                {message.text && (
                    <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                        <RichText text={message.text} />
                    </div>
                )}
                {message.products && message.products.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {message.products.map((p) => (
                            <ProductCard key={p.id} product={p} onAdd={onAdd} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ----------------------------------------------------------------- Chips */

export function IntentChips({
    chips,
    onPick,
}: {
    chips: { id: string; label: string; icon: string }[]
    onPick: (id: string) => void
}) {
    return (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => (
                <button
                    key={chip.id}
                    type="button"
                    onClick={() => onPick(chip.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
                    style={{ color: BRAND.primaryDark, transitionTimingFunction: EASE }}
                >
                    <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
                    {chip.label}
                </button>
            ))}
        </div>
    )
}

/* ----------------------------------------------------------------- Input */

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
    const [value, setValue] = useState("")

    function submit() {
        const text = value.trim()
        if (!text) return
        onSend(text)
        setValue("")
    }

    return (
        <div className="shrink-0 border-t border-slate-200/70 bg-white px-4 py-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5">
                <button type="button" aria-label="Adjuntar" className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-200/60">
                    <span className="material-symbols-outlined text-[22px]">add</span>
                </button>
                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="Escribe tu mensaje..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button type="button" aria-label="Emoji" className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-200/60">
                    <span className="material-symbols-outlined text-[22px]">sentiment_satisfied</span>
                </button>
                <button
                    type="button"
                    onClick={submit}
                    aria-label="Enviar"
                    className="grid size-9 shrink-0 place-items-center rounded-full text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
                    style={{ backgroundColor: BRAND.primary, transitionTimingFunction: EASE }}
                >
                    <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
            </div>
        </div>
    )
}

/* --------------------------------------------------------------- Pay bar */

export function PayBar({
    lines,
    total,
    itemCount,
    threshold,
    onCheckout,
}: {
    lines: CartLine[]
    total: number
    itemCount: number
    threshold: number
    onCheckout: () => void
}) {
    const [expanded, setExpanded] = useState(false)

    if (itemCount <= 0) return null

    const itemsLabel = itemCount === 1 ? "ítem" : "ítems"
    const remaining = Math.max(0, threshold - total)
    const progress = Math.min(100, Math.round((total / threshold) * 100))

    return (
        <div className="px-4 pt-2">
            <div className="animate-slide-up mx-auto overflow-hidden rounded-2xl bg-slate-900 text-white shadow-[0_8px_30px_rgba(15,23,42,0.18)]">
                {expanded && (
                    <div className="border-b border-white/10 px-4 pb-3 pt-3">
                        {remaining > 0 ? (
                            <p className="text-xs text-white/70">
                                Te faltan <strong className="font-semibold text-white">{formatPrice(remaining)}</strong> para el envío gratis
                            </p>
                        ) : (
                            <p className="text-xs font-medium text-emerald-300">Envío gratis conseguido</p>
                        )}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full transition-transform duration-500"
                                style={{
                                    width: "100%",
                                    transform: `translateX(-${100 - progress}%)`,
                                    backgroundColor: BRAND.primary,
                                    transitionTimingFunction: EASE,
                                }}
                            />
                        </div>
                        <ul className="mt-3 space-y-1.5">
                            {lines.map((line) => (
                                <li key={line.id} className="flex items-center justify-between text-xs text-white/80">
                                    <span className="truncate pr-2">
                                        {line.quantity}× {line.name}
                                    </span>
                                    <span className="shrink-0 font-medium text-white">{formatPrice(line.price * line.quantity)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={`${expanded ? "Ocultar" : "Ver"} resumen del carrito`}
                        className="group flex min-w-0 items-center gap-3 text-left"
                    >
                        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                            <span
                                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                                style={{ backgroundColor: BRAND.primary }}
                            >
                                {itemCount}
                            </span>
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[11px] font-medium uppercase tracking-wide text-white/60">
                                Total · {itemCount} {itemsLabel}
                            </span>
                            <span className="flex items-center gap-1 text-base font-bold leading-tight">
                                {formatPrice(total)}
                                <span
                                    className="material-symbols-outlined text-[18px] text-white/50 transition-transform duration-300"
                                    style={{ transform: expanded ? "rotate(180deg)" : "none", transitionTimingFunction: EASE }}
                                >
                                    keyboard_arrow_up
                                </span>
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onCheckout}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
                        style={{ backgroundColor: BRAND.primary, transitionTimingFunction: EASE }}
                    >
                        Generar link de pago
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
