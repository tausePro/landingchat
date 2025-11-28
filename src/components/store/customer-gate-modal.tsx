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
