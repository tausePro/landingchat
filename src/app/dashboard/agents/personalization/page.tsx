"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getProducts, ProductData } from "@/app/dashboard/products/actions"
import { getAgents, updateAgent } from "@/app/dashboard/agents/actions"

interface PersonalizationConfig {
    enabled: boolean
    configurable_products: string[] // Product IDs
    initial_message: string
    rules: Array<{
        product_id: string
        option_name: string
        option_value: string
        price_adjustment: number
    }>
}

export default function PersonalizationAgentPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [agentId, setAgentId] = useState<string | null>(null)
    const [products, setProducts] = useState<ProductData[]>([])

    // Config State
    const [enabled, setEnabled] = useState(false)
    const [selectedProducts, setSelectedProducts] = useState<string[]>([])
    const [initialMessage, setInitialMessage] = useState("¡Hola! Estoy aquí para ayudarte a personalizar tu producto. ¿Qué te gustaría crear hoy?")
    const [rules, setRules] = useState<PersonalizationConfig['rules']>([])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [productsResult, agentsData] = await Promise.all([
                getProducts(),
                getAgents()
            ])

            // Filter only configurable products
            const productsData = productsResult.success ? productsResult.data : []
            setProducts(productsData.filter(p => p.is_configurable))

            if (agentsData.length > 0) {
                const agent = agentsData[0] // Assuming single agent for now
                setAgentId(agent.id)

                const config = agent.personalization_config as PersonalizationConfig
                if (config) {
                    setEnabled(config.enabled ?? false)
                    setSelectedProducts(config.configurable_products ?? [])
                    setInitialMessage(config.initial_message ?? "¡Hola! Estoy aquí para ayudarte a personalizar tu producto. ¿Qué te gustaría crear hoy?")
                    setRules(config.rules ?? [])
                }
            }
        } catch (error) {
            console.error("Error loading data:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!agentId) return
        setSaving(true)
        try {
            const config: PersonalizationConfig = {
                enabled,
                configurable_products: selectedProducts,
                initial_message: initialMessage,
                rules
            }

            await updateAgent(agentId, { personalization_config: config })
            alert("Configuración guardada correctamente")
        } catch (error) {
            alert("Error guardando configuración")
        } finally {
            setSaving(false)
        }
    }

    const toggleProduct = (productId: string) => {
        if (selectedProducts.includes(productId)) {
            setSelectedProducts(selectedProducts.filter(id => id !== productId))
        } else {
            setSelectedProducts([...selectedProducts, productId])
        }
    }

    const addRule = () => {
        setRules([...rules, { product_id: "", option_name: "", option_value: "", price_adjustment: 0 }])
    }

    const updateRule = (index: number, field: keyof typeof rules[0], value: any) => {
        const newRules = [...rules]
        newRules[index] = { ...newRules[index], [field]: value }
        setRules(newRules)
    }

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index))
    }

    if (loading) return <DashboardLayout><div>Cargando...</div></DashboardLayout>

    return (
        <DashboardLayout>
            <div className="p-8 max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">Agente de Personalización</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary mt-1">Configura cómo el agente ayuda a los clientes a personalizar productos</p>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Guardando..." : "Guardar Configuración"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {/* Activation */}
                        <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Activar Agente de Personalización</h2>
                                <p className="text-sm text-muted-foreground">Permite al agente guiar a los usuarios en la personalización.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={enabled}
                                    onChange={e => setEnabled(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        {/* Initial Message */}
                        <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark">
                            <h2 className="text-lg font-semibold mb-4">Mensaje Inicial</h2>
                            <Label>Mensaje de bienvenida del agente</Label>
                            <Input
                                value={initialMessage}
                                onChange={e => setInitialMessage(e.target.value)}
                                className="mt-2"
                            />
                        </div>

                        {/* Product Selection */}
                        <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark">
                            <h2 className="text-lg font-semibold mb-4">Productos Configurables</h2>
                            <p className="text-sm text-muted-foreground mb-4">Selecciona los productos que el agente puede ayudar a personalizar.</p>

                            {products.length === 0 ? (
                                <div className="text-center p-4 border border-dashed rounded-lg text-muted-foreground">
                                    No hay productos marcados como "Configurable". Ve a Productos y edita uno.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {products.map(product => (
                                        <div
                                            key={product.id}
                                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedProducts.includes(product.id) ? 'border-primary bg-primary/5' : 'border-border-light dark:border-border-dark hover:border-primary/50'}`}
                                            onClick={() => toggleProduct(product.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProducts.includes(product.id)}
                                                    onChange={() => { }} // Handled by div click
                                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span className="font-medium">{product.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Price Rules */}
                        <div className="p-6 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Reglas de Precio</h2>
                                    <p className="text-sm text-muted-foreground">Define cómo cambian los precios según las opciones elegidas.</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addRule}>
                                    <span className="material-symbols-outlined mr-2">add</span>
                                    Nueva Regla
                                </Button>
                            </div>

                            <div className="flex flex-col gap-4">
                                {rules.map((rule, index) => (
                                    <div key={index} className="p-4 border border-border-light dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <Label>Producto</Label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                                                    value={rule.product_id}
                                                    onChange={e => updateRule(index, 'product_id', e.target.value)}
                                                >
                                                    <option value="">Seleccionar producto...</option>
                                                    {products.filter(p => selectedProducts.includes(p.id)).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <Label>Ajuste de Precio (+/-)</Label>
                                                <Input
                                                    type="number"
                                                    value={rule.price_adjustment}
                                                    onChange={e => updateRule(index, 'price_adjustment', parseFloat(e.target.value))}
                                                    className="mt-2"
                                                />
                                            </div>
                                            <div>
                                                <Label>Opción (Ej: Tela)</Label>
                                                <Input
                                                    value={rule.option_name}
                                                    onChange={e => updateRule(index, 'option_name', e.target.value)}
                                                    className="mt-2"
                                                />
                                            </div>
                                            <div>
                                                <Label>Valor (Ej: Seda)</Label>
                                                <Input
                                                    value={rule.option_value}
                                                    onChange={e => updateRule(index, 'option_value', e.target.value)}
                                                    className="mt-2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={() => removeRule(index)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <span className="material-symbols-outlined mr-2">delete</span>
                                                Eliminar Regla
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {rules.length === 0 && (
                                    <div className="text-center text-sm text-muted-foreground py-4">
                                        No hay reglas definidas.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Live Preview */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8">
                            <div className="bg-white dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark shadow-lg overflow-hidden flex flex-col h-[600px]">
                                <div className="p-4 bg-primary text-white font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined">smart_toy</span>
                                    Vista Previa del Agente
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-4">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">AI</div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg rounded-tl-none shadow-sm max-w-[80%] text-sm">
                                            {initialMessage}
                                        </div>
                                    </div>
                                    {/* Mock user interaction */}
                                    <div className="flex gap-3 flex-row-reverse">
                                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs">Tú</div>
                                        <div className="bg-primary text-white p-3 rounded-lg rounded-tr-none shadow-sm max-w-[80%] text-sm">
                                            Quiero personalizar una camiseta.
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs">AI</div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg rounded-tl-none shadow-sm max-w-[80%] text-sm">
                                            ¡Claro! ¿Qué tipo de tela prefieres? Tenemos Algodón y Seda (+${rules.find(r => r.option_value.toLowerCase() === 'seda')?.price_adjustment || 0}).
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-900 border-t border-border-light dark:border-border-dark">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Escribe un mensaje..."
                                            className="w-full pl-4 pr-10 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                                            disabled
                                        />
                                        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-primary">
                                            <span className="material-symbols-outlined">send</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
