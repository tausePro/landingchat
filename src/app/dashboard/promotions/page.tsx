"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPromotions, createPromotion, deletePromotion, PromotionData } from "./actions"

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<PromotionData[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    // Form State
    const [name, setName] = useState("")
    const [type, setType] = useState<'percentage' | 'fixed' | 'bogo'>('percentage')
    const [value, setValue] = useState("")
    const [appliesTo, setAppliesTo] = useState<'all' | 'category' | 'products'>('all')
    const [chatMessage, setChatMessage] = useState("")

    useEffect(() => {
        loadPromotions()
    }, [])

    const loadPromotions = async () => {
        try {
            const data = await getPromotions()
            setPromotions(data)
        } catch (error) {
            console.error("Error loading promotions:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await createPromotion({
                name,
                type,
                value: parseFloat(value) || 0,
                applies_to: appliesTo,
                chat_message: chatMessage
            })
            setIsCreating(false)
            resetForm()
            loadPromotions()
        } catch (error) {
            alert("Error creating promotion")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta promoción?")) return
        try {
            await deletePromotion(id)
            loadPromotions()
        } catch (error) {
            alert("Error deleting promotion")
        }
    }

    const resetForm = () => {
        setName("")
        setType("percentage")
        setValue("")
        setAppliesTo("all")
        setChatMessage("")
    }

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">Promociones</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">Gestiona descuentos y ofertas especiales</p>
                    </div>
                    <Button onClick={() => setIsCreating(true)}>
                        <span className="material-symbols-outlined mr-2">add</span>
                        Nueva Promoción
                    </Button>
                </div>

                {isCreating && (
                    <div className="mb-8 p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark">
                        <h2 className="text-xl font-semibold mb-4">Crear Nueva Promoción</h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <Label>Nombre de la Promoción</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Descuento de Verano"
                                    required
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label>Tipo de Descuento</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                                    value={type}
                                    onChange={e => setType(e.target.value as any)}
                                >
                                    <option value="percentage">Porcentaje (%)</option>
                                    <option value="fixed">Monto Fijo ($)</option>
                                    <option value="bogo">2x1 (BOGO)</option>
                                </select>
                            </div>
                            <div>
                                <Label>Valor</Label>
                                <Input
                                    type="number"
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    placeholder="Ej: 20"
                                    required
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label>Aplica a</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                                    value={appliesTo}
                                    onChange={e => setAppliesTo(e.target.value as any)}
                                >
                                    <option value="all">Toda la tienda</option>
                                    <option value="category">Categoría específica</option>
                                    <option value="products">Productos específicos</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <Label>Mensaje del Agente (Preview)</Label>
                                <Input
                                    value={chatMessage}
                                    onChange={e => setChatMessage(e.target.value)}
                                    placeholder="Ej: ¡Aprovecha un 20% de descuento en toda la tienda!"
                                    className="mt-2"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Este mensaje será usado por el agente para promocionar la oferta.</p>
                            </div>

                            <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    Guardar Promoción
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map(promo => (
                        <div key={promo.id} className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark flex flex-col justify-between gap-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase">
                                        {promo.type}
                                    </span>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)} className="h-8 w-8">
                                        <span className="material-symbols-outlined text-red-500 text-lg">delete</span>
                                    </Button>
                                </div>
                                <h3 className="font-bold text-lg">{promo.name}</h3>
                                <p className="text-2xl font-bold text-primary mt-2">
                                    {promo.type === 'percentage' ? `${promo.value}% OFF` :
                                        promo.type === 'fixed' ? `$${promo.value} OFF` : '2x1'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Aplica a: {promo.applies_to === 'all' ? 'Toda la tienda' : promo.applies_to}
                                </p>
                            </div>
                            {promo.chat_message && (
                                <div className="bg-background-light dark:bg-background-dark p-3 rounded-lg text-sm italic border border-border-light dark:border-border-dark">
                                    "{promo.chat_message}"
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    )
}
