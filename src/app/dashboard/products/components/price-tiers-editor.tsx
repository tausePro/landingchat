"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PriceTier } from "@/types/product"

interface PriceTiersEditorProps {
    tiers: PriceTier[]
    onChange: (tiers: PriceTier[]) => void
    minimumQuantity?: number
    onMinimumQuantityChange?: (qty: number | undefined) => void
}

export function PriceTiersEditor({
    tiers,
    onChange,
    minimumQuantity,
    onMinimumQuantityChange
}: PriceTiersEditorProps) {

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1]
        const newMinQty = lastTier ? (lastTier.max_quantity || lastTier.min_quantity) + 1 : 1

        const newTier: PriceTier = {
            min_quantity: newMinQty,
            max_quantity: undefined,
            unit_price: 0,
            label: ""
        }
        onChange([...tiers, newTier])
    }

    const updateTier = (index: number, updates: Partial<PriceTier>) => {
        const updated = [...tiers]
        updated[index] = { ...updated[index], ...updates }
        onChange(updated)
    }

    const removeTier = (index: number) => {
        onChange(tiers.filter((_, i) => i !== index))
    }

    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(value)
    }

    return (
        <div className="space-y-4">
            {/* Cantidad mínima */}
            <div className="flex items-center gap-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex-1">
                    <Label className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Cantidad mínima de pedido
                    </Label>
                    <Input
                        type="number"
                        placeholder="12"
                        value={minimumQuantity || ""}
                        onChange={(e) => onMinimumQuantityChange?.(parseInt(e.target.value) || undefined)}
                        className="mt-1 h-9 text-sm"
                        min={1}
                    />
                </div>
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">
                    inventory
                </span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                    Rangos de Precios
                </h3>
                <Button type="button" onClick={addTier} size="sm" variant="outline">
                    <span className="material-symbols-outlined text-sm mr-1">add</span>
                    Agregar Rango
                </Button>
            </div>

            {tiers.length === 0 && (
                <div className="text-center py-6 text-text-light-secondary dark:text-text-dark-secondary text-sm border border-dashed border-border-light dark:border-border-dark rounded-lg">
                    <span className="material-symbols-outlined text-3xl mb-2 block opacity-50">price_change</span>
                    No hay rangos de precios configurados.
                    <br />
                    <span className="text-xs">Agrega rangos para ofrecer precios por cantidad.</span>
                </div>
            )}

            {/* Tiers table */}
            {tiers.length > 0 && (
                <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
                        <div className="col-span-2">Desde</div>
                        <div className="col-span-2">Hasta</div>
                        <div className="col-span-3">Precio/unidad</div>
                        <div className="col-span-3">Etiqueta</div>
                        <div className="col-span-2"></div>
                    </div>

                    {/* Tier rows */}
                    {tiers.map((tier, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-12 gap-2 p-3 border-t border-border-light dark:border-border-dark items-center"
                        >
                            <div className="col-span-2">
                                <Input
                                    type="number"
                                    value={tier.min_quantity}
                                    onChange={(e) => updateTier(index, { min_quantity: parseInt(e.target.value) || 1 })}
                                    className="h-8 text-sm"
                                    min={1}
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="number"
                                    value={tier.max_quantity || ""}
                                    onChange={(e) => updateTier(index, {
                                        max_quantity: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                    placeholder="∞"
                                    className="h-8 text-sm"
                                    min={tier.min_quantity}
                                />
                            </div>
                            <div className="col-span-3">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                                    <Input
                                        type="number"
                                        value={tier.unit_price || ""}
                                        onChange={(e) => updateTier(index, { unit_price: parseFloat(e.target.value) || 0 })}
                                        placeholder="25000"
                                        className="h-8 text-sm pl-5"
                                        step={100}
                                    />
                                </div>
                            </div>
                            <div className="col-span-3">
                                <Input
                                    value={tier.label || ""}
                                    onChange={(e) => updateTier(index, { label: e.target.value })}
                                    placeholder="Mayoreo"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="col-span-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => removeTier(index)}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Preview */}
            {tiers.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Vista previa para el cliente:
                    </p>
                    <div className="space-y-1">
                        {tiers.map((tier, idx) => (
                            <div key={idx} className="text-sm text-blue-700 dark:text-blue-300">
                                • {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} unidades: {formatPrice(tier.unit_price)}/u
                                {tier.label && <span className="ml-1 text-xs opacity-75">({tier.label})</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
