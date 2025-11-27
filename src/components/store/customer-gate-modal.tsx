"use client"

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
    organizationSettings?: any
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
    organizationName = "nuestra tienda",
    organizationSettings
}: CustomerGateModalProps) {
    const identificationSettings = organizationSettings?.identification || {}
    const modalTitle = identificationSettings.title || "¡Hola! Antes de chatear..."
    const modalSubtitle = identificationSettings.subtitle || "Cuéntanos un poco sobre ti para darte una mejor atención."
    const showReturningVariant = identificationSettings.returningUserVariant ?? true
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

            // Si es cliente que regresa y el nombre no coincide, preguntar (solo si está habilitado)
            if (showReturningVariant && data.isReturning && data.customer.full_name !== name.trim()) {
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden bg-white dark:bg-[#1C2532] border-none shadow-2xl rounded-xl">
                {/* Estado: Registro */}
                {(state === "register" || state === "loading") && (
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col items-center p-8 pb-6">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <span className="material-symbols-outlined !text-3xl">chat_bubble</span>
                            </div>
                            <DialogTitle className="text-[#0d131b] dark:text-white tracking-tight text-2xl font-bold leading-tight text-center pb-2">
                                {modalTitle}
                            </DialogTitle>
                            <p className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal text-center">
                                {modalSubtitle}
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 px-8 pb-8">
                            {/* Campo Nombre */}
                            <div className="flex flex-col">
                                <Label htmlFor="name" className="text-[#0d131b] dark:text-white text-sm font-medium leading-normal pb-2">
                                    Tu nombre
                                </Label>
                                <div className="relative flex w-full items-center">
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
                                        className={`h-12 pl-3 pr-10 text-base ${errors.name ? "border-red-500" : ""}`}
                                        disabled={state === "loading"}
                                    />
                                    <div className="absolute right-3 text-gray-400 pointer-events-none">
                                        <span className="material-symbols-outlined">person</span>
                                    </div>
                                </div>
                                {errors.name && (
                                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                                )}
                            </div>

                            {/* Campo WhatsApp */}
                            <div className="flex flex-col">
                                <Label htmlFor="phone" className="text-[#0d131b] dark:text-white text-sm font-medium leading-normal pb-2">
                                    Tu WhatsApp
                                </Label>
                                <div className="flex w-full flex-1 items-stretch rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
                                    <div className="flex items-center">
                                        <Select
                                            value={countryCode}
                                            onValueChange={setCountryCode}
                                            disabled={state === "loading"}
                                        >
                                            <SelectTrigger className="h-12 border-0 border-r border-gray-200 dark:border-gray-700 rounded-l-lg rounded-r-none bg-gray-50 dark:bg-gray-800/50 w-[100px] focus:ring-0">
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
                                    </div>
                                    <div className="relative flex-1">
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="300 123 4567"
                                            value={phone}
                                            onChange={(e) => {
                                                setPhone(e.target.value)
                                                if (errors.phone) setErrors({ ...errors, phone: undefined })
                                            }}
                                            className={`h-12 border-0 rounded-l-none focus-visible:ring-0 ${errors.phone ? "text-red-500" : ""}`}
                                            disabled={state === "loading"}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none">
                                            <svg fill="currentColor" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.31 20.6C8.75 21.41 10.36 21.85 12.04 21.85C17.5 21.85 21.95 17.4 21.95 11.91C21.95 9.27 20.92 6.83 19.16 4.96C17.41 3.14 14.86 2 12.04 2M12.04 3.67C14.25 3.67 16.31 4.5 17.87 6.06C19.43 7.62 20.28 9.68 20.28 11.91C20.28 16.47 16.63 20.12 12.04 20.12C10.56 20.12 9.14 19.73 7.91 19L7.29 18.65L4.41 19.53L5.32 16.74L4.93 16.12C4.19 14.82 3.8 13.38 3.8 11.91C3.8 7.35 7.45 3.67 12.04 3.67M16.57 14.49C16.31 14.49 14.38 13.53 14.12 13.42C13.86 13.32 13.69 13.26 13.52 13.52C13.35 13.78 12.82 14.41 12.65 14.58C12.48 14.75 12.31 14.78 12.05 14.68C11.45 14.43 10.42 14.06 9.21 13C8.21 12.16 7.55 11.11 7.38 10.85C7.21 10.59 7.33 10.45 7.45 10.32C7.56 10.2 7.7 10.03 7.83 9.87C7.96 9.71 8.03 9.58 8.16 9.32C8.29 9.06 8.23 8.86 8.13 8.66C8.03 8.46 7.5 7.21 7.29 6.71C7.09 6.21 6.89 6.26 6.73 6.25H6.2C5.94 6.25 5.68 6.32 5.45 6.55C5.23 6.78 4.6 7.35 4.6 8.53C4.6 9.71 5.48 10.84 5.61 11.01C5.74 11.18 7.45 13.8 10.11 15C12.28 15.91 12.79 15.75 13.32 15.72C13.85 15.68 15.13 14.91 15.36 14.28C15.59 13.65 15.59 13.12 15.52 13.02C15.46 12.92 15.33 12.89 15.07 12.79C14.81 12.69 13.42 12.06 13.16 11.96C12.9 11.86 12.73 11.8 12.56 12.06C12.39 12.32 11.86 12.95 11.69 13.12C11.52 13.29 11.35 13.32 11.09 13.22C10.59 13.01 9.73 12.69 8.92 11.94C8.28 11.36 7.81 10.59 7.67 10.33C7.53 10.07 7.64 9.94 7.75 9.82C7.87 9.7 8 9.53 8.13 9.37C8.26 9.21 8.33 9.08 8.46 8.82C8.59 8.56 8.53 8.36 8.43 8.16C8.33 7.96 7.8 6.71 7.59 6.21C7.39 5.71 7.19 5.76 7.03 5.75H6.5C6.24 5.75 5.98 5.82 5.75 6.05C5.53 6.28 4.9 6.85 4.9 8.03C4.9 9.21 5.78 10.34 5.91 10.51C6.04 10.68 7.75 13.3 10.41 14.5C12.58 15.41 13.09 15.25 13.62 15.22C14.15 15.18 15.43 14.41 15.66 13.78C15.89 13.15 15.89 12.62 15.82 12.52C15.76 12.42 15.63 12.39 15.37 12.29C15.11 12.19 13.72 11.56 13.46 11.46C13.2 11.36 13.03 11.3 12.86 11.56C12.69 11.82 12.16 12.45 11.99 12.62C11.82 12.79 11.65 12.82 11.39 12.72C11.13 12.62 10.51 12.43 9.95 12.06C9.33 11.63 8.89 11.03 8.72 10.74C8.56 10.45 8.68 10.31 8.8 10.18C8.91 10.06 9.06 9.88 9.2 9.72C9.34 9.56 9.4 9.46 9.53 9.2C9.66 8.94 9.6 8.7 9.5 8.5C9.4 8.3 8.87 7.05 8.67 6.55C8.46 6.05 8.26 6.1 8.11 6.1H7.61C7.35 6.1 7.09 6.16 6.86 6.39C6.64 6.62 6.1 7.19 6.1 8.37C6.1 9.55 6.98 10.68 7.11 10.85C7.24 11.02 8.95 13.7 11.61 15C13.21 15.69 14.01 15.93 14.57 15.93C14.92 15.93 16.5 15.11 16.76 14.28C17.02 13.45 17.02 12.75 16.96 12.65C16.89 12.55 16.76 12.52 16.5 12.42Z"></path>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                {errors.phone && (
                                    <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                                )}
                            </div>

                            {/* Botón Submit */}
                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-bold bg-primary hover:bg-blue-600"
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

                            {/* Footer */}
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <span className="material-symbols-outlined !text-base text-gray-400">lock</span>
                                <p className="text-gray-400 text-xs font-normal">
                                    Tu información está segura. Solo la usamos para atenderte mejor.
                                </p>
                            </div>
                        </div>
                    </form>
                )}

                {/* Estado: Cliente que regresa */}
                {state === "returning" && returningCustomer && (
                    <div className="flex flex-col items-center justify-center p-8 sm:p-10">
                        <div className="flex flex-col items-center text-center w-full">
                            <h1 className="text-[#0d131b] dark:text-white tracking-tight text-[28px] font-bold leading-tight">
                                ¡Hola de nuevo, {returningCustomer.full_name.split(" ")[0]}! 👋
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal pt-2">
                                Te recordamos de tu última visita.
                            </p>
                        </div>

                        <div className="flex flex-col items-center py-8 w-full">
                            <div className="flex items-center justify-center">
                                <div className="bg-primary/10 text-primary rounded-full flex items-center justify-center size-20 text-3xl font-bold">
                                    {returningCustomer.full_name.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="flex flex-col items-center pt-4">
                                <h1 className="text-[#0d131b] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
                                    {returningCustomer.full_name}
                                </h1>
                                <p className="text-[#4c6c9a] dark:text-gray-400 text-sm font-normal leading-normal pt-1">
                                    {formatPhoneDisplay(returningCustomer.phone)}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col w-full space-y-3">
                            <Button
                                onClick={handleContinueAsReturning}
                                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90"
                            >
                                Continuar como {returningCustomer.full_name.split(" ")[0]}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleNotMe}
                                className="w-full h-11 text-base font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
                            >
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
                        <h2 className="text-xl font-bold text-green-600 mb-2">
                            ¡Listo!
                        </h2>
                        <p className="text-gray-500">
                            Conectando con el chat...
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
