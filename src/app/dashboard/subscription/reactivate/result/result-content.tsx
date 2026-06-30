"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react"
import { verifyReactivation } from "./actions"

type ResultState = "loading" | "approved" | "pending" | "declined" | "error"

export function ReactivateResultContent({ transactionId }: { transactionId: string | null }) {
    const [state, setState] = useState<ResultState>("loading")

    useEffect(() => {
        if (!transactionId) {
            setState("error")
            return
        }
        verifyReactivation(transactionId)
            .then((res) => {
                if (!res.success || !res.data) {
                    setState("error")
                    return
                }
                const status = res.data.status
                if (status === "APPROVED") setState("approved")
                else if (status === "PENDING") setState("pending")
                else setState("declined")
            })
            .catch(() => setState("error"))
    }, [transactionId])

    return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
            {state === "loading" && (
                <>
                    <Loader2 className="size-10 animate-spin text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Verificando tu pago…</p>
                </>
            )}
            {state === "approved" && (
                <>
                    <CheckCircle2 className="size-12 text-emerald-500" />
                    <h1 className="mt-4 text-xl font-bold">¡Tienda reactivada!</h1>
                    <p className="mt-2 text-muted-foreground">Tu tienda y el chat ya están en línea de nuevo.</p>
                    <Link href="/dashboard" className="mt-6"><Button>Ir al panel</Button></Link>
                </>
            )}
            {state === "pending" && (
                <>
                    <Clock className="size-12 text-amber-500" />
                    <h1 className="mt-4 text-xl font-bold">Pago en proceso</h1>
                    <p className="mt-2 text-muted-foreground">Tu pago se está confirmando. Tu tienda se reactivará en cuanto Wompi lo apruebe.</p>
                    <Link href="/dashboard" className="mt-6"><Button variant="outline">Ir al panel</Button></Link>
                </>
            )}
            {state === "declined" && (
                <>
                    <XCircle className="size-12 text-red-500" />
                    <h1 className="mt-4 text-xl font-bold">Pago rechazado</h1>
                    <p className="mt-2 text-muted-foreground">El pago no se completó. Intenta de nuevo desde el panel.</p>
                    <Link href="/dashboard" className="mt-6"><Button variant="outline">Ir al panel</Button></Link>
                </>
            )}
            {state === "error" && (
                <>
                    <XCircle className="size-12 text-red-500" />
                    <h1 className="mt-4 text-xl font-bold">No pudimos verificar el pago</h1>
                    <p className="mt-2 text-muted-foreground">Si el cobro se realizó, tu tienda se reactivará automáticamente. Revisa el panel en unos minutos.</p>
                    <Link href="/dashboard" className="mt-6"><Button variant="outline">Ir al panel</Button></Link>
                </>
            )}
        </div>
    )
}
