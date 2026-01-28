"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { verifyTransaction } from "./actions"

type PaymentStatus = "loading" | "approved" | "declined" | "pending" | "error"

export default function SubscriptionResultPage() {
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<PaymentStatus>("loading")
    const [transactionDetails, setTransactionDetails] = useState<{
        reference: string
        amount: number
    } | null>(null)

    const transactionId = searchParams.get("id")

    useEffect(() => {
        async function verifyPayment() {
            if (!transactionId) {
                setStatus("error")
                return
            }

            try {
                const result = await verifyTransaction(transactionId)

                if (!result.success || !result.data) {
                    setStatus("error")
                    return
                }

                setTransactionDetails({
                    reference: result.data.reference,
                    amount: result.data.amount
                })

                switch (result.data.status) {
                    case "APPROVED":
                        setStatus("approved")
                        break
                    case "DECLINED":
                        setStatus("declined")
                        break
                    case "PENDING":
                        setStatus("pending")
                        break
                    default:
                        setStatus("error")
                }
            } catch {
                setStatus("error")
            }
        }

        verifyPayment()
    }, [transactionId])

    const statusConfig = {
        loading: {
            icon: RefreshCw,
            iconClass: "text-slate-400 animate-spin",
            title: "Verificando pago...",
            description: "Estamos confirmando tu transacción.",
            bgClass: "bg-slate-50 border-slate-200",
        },
        approved: {
            icon: CheckCircle2,
            iconClass: "text-green-500",
            title: "Pago Exitoso",
            description: "Tu plan ha sido actualizado correctamente.",
            bgClass: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
        },
        declined: {
            icon: XCircle,
            iconClass: "text-red-500",
            title: "Pago Rechazado",
            description: "La transacción fue rechazada. Intenta con otro método de pago.",
            bgClass: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
        },
        pending: {
            icon: Clock,
            iconClass: "text-amber-500",
            title: "Pago Pendiente",
            description: "Tu pago está siendo procesado. Te notificaremos cuando se confirme.",
            bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
        },
        error: {
            icon: AlertCircle,
            iconClass: "text-red-500",
            title: "Error",
            description: "Hubo un problema al verificar tu pago.",
            bgClass: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
        },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <div className="container max-w-2xl py-10">
            <Card className={`${config.bgClass} transition-all`}>
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Icon className={`size-16 ${config.iconClass}`} />
                    </div>
                    <CardTitle className="text-2xl">{config.title}</CardTitle>
                    <CardDescription className="text-base">
                        {config.description}
                    </CardDescription>
                </CardHeader>

                {transactionDetails && status !== "loading" && (
                    <CardContent>
                        <div className="rounded-lg bg-white/50 p-4 dark:bg-slate-900/50">
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-slate-500">Referencia:</dt>
                                    <dd className="font-mono text-slate-900 dark:text-white">
                                        {transactionDetails.reference}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-slate-500">Monto:</dt>
                                    <dd className="font-medium text-slate-900 dark:text-white">
                                        {new Intl.NumberFormat("es-CO", {
                                            style: "currency",
                                            currency: "COP",
                                            minimumFractionDigits: 0,
                                        }).format(transactionDetails.amount)}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </CardContent>
                )}

                <CardFooter className="flex flex-col gap-3">
                    <Button asChild className="w-full">
                        <Link href="/dashboard/subscription">
                            {status === "approved" ? "Ver mi suscripción" : "Volver a suscripción"}
                        </Link>
                    </Button>
                    {status === "declined" && (
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/dashboard/subscription">
                                Intentar de nuevo
                            </Link>
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
