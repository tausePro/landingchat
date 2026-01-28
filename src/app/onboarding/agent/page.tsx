"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { createFirstAgent } from "../actions"

type AgentType = "sales" | "support" | "custom"

export default function AgentSetupPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [selectedType, setSelectedType] = useState<AgentType>("support")
    const [agentName, setAgentName] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const result = await createFirstAgent({
            type: selectedType,
            name: agentName || getDefaultName(selectedType)
        })
        
        if (result.success) {
            router.push("/onboarding/products")
        } else {
            const errorMsg = result.fieldErrors 
                ? Object.entries(result.fieldErrors).map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n")
                : result.error
            alert(`Error al crear el agente: ${errorMsg}`)
        }
        
        setLoading(false)
    }

    const handleSkip = () => {
        router.push("/onboarding/products")
    }

    const getDefaultName = (type: AgentType) => {
        switch (type) {
            case "sales": return "Asistente de Ventas"
            case "support": return "AyudaBot"
            case "custom": return "Mi Agente"
        }
    }

    return (
        <>
            <ProgressBar currentStep={2} totalSteps={5} stepLabel="Configura tu Agente" />

            <div className="flex flex-wrap justify-between gap-3">
                <div className="flex flex-col gap-2">
                    <p className="text-slate-900 dark:text-slate-50 text-3xl md:text-4xl font-black leading-tight tracking-tight">
                        Crea tu primer agente conversacional
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                        Elige una de nuestras plantillas para empezar rápidamente o crea uno desde cero con tus propias reglas.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Sales Agent */}
                <label className={`flex flex-col gap-4 rounded-xl border border-solid p-4 transition-all duration-200 cursor-pointer ${selectedType === "sales"
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-slate-200 dark:border-slate-700"
                    } bg-white dark:bg-slate-800/50`}>
                    <div className="flex items-center gap-4">
                        <input
                            className="form-radio"
                            type="radio"
                            name="agent_type"
                            value="sales"
                            checked={selectedType === "sales"}
                            onChange={() => setSelectedType("sales")}
                        />
                        <span className="material-symbols-outlined text-primary text-2xl">shopping_cart</span>
                        <div className="flex grow flex-col">
                            <p className="text-slate-900 dark:text-slate-200 text-base font-semibold leading-normal">
                                Agente de Ventas
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                                Diseñado para guiar a los clientes en el proceso de compra y cerrar ventas.
                            </p>
                        </div>
                    </div>
                    {selectedType === "sales" && (
                        <div className="pl-10 ml-1 flex flex-col gap-2">
                            <label className="flex flex-col min-w-40 flex-1">
                                <p className="text-slate-800 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                                    Nombre del Agente
                                </p>
                                <input
                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-300 dark:border-slate-600 bg-background-light dark:bg-slate-900/50 focus:border-primary dark:focus:border-primary h-12 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 text-base font-normal leading-normal"
                                    placeholder="Ej: 'Asistente de Ventas'"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                />
                            </label>
                        </div>
                    )}
                </label>

                {/* Support Agent */}
                <label className={`flex flex-col gap-4 rounded-xl border border-solid p-4 transition-all duration-200 cursor-pointer ${selectedType === "support"
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-slate-200 dark:border-slate-700"
                    } bg-white dark:bg-slate-800/50`}>
                    <div className="flex items-center gap-4">
                        <input
                            className="form-radio"
                            type="radio"
                            name="agent_type"
                            value="support"
                            checked={selectedType === "support"}
                            onChange={() => setSelectedType("support")}
                        />
                        <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
                        <div className="flex grow flex-col">
                            <p className="text-slate-900 dark:text-slate-200 text-base font-semibold leading-normal">
                                Agente de Soporte
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                                Ideal para resolver dudas frecuentes y ofrecer asistencia post-venta a tus clientes.
                            </p>
                        </div>
                    </div>
                    {selectedType === "support" && (
                        <div className="pl-10 ml-1 flex flex-col gap-2">
                            <label className="flex flex-col min-w-40 flex-1">
                                <p className="text-slate-800 dark:text-slate-300 text-sm font-medium leading-normal pb-2">
                                    Nombre del Agente
                                </p>
                                <input
                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-300 dark:border-slate-600 bg-background-light dark:bg-slate-900/50 focus:border-primary dark:focus:border-primary h-12 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 text-base font-normal leading-normal"
                                    placeholder="Ej: 'AyudaBot'"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                />
                            </label>
                        </div>
                    )}
                </label>

                {/* Custom Agent */}
                <label className={`flex items-center gap-4 rounded-xl border border-solid p-4 transition-all duration-200 cursor-pointer ${selectedType === "custom"
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-slate-200 dark:border-slate-700"
                    } bg-white dark:bg-slate-800/50`}>
                    <input
                        className="form-radio"
                        type="radio"
                        name="agent_type"
                        value="custom"
                        checked={selectedType === "custom"}
                        onChange={() => setSelectedType("custom")}
                    />
                    <span className="material-symbols-outlined text-primary text-2xl">add_circle</span>
                    <div className="flex grow flex-col">
                        <p className="text-slate-900 dark:text-slate-200 text-base font-semibold leading-normal">
                            Crear Agente Personalizado
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Define el comportamiento, tono y objetivos de tu agente desde cero.
                        </p>
                    </div>
                </label>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSkip}
                        className="px-4 py-2.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        Omitir este paso
                    </Button>
                    <Button type="submit" disabled={loading} className="px-5 py-2.5">
                        {loading ? "Creando..." : "Configurar Agente"}
                    </Button>
                </div>
            </form>
        </>
    )
}
