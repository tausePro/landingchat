"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { becomeAffiliate, type MyAffiliate } from "./actions"
import { toast } from "sonner"
import { Copy, Check, Handshake, Loader2 } from "lucide-react"

export function AffiliatePanel({ initialAffiliate }: { initialAffiliate: MyAffiliate | null }) {
    const [affiliate, setAffiliate] = useState<MyAffiliate | null>(initialAffiliate)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleJoin = async () => {
        setLoading(true)
        const result = await becomeAffiliate()
        if (result.success) {
            setAffiliate(result.data)
            toast.success("¡Listo! Ya eres afiliado.")
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }

    const handleCopy = async () => {
        if (!affiliate) return
        try {
            await navigator.clipboard.writeText(affiliate.link)
            setCopied(true)
            toast.success("Link copiado")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("No se pudo copiar")
        }
    }

    if (!affiliate) {
        return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50 p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Handshake className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Únete al programa de afiliados</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Gana comisión recurrente por cada negocio que refieras y se suscriba a LandingChat. Activa tu link en un clic.
                </p>
                <Button onClick={handleJoin} disabled={loading} className="mt-5 h-11 px-6">
                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Handshake className="mr-2 size-4" />}
                    {loading ? "Activando..." : "Activar mi link de afiliado"}
                </Button>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Tu link de afiliado</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {affiliate.commissionRate}% recurrente
                </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    readOnly
                    value={affiliate.link}
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <Button onClick={handleCopy} className="h-11 px-5">
                    {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                    {copied ? "Copiado" : "Copiar"}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Comparte este link. Cuando un negocio se registre y se suscriba, se te atribuye y ganas comisión recurrente.
            </p>
        </div>
    )
}
