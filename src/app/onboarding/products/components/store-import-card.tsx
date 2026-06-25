"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Sparkles, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { previewStoreImport, confirmStoreImport, type StoreImportSummary } from "../import-actions"
import type { ExtractedVariant } from "@/lib/onboarding/store-importer"

interface Row {
    include: boolean
    name: string
    price: string
    description: string | null
    imageUrl: string | null
    variants?: ExtractedVariant[]
}

type Step = "input" | "loading" | "preview" | "importing" | "done"

export function StoreImportCard() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<Step>("input")
    const [url, setUrl] = useState("")
    const [brand, setBrand] = useState<string | null>(null)
    const [primaryColor, setPrimaryColor] = useState<string | null>(null)
    const [currency, setCurrency] = useState<string | null>(null)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [initialStock, setInitialStock] = useState("100")
    const [rows, setRows] = useState<Row[]>([])
    const [summary, setSummary] = useState<StoreImportSummary | null>(null)

    const reset = () => { setStep("input"); setUrl(""); setRows([]); setBrand(null); setPrimaryColor(null); setCurrency(null); setLogoUrl(null); setInitialStock("100"); setSummary(null) }

    const handleAnalyze = async () => {
        setStep("loading")
        const result = await previewStoreImport(url.trim())
        if (!result.success) {
            toast.error(result.error)
            setStep("input")
            return
        }
        setBrand(result.data.brandName)
        setPrimaryColor(result.data.primaryColor)
        setCurrency(result.data.currency)
        setLogoUrl(result.data.logoUrl)
        setRows(result.data.products.map((p) => ({
            include: true,
            name: p.name,
            price: p.price != null ? String(p.price) : "",
            description: p.description,
            imageUrl: p.imageUrl,
            variants: p.variants,
        })))
        setStep("preview")
    }

    const handleImport = async () => {
        const items = rows
            .filter((row) => row.include)
            .map((row) => ({
                name: row.name.trim(),
                price: Number(row.price.replace(/[^\d.]/g, "")),
                description: row.description,
                imageUrl: row.imageUrl,
                variants: row.variants
                    ?.filter((v) => v.price != null && v.price > 0)
                    .map((v) => ({
                        title: v.title,
                        sku: v.sku ?? null,
                        price: v.price as number,
                        compareAtPrice: v.compareAtPrice ?? null,
                        optionValues: v.optionValues,
                    })),
            }))
        if (items.length === 0) { toast.error("Selecciona al menos un producto"); return }

        setStep("importing")
        const result = await confirmStoreImport(items, { primaryColor, currency, logoUrl }, { initialStock: Number(initialStock) || 100 })
        if (!result.success) { toast.error(result.error); setStep("preview"); return }
        setSummary(result.data)
        setStep("done")
        router.refresh()
    }

    const includedCount = rows.filter((row) => row.include).length

    return (
        <>
            {/* Card (reemplaza el "Conecta tu tienda" estático) */}
            <div className="flex flex-col gap-4 rounded-xl border border-primary bg-primary/5 dark:bg-primary/10 p-6 shadow-sm ring-2 ring-primary/20 transition-shadow hover:shadow-lg">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-6" />
                </div>
                <div className="flex flex-grow flex-col gap-2">
                    <p className="text-slate-900 dark:text-slate-50 text-lg font-bold leading-normal">
                        Importa desde tu web actual
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                        Pega el link de tu tienda o catálogo y traemos tus productos automáticamente. Tú revisas antes de publicar.
                    </p>
                </div>
                <div className="mt-auto">
                    <Button className="w-full h-11 px-5 text-sm" onClick={() => { reset(); setOpen(true) }}>
                        <Sparkles className="size-4 mr-2" /> Importar mi catálogo
                    </Button>
                </div>
            </div>

            <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
                <DialogContent className="sm:max-w-2xl">
                    {step === "done" && summary ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Check className="size-5 text-green-600" /> ¡Catálogo importado!
                                </DialogTitle>
                                <DialogDescription>
                                    Se crearon <strong>{summary.created}</strong> productos
                                    {summary.failed > 0 ? ` (${summary.failed} con problemas)` : ""}. Ya puedes revisarlos y ajustarlos.
                                </DialogDescription>
                            </DialogHeader>
                            {summary.errors.length > 0 && (
                                <ul className="max-h-32 overflow-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                                    {summary.errors.slice(0, 6).map((error, index) => <li key={index}>• {error}</li>)}
                                </ul>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Seguir aquí</Button>
                                <Button onClick={() => router.push("/onboarding/preview")}>Ver mi tienda</Button>
                            </DialogFooter>
                        </>
                    ) : step === "preview" ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Revisa tu catálogo{brand ? ` — ${brand}` : ""}</DialogTitle>
                                <DialogDescription>
                                    Encontramos {rows.length} productos. Ajusta nombres/precios y destilda lo que no quieras. ({includedCount} seleccionados)
                                </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
                                {rows.map((row, index) => (
                                    <div key={index} className="flex items-center gap-3 rounded-lg border p-2.5">
                                        <Checkbox
                                            checked={row.include}
                                            onCheckedChange={(checked) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, include: Boolean(checked) } : r))}
                                        />
                                        {row.imageUrl ? (
                                            <Image src={row.imageUrl} alt="" width={40} height={40} className="size-10 rounded object-cover" unoptimized />
                                        ) : <div className="size-10 rounded bg-slate-100" />}
                                        <Input
                                            value={row.name}
                                            onChange={(event) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, name: event.target.value } : r))}
                                            className="h-9 flex-1"
                                        />
                                        <Input
                                            value={row.price}
                                            onChange={(event) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, price: event.target.value } : r))}
                                            placeholder="Precio"
                                            className="h-9 w-28"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 border-t pt-3 text-sm dark:border-slate-800">
                                <label htmlFor="initial-stock" className="text-slate-600 dark:text-slate-400">Stock inicial por producto:</label>
                                <Input
                                    id="initial-stock"
                                    type="number"
                                    min={0}
                                    value={initialStock}
                                    onChange={(event) => setInitialStock(event.target.value)}
                                    className="h-9 w-24"
                                />
                                <span className="text-xs text-slate-400">Ajústalo después en el dashboard.</span>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setStep("input")}>Atrás</Button>
                                <Button onClick={handleImport} disabled={includedCount === 0}>
                                    Importar {includedCount} productos
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Importa tu catálogo</DialogTitle>
                                <DialogDescription>
                                    Pega el link de tu tienda actual (Shopify, WooCommerce, Instagram Shop, tu web…). Lo leemos y te proponemos los productos.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-2">
                                <Input
                                    value={url}
                                    onChange={(event) => setUrl(event.target.value)}
                                    placeholder="https://mitienda.com"
                                    disabled={step === "loading"}
                                    onKeyDown={(event) => { if (event.key === "Enter" && url.trim()) handleAnalyze() }}
                                />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAnalyze} disabled={step === "loading" || !url.trim()}>
                                    {step === "loading"
                                        ? <><Loader2 className="size-4 mr-2 animate-spin" /> Leyendo tu sitio…</>
                                        : <><Sparkles className="size-4 mr-2" /> Analizar mi tienda</>}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
