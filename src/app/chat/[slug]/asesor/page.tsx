"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getAdvisorData } from "./actions"
import { getStoredUUID, getStoredString, setStoredUUID } from "@/lib/utils/storage"
import { useIsSubdomain } from "@/hooks/use-is-subdomain"
import { getStoreLink } from "@/lib/utils/store-urls"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Image from "next/image"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    properties?: PropertyCard[]
    appointment?: AppointmentCard
    mediaAttachments?: MediaAttachment[]
    timestamp: Date
}

interface PropertyCard {
    id: string
    title: string
    type?: string
    class?: string
    location?: string
    address?: string
    bedrooms?: number
    bathrooms?: number
    area?: string
    stratum?: string
    priceRent?: string
    priceSale?: string
    priceAdmin?: string
    image_url?: string
}

interface AppointmentCard {
    id: string
    title: string
    type: string
    date: string
    time: string
    duration: string
    location: string
    customerName: string
    status: string
}

interface MediaAttachment {
    id: string
    name: string
    file_url: string
    file_type: string
    file_name: string
    category: string
}

export default function AdvisorChatPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const isSubdomain = useIsSubdomain()
    const router = useRouter()
    const searchParams = useSearchParams()
    const contextParam = searchParams.get("context")
    const propertyCodeParam = searchParams.get("product")
    const contextSentRef = useRef(false)

    const [customerId, setCustomerId] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const [chatId, setChatId] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)

    const [input, setInput] = useState("")
    const [agent, setAgent] = useState<any>(null)
    const [organization, setOrganization] = useState<any>(null)
    const [propertyCount, setPropertyCount] = useState(0)
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const initializationRef = useRef(false)
    const [pendingContext, setPendingContext] = useState<string | null>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => { scrollToBottom() }, [messages])

    useEffect(() => {
        if (initializationRef.current) return
        initializationRef.current = true

        const storedCustomerId = getStoredUUID(`customer_${slug}`)
        const storedCustomerName = getStoredString(`customer_name_${slug}`)
        const storedChatId = getStoredUUID(`chatId_asesor_${slug}`)

        if (!storedCustomerId) {
            const storeUrl = getStoreLink("/?action=chat", isSubdomain, slug)
            router.push(storeUrl)
            return
        }

        setCustomerId(storedCustomerId)
        setCustomerName(storedCustomerName)

        getAdvisorData(slug).then(async (data) => {
            if (data && data.organization) {
                setOrganization(data.organization)
                setPropertyCount(data.propertyCount)
                if (data.agent) setAgent(data.agent)
                await initializeChat(storedCustomerId, storedChatId)

                // Si viene contexto del BookingPanel o código de propiedad en el URL
                if (!contextSentRef.current) {
                    if (propertyCodeParam) {
                        contextSentRef.current = true
                        setPendingContext(`Hola, me interesa la propiedad con código ${propertyCodeParam}. Muéstrame los detalles.`)
                    } else if (contextParam) {
                        contextSentRef.current = true
                        setPendingContext(contextParam)
                    }
                }
            } else {
                setError("No se pudo cargar la información.")
                setIsInitializing(false)
            }
        }).catch(() => {
            setError("Error de conexión.")
            setIsInitializing(false)
        })
    }, [slug, router])

    // Auto-enviar contexto del BookingPanel cuando el chat esté listo
    useEffect(() => {
        if (pendingContext && chatId && customerId && !isLoading && !isInitializing) {
            setPendingContext(null)
            handleSend(pendingContext)
        }
    }, [pendingContext, chatId, customerId, isLoading, isInitializing])

    const initializeChat = async (custId: string, existingChatId: string | null) => {
        let currentChatId: string | null = null

        if (existingChatId) {
            const historyLoaded = await fetchHistory(existingChatId)
            if (historyLoaded) {
                setChatId(existingChatId)
                setIsInitializing(false)
                return
            }
            localStorage.removeItem(`chatId_asesor_${slug}`)
        }

        try {
            const response = await fetch(`/api/store/${slug}/chat/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId: custId })
            })

            if (!response.ok) {
                if (response.status === 404) {
                    localStorage.removeItem(`customer_${slug}`)
                    localStorage.removeItem(`customer_name_${slug}`)
                    localStorage.removeItem(`chatId_asesor_${slug}`)
                    const storeUrl = getStoreLink("/?action=chat", isSubdomain, slug)
                    router.push(storeUrl)
                    return
                }
                throw new Error("Failed to init chat")
            }

            const data = await response.json()
            if (data.chatId) {
                currentChatId = data.chatId
                setChatId(data.chatId)
                setStoredUUID(`chatId_asesor_${slug}`, data.chatId)
                if (data.agent) setAgent((prev: any) => ({ ...prev, ...data.agent }))
                await fetchHistory(data.chatId)
            }

            setIsInitializing(false)
        } catch (err) {
            console.error("Error initializing chat:", err)
            setError("Error al conectar con el asesor.")
            setIsInitializing(false)
        }
    }

    const fetchHistory = async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/${id}/messages`)
            if (!res.ok) return false
            const historyData = await res.json()
            if (historyData.messages) {
                setMessages(historyData.messages.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                })))
                return true
            }
            return false
        } catch { return false }
    }

    const handleSend = async (textOverride?: string) => {
        const textToSend = typeof textOverride === "string" ? textOverride : input
        if (!textToSend.trim() || isLoading || !chatId || !customerId) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: textToSend,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        if (!textOverride) setInput("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: textToSend,
                    chatId,
                    slug,
                    customerId
                })
            })

            if (!response.ok) throw new Error("Failed to get response")

            const data = await response.json()

            // Procesar acciones del AI
            let collectedProperties: PropertyCard[] = []
            let appointmentData: AppointmentCard | undefined
            let collectedMedia: MediaAttachment[] = []

            if (data.actions && data.actions.length > 0) {
                for (const action of data.actions) {
                    if (action.type === "search_properties" && action.data?.properties) {
                        collectedProperties = action.data.properties
                    }
                    if (action.type === "show_property" && action.data?.property) {
                        const p = action.data.property
                        collectedProperties = [{
                            id: p.id,
                            title: p.title,
                            type: p.type,
                            class: p.class,
                            location: `${p.location?.neighborhood || ""}, ${p.location?.city || ""}`,
                            address: p.location?.address,
                            bedrooms: p.specs?.bedrooms,
                            bathrooms: p.specs?.bathrooms,
                            area: p.specs?.area,
                            stratum: p.location?.stratum,
                            priceRent: p.prices?.rent,
                            priceSale: p.prices?.sale,
                            priceAdmin: p.prices?.admin,
                            image_url: p.images?.[0]
                        }]
                    }
                    if (action.type === "schedule_appointment" && action.data?.appointment) {
                        appointmentData = action.data.appointment
                    }
                    if (action.type === "send_media" && action.data?.media) {
                        collectedMedia.push(action.data.media as MediaAttachment)
                    }
                }
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.message,
                properties: collectedProperties.length > 0 ? collectedProperties : undefined,
                appointment: appointmentData,
                mediaAttachments: collectedMedia.length > 0 ? collectedMedia : undefined,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, aiMsg])

        } catch (err) {
            console.error("Error calling AI:", err)
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
                timestamp: new Date()
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const primaryColor = organization?.settings?.branding?.primaryColor || "#2b7cee"
    const agentName = organization?.settings?.agent?.name || agent?.name || "Asesor"
    const agentAvatar = organization?.settings?.agent?.avatar || agent?.avatar_url

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900 flex-col gap-4 p-8 text-center">
                <div className="size-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                    <span className="material-symbols-outlined text-3xl">error_outline</span>
                </div>
                <h3 className="text-lg font-bold">{error}</h3>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
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
                    <p className="text-gray-500 font-medium">Conectando con {agentName}...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950">
            {/* Header */}
            <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {agentAvatar ? (
                            <div className="size-10 rounded-full bg-cover bg-center shadow-sm border-2 border-white"
                                style={{ backgroundImage: `url("${agentAvatar}")` }} />
                        ) : (
                            <div className="size-10 rounded-full flex items-center justify-center text-white shadow-sm"
                                style={{ backgroundColor: primaryColor }}>
                                <span className="material-symbols-outlined">support_agent</span>
                            </div>
                        )}
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white">{organization.name}</h1>
                            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                {agentName} · En línea
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 hidden sm:block">{propertyCount} propiedades disponibles</span>
                        <button
                            onClick={() => {
                                const storeUrl = getStoreLink("/", isSubdomain, slug)
                                router.push(storeUrl)
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto p-4 space-y-6">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 opacity-60">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                                style={{ backgroundColor: `${primaryColor}15` }}>
                                <span className="material-symbols-outlined text-4xl" style={{ color: primaryColor }}>apartment</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¡Hola! Soy {agentName}</h3>
                            <p className="max-w-sm mt-2 text-gray-500">
                                Estoy aquí para ayudarte a encontrar la propiedad ideal. Cuéntame qué estás buscando.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={`flex items-end gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                                {msg.role === "assistant" && (
                                    agentAvatar ? (
                                        <div className="size-8 shrink-0 rounded-full bg-cover bg-center shadow-sm"
                                            style={{ backgroundImage: `url("${agentAvatar}")` }} />
                                    ) : (
                                        <div className="size-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs"
                                            style={{ backgroundColor: primaryColor }}>
                                            <span className="material-symbols-outlined text-sm">support_agent</span>
                                        </div>
                                    )
                                )}

                                <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    {msg.role === "assistant" && (
                                        <p className="text-xs text-gray-400 ml-1">{agentName}</p>
                                    )}

                                    {/* Texto del mensaje */}
                                    {msg.content && (
                                        <div className={`text-sm px-4 py-3 shadow-sm ${
                                            msg.role === "user"
                                                ? "rounded-2xl rounded-br-none text-white"
                                                : "rounded-2xl rounded-bl-none bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-700"
                                        }`}
                                            style={msg.role === "user" ? { backgroundColor: primaryColor } : {}}>
                                            {msg.role === "user" ? msg.content : (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: primaryColor }} {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                                }}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    )}

                                    {/* Tarjetas de propiedades */}
                                    {msg.properties && msg.properties.length > 0 && (
                                        <div className="flex overflow-x-auto gap-3 pb-2 max-w-[85vw] md:max-w-xl">
                                            {msg.properties.map((prop) => (
                                                <div key={prop.id} className="flex-none w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                                    {prop.image_url && (
                                                        <div className="aspect-video bg-gray-200 relative">
                                                            <Image src={prop.image_url} alt={prop.title} fill className="object-cover" unoptimized />
                                                        </div>
                                                    )}
                                                    <div className="p-3">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            {prop.class && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                                                                    {prop.class}
                                                                </span>
                                                            )}
                                                            {prop.type && (
                                                                <span className="text-[10px] text-gray-500 font-medium">{prop.type}</span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{prop.title}</h4>
                                                        {prop.location && (
                                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-xs">location_on</span>
                                                                {prop.location}
                                                            </p>
                                                        )}
                                                        <div className="flex gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                            {prop.bedrooms && <span>{prop.bedrooms} hab</span>}
                                                            {prop.bathrooms && <span>{prop.bathrooms} baños</span>}
                                                            {prop.area && <span>{prop.area}</span>}
                                                            {prop.stratum && <span>E{prop.stratum}</span>}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                                            {prop.priceSale && <p className="text-sm font-bold" style={{ color: primaryColor }}>Venta: {prop.priceSale}</p>}
                                                            {prop.priceRent && <p className="text-sm font-bold" style={{ color: primaryColor }}>Arriendo: {prop.priceRent}</p>}
                                                            {prop.priceAdmin && <p className="text-[10px] text-gray-400">Admin: {prop.priceAdmin}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Archivos adjuntos del agente */}
                                    {msg.mediaAttachments && msg.mediaAttachments.length > 0 && (
                                        <div className="flex flex-col gap-2 w-full max-w-sm">
                                            {msg.mediaAttachments.map((media) => {
                                                const isAudio = media.category === "audio" || media.file_type.startsWith("audio/")
                                                const isImage = media.category === "image" || media.file_type.startsWith("image/")
                                                const isPdf = media.file_type === "application/pdf"
                                                const isVideo = media.category === "video" || media.file_type.startsWith("video/")

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
                                                                style={{ backgroundColor: `${primaryColor}15` }}>
                                                                <span className="material-symbols-outlined text-lg" style={{ color: primaryColor }}>
                                                                    {isPdf ? "picture_as_pdf" : isAudio ? "audio_file" : isImage ? "image" : isVideo ? "video_file" : "attach_file"}
                                                                </span>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{media.name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {isPdf ? "Documento PDF" : isAudio ? "Audio" : isImage ? "Imagen" : isVideo ? "Video" : "Archivo"}
                                                                    {" · Toca para abrir"}
                                                                </p>
                                                            </div>
                                                            <span className="material-symbols-outlined text-gray-400 text-lg">open_in_new</span>
                                                        </a>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Tarjeta de cita agendada */}
                                    {msg.appointment && (
                                        <div className="w-full max-w-sm bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-green-600 text-lg">event_available</span>
                                                <span className="text-sm font-bold text-green-800 dark:text-green-300">Cita Agendada</span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{msg.appointment.title}</h4>
                                            <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                <p className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-xs">calendar_today</span>
                                                    {msg.appointment.date}
                                                </p>
                                                <p className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-xs">schedule</span>
                                                    {msg.appointment.time} · {msg.appointment.duration}
                                                </p>
                                                <p className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-xs">location_on</span>
                                                    {msg.appointment.location}
                                                </p>
                                                <p className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-xs">{msg.appointment.type === "Visita presencial" ? "directions_walk" : "call"}</span>
                                                    {msg.appointment.type}
                                                </p>
                                            </div>
                                            <div className="mt-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">
                                                    Pendiente de confirmación
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {msg.role === "user" && (
                                    <div className="size-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                        style={{ backgroundColor: primaryColor }}>
                                        {customerName ? customerName.charAt(0).toUpperCase() : "U"}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Typing */}
                    {isLoading && (
                        <div className="flex items-end gap-2.5">
                            <div className="size-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs"
                                style={{ backgroundColor: primaryColor }}>
                                <span className="material-symbols-outlined text-sm">support_agent</span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <div className="flex gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="max-w-3xl mx-auto">
                    {/* Quick replies */}
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                        {[
                            { text: "Busco apartamento en arriendo", icon: "apartment" },
                            { text: "Quiero agendar una visita", icon: "calendar_month" },
                            { text: "¿Qué zonas manejan?", icon: "location_on" },
                        ].map((qr, i) => (
                            <button key={i} onClick={() => handleSend(qr.text)}
                                className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border text-xs font-medium rounded-full shadow-sm hover:-translate-y-0.5 transition-all"
                                style={{ color: primaryColor, borderColor: `${primaryColor}30` }}>
                                <span className="material-symbols-outlined text-[14px]">{qr.icon}</span>
                                {qr.text}
                            </button>
                        ))}
                    </div>

                    <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-2 flex items-center gap-2 focus-within:ring-2 transition-all"
                        style={{ "--tw-ring-color": `${primaryColor}30` } as any}>
                        <textarea
                            className="flex-1 border-0 bg-transparent px-2 py-1 text-sm focus:ring-0 placeholder:text-gray-400 text-gray-800 dark:text-gray-200 resize-none max-h-32 scrollbar-thin"
                            placeholder="Escribe tu mensaje aquí..."
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            style={{ minHeight: "24px" }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            className="p-2 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center h-9 w-9 disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}>
                            <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    </div>

                    <p className="text-[10px] text-gray-400 text-center mt-2">
                        LandingChat AI · Asesor inmobiliario virtual
                    </p>
                </div>
            </div>
        </div>
    )
}
