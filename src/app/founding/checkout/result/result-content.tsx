"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Zap,
    Check,
    X,
    Clock,
    Loader2,
    ArrowRight,
    PartyPopper,
} from "lucide-react"
import { verifyFoundingPayment } from "./actions"

interface FoundingResultContentProps {
    transactionId?: string
    slotId?: string
}

type ResultStatus = "loading" | "success" | "pending" | "failed"

export function FoundingResultContent({ transactionId, slotId }: FoundingResultContentProps) {
    const router = useRouter()
    const [status, setStatus] = useState<ResultStatus>("loading")
    const [message, setMessage] = useState("")
    const [slotNumber, setSlotNumber] = useState<number | null>(null)
    const [tierName, setTierName] = useState("")

    useEffect(() => {
        const checkPayment = async () => {
            if (!transactionId) {
                setStatus("failed")
                setMessage("No se encontró información de la transacción")
                return
            }

            const result = await verifyFoundingPayment(transactionId, slotId)

            if (result.success && result.data) {
                if (result.data.status === "APPROVED") {
                    setStatus("success")
                    setSlotNumber(result.data.slot_number ?? null)
                    setTierName(result.data.tier_name ?? "Founding")
                    setMessage("¡Bienvenido al club de Founding Members!")
                } else if (result.data.status === "PENDING") {
                    setStatus("pending")
                    setMessage("Tu pago está siendo procesado. Te notificaremos cuando se confirme.")
                } else {
                    setStatus("failed")
                    setMessage(result.data.status_message || "El pago no pudo ser procesado")
                }
            } else {
                setStatus("failed")
                setMessage(!result.success ? result.error : "Error al verificar el pago")
            }
        }

        checkPayment()
    }, [transactionId, slotId])

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="border-b border-white/5">
                <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
                    <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                            <Zap className="size-5 text-white" />
                        </div>
                        <span className="text-lg font-bold">LandingChat</span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 py-20">
                {status === "loading" && (
                    <div className="text-center">
                        <Loader2 className="size-16 animate-spin text-emerald-400 mx-auto mb-6" />
                        <h1 className="text-2xl font-bold mb-2">Verificando tu pago...</h1>
                        <p className="text-slate-400">Por favor espera mientras confirmamos tu transacción</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="text-center">
                        <div className="relative inline-block mb-6">
                            <div className="size-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto">
                                <Check className="size-10 text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2">
                                <PartyPopper className="size-8 text-amber-400" />
                            </div>
                        </div>

                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                            <Zap className="size-3 mr-1" />
                            FOUNDING MEMBER #{slotNumber}
                        </Badge>

                        <h1 className="text-3xl font-black mb-2">
                            ¡Felicitaciones!
                        </h1>
                        <p className="text-xl text-emerald-400 font-semibold mb-4">
                            {message}
                        </p>
                        <p className="text-slate-400 mb-8">
                            Tu cupo como Founding Member del plan {tierName} ha sido asegurado.
                            Tu precio está congelado de por vida.
                        </p>

                        <Card className="bg-white/5 border-emerald-500/30 mb-8">
                            <CardContent className="p-6">
                                <h3 className="font-semibold mb-4">Próximos pasos:</h3>
                                <ul className="space-y-3 text-left">
                                    <li className="flex items-start gap-3">
                                        <div className="rounded-full bg-emerald-500/20 p-1 mt-0.5">
                                            <Check className="size-4 text-emerald-400" />
                                        </div>
                                        <span>Completa la configuración de tu tienda</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="rounded-full bg-emerald-500/20 p-1 mt-0.5">
                                            <Check className="size-4 text-emerald-400" />
                                        </div>
                                        <span>Agrega tus primeros productos</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="rounded-full bg-emerald-500/20 p-1 mt-0.5">
                                            <Check className="size-4 text-emerald-400" />
                                        </div>
                                        <span>Configura tu agente de chat con IA</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="rounded-full bg-emerald-500/20 p-1 mt-0.5">
                                            <Check className="size-4 text-emerald-400" />
                                        </div>
                                        <span>¡Empieza a vender por chat!</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Button
                            size="lg"
                            className="h-14 px-10 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 font-bold"
                            asChild
                        >
                            <Link href="/onboarding/welcome">
                                Comenzar Configuración
                                <ArrowRight className="ml-2 size-5" />
                            </Link>
                        </Button>
                    </div>
                )}

                {status === "pending" && (
                    <div className="text-center">
                        <div className="size-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                            <Clock className="size-10 text-amber-400" />
                        </div>

                        <h1 className="text-3xl font-black mb-2">
                            Pago en Proceso
                        </h1>
                        <p className="text-slate-400 mb-8">
                            {message}
                        </p>

                        <Card className="bg-white/5 border-amber-500/30 mb-8">
                            <CardContent className="p-6">
                                <p className="text-sm text-slate-400">
                                    Si pagaste con PSE o transferencia bancaria, la confirmación puede tardar
                                    unos minutos. Te enviaremos un email cuando tu pago sea confirmado.
                                </p>
                            </CardContent>
                        </Card>

                        <div className="flex gap-4 justify-center">
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                            >
                                Verificar de nuevo
                            </Button>
                            <Button asChild>
                                <Link href="/dashboard">
                                    Ir al Dashboard
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}

                {status === "failed" && (
                    <div className="text-center">
                        <div className="size-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                            <X className="size-10 text-red-400" />
                        </div>

                        <h1 className="text-3xl font-black mb-2">
                            Pago No Completado
                        </h1>
                        <p className="text-slate-400 mb-8">
                            {message}
                        </p>

                        <Card className="bg-white/5 border-red-500/30 mb-8">
                            <CardContent className="p-6">
                                <p className="text-sm text-slate-400">
                                    Tu cupo de Founding Member sigue reservado por unos minutos más.
                                    Puedes intentar el pago nuevamente.
                                </p>
                            </CardContent>
                        </Card>

                        <div className="flex gap-4 justify-center">
                            <Button
                                variant="outline"
                                asChild
                            >
                                <Link href="/founding">
                                    Volver a Planes
                                </Link>
                            </Button>
                            <Button
                                className="bg-gradient-to-r from-emerald-500 to-cyan-500"
                                onClick={() => router.back()}
                            >
                                Intentar de Nuevo
                            </Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
