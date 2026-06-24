"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createStoreAffiliate, type StoreAffiliate } from "./actions"
import { toast } from "sonner"
import { Copy, Check, Plus, Loader2 } from "lucide-react"

export function StoreAffiliatesManager({ initial }: { initial: StoreAffiliate[] }) {
    const [affiliates, setAffiliates] = useState<StoreAffiliate[]>(initial)
    const [name, setName] = useState("")
    const [rate, setRate] = useState("10")
    const [creating, setCreating] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error("Ponle un nombre al afiliado")
            return
        }
        setCreating(true)
        const res = await createStoreAffiliate(name.trim(), Number(rate) || 10)
        if (res.success) {
            setAffiliates((prev) => [res.data, ...prev])
            setName("")
            setRate("10")
            toast.success("Afiliado creado")
        } else {
            toast.error(res.error)
        }
        setCreating(false)
    }

    const copy = async (link: string, id: string) => {
        try {
            await navigator.clipboard.writeText(link)
            setCopied(id)
            toast.success("Link copiado")
            setTimeout(() => setCopied(null), 2000)
        } catch {
            toast.error("No se pudo copiar")
        }
    }

    return (
        <div className="space-y-6">
            {/* Crear afiliado */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50 p-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Crear afiliado</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Dale un nombre y su % de comisión. Recibe un link único de tu tienda.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Input
                        placeholder="Nombre (ej. Juana — influencer)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 flex-1"
                    />
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            className="h-11 w-20"
                            aria-label="Comisión %"
                        />
                        <span className="text-sm text-muted-foreground">% comisión</span>
                    </div>
                    <Button onClick={handleCreate} disabled={creating} className="h-11 px-5">
                        {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                        Crear
                    </Button>
                </div>
            </div>

            {/* Lista */}
            {affiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no tienes afiliados. Crea el primero arriba.</p>
            ) : (
                <div className="space-y-3">
                    {affiliates.map((a) => (
                        <div key={a.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-slate-900 dark:text-white">{a.name}</div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{a.commissionRate}%</span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.status}</span>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                    readOnly
                                    value={a.link}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                <Button variant="outline" onClick={() => copy(a.link, a.id)} className="h-10 px-4">
                                    {copied === a.id ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                                    {copied === a.id ? "Copiado" : "Copiar link"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
