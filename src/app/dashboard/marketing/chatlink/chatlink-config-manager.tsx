"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Copy, ExternalLink, Check } from "lucide-react"
import { updateChatLinkConfig, type ChatLinkConfig, type ChatLinkProduct } from "./actions"

const MAX_PRODUCTS = 6

interface Props {
    slug: string
    initialConfig: ChatLinkConfig
    products: ChatLinkProduct[]
}

export function ChatLinkConfigManager({ slug, initialConfig, products }: Props) {
    const [greeting, setGreeting] = useState(initialConfig.greeting ?? "")
    const [productIds, setProductIds] = useState<string[]>(initialConfig.productIds ?? [])
    const [triggers, setTriggers] = useState<{ label: string; context: string }[]>(initialConfig.triggers ?? [])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [copied, setCopied] = useState(false)

    const chatlinkUrl = `https://landingchat.co/c/${slug}`

    const toggleProduct = (id: string) => {
        setSaved(false)
        setProductIds((prev) =>
            prev.includes(id)
                ? prev.filter((p) => p !== id)
                : prev.length >= MAX_PRODUCTS
                    ? prev
                    : [...prev, id],
        )
    }

    const addTrigger = () => {
        setSaved(false)
        setTriggers((prev) => [...prev, { label: "", context: "" }])
    }
    const updateTrigger = (i: number, field: "label" | "context", value: string) => {
        setSaved(false)
        setTriggers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
    }
    const removeTrigger = (i: number) => {
        setSaved(false)
        setTriggers((prev) => prev.filter((_, idx) => idx !== i))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        const cleanTriggers = triggers.filter((t) => t.label.trim() && t.context.trim())
        const res = await updateChatLinkConfig({
            greeting: greeting.trim() || undefined,
            productIds,
            triggers: cleanTriggers,
        })
        setSaving(false)
        if (res.success) setSaved(true)
        else alert(res.error)
    }

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(chatlinkUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            /* no-op */
        }
    }

    return (
        <div className="space-y-6">
            {/* Tu ChatLink */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Tu ChatLink</CardTitle>
                    <CardDescription>Pega este link en la bio de Instagram / TikTok.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                    <Input readOnly value={chatlinkUrl} className="max-w-sm bg-slate-50 text-muted-foreground" />
                    <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1.5">{copied ? "Copiado" : "Copiar"}</span>
                    </Button>
                    <a href={chatlinkUrl} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" /> <span className="ml-1.5">Ver</span>
                        </Button>
                    </a>
                </CardContent>
            </Card>

            {/* Saludo */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Mensaje de bienvenida</CardTitle>
                    <CardDescription>Si lo dejas vacío, usamos un saludo automático con el nombre del agente.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={greeting}
                        onChange={(e) => { setGreeting(e.target.value); setSaved(false) }}
                        placeholder="Ej: ¡Hola! Bienvenido a Moda Urbana. ¿Buscas las nuevas tendencias?"
                        rows={2}
                    />
                </CardContent>
            </Card>

            {/* Productos destacados */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Productos destacados ({productIds.length}/{MAX_PRODUCTS})</CardTitle>
                    <CardDescription>Elige hasta {MAX_PRODUCTS}. Si no eliges ninguno, mostramos los más nuevos.</CardDescription>
                </CardHeader>
                <CardContent>
                    {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes productos activos aún.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {products.map((p) => {
                                const selected = productIds.includes(p.id)
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => toggleProduct(p.id)}
                                        className={`relative overflow-hidden rounded-xl border text-left transition-colors ${selected ? "border-primary ring-2 ring-primary" : "border-slate-200 hover:border-slate-300"}`}
                                    >
                                        <div className="relative aspect-square w-full bg-slate-100">
                                            {p.image_url ? (
                                                <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="120px" />
                                            ) : null}
                                            {selected && (
                                                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                            )}
                                        </div>
                                        <p className="truncate px-2 py-1.5 text-xs font-medium text-slate-700">{p.name}</p>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Smart Triggers (chips) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Atajos al chat (chips)</CardTitle>
                    <CardDescription>Preguntas de 1 toque que abren el chat. Vacío = usamos 3 por defecto.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {triggers.map((t, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                            <Input
                                value={t.label}
                                onChange={(e) => updateTrigger(i, "label", e.target.value)}
                                placeholder="Texto del chip (ej: Envíos)"
                                className="max-w-[200px]"
                            />
                            <Input
                                value={t.context}
                                onChange={(e) => updateTrigger(i, "context", e.target.value)}
                                placeholder="Pregunta que abre el chat (ej: ¿Cómo son los envíos?)"
                                className="flex-1 min-w-[220px]"
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeTrigger(i)} aria-label="Eliminar chip">
                                <Trash2 className="h-4 w-4 text-slate-400" />
                            </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addTrigger}>
                        <Plus className="h-4 w-4" /> <span className="ml-1.5">Agregar chip</span>
                    </Button>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3">
                <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cambios"}
                </Button>
                {saved && <span className="text-sm text-emerald-600">Guardado ✓</span>}
            </div>
        </div>
    )
}
