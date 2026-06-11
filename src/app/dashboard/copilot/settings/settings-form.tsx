"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { updateCopilotSettings } from "../actions"
import type { CopilotAutonomyLevel } from "@/lib/copilot/types"

interface CopilotSettingsFormProps {
    initialAutonomyLevel: CopilotAutonomyLevel
    initialNotifyOnInsight: boolean
    hasPersonalInstance: boolean
}

const AUTONOMY_OPTIONS: Array<{ value: CopilotAutonomyLevel; label: string; description: string; disabled?: boolean }> = [
    {
        value: "level_1_propose",
        label: "Nivel 1 — Solo propone",
        description: "El copilot analiza y sugiere. Nada se ejecuta sin que tú lo apruebes desde el dashboard.",
    },
    {
        value: "level_2_act_with_whitelist",
        label: "Nivel 2 — Ejecuta lo aprobado",
        description: "Al aprobar un insight, el copilot ejecuta las acciones seleccionadas (cupones, pausar/activar productos, avisos). Siempre dentro de la lista segura.",
    },
    {
        value: "level_3_full_autonomy",
        label: "Nivel 3 — Autonomía total (próximamente)",
        description: "Reservado: por ahora se comporta igual que el Nivel 2.",
        disabled: true,
    },
]

export function CopilotSettingsForm({ initialAutonomyLevel, initialNotifyOnInsight, hasPersonalInstance }: CopilotSettingsFormProps) {
    const [autonomyLevel, setAutonomyLevel] = useState<CopilotAutonomyLevel>(initialAutonomyLevel)
    const [notifyOnInsight, setNotifyOnInsight] = useState(initialNotifyOnInsight)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const result = await updateCopilotSettings({ autonomyLevel, notifyOnInsight })
            if (result.success) {
                toast.success("Configuración del copilot guardada")
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error inesperado al guardar")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Nivel de autonomía</CardTitle>
                    <CardDescription>
                        Cuánto puede hacer el copilot por ti. Puedes cambiarlo cuando quieras.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup
                        value={autonomyLevel}
                        onValueChange={(value) => setAutonomyLevel(value as CopilotAutonomyLevel)}
                        className="space-y-3"
                    >
                        {AUTONOMY_OPTIONS.map((option) => (
                            <div
                                key={option.value}
                                className={`flex items-start gap-3 rounded-lg border p-4 ${option.disabled ? "opacity-50" : ""}`}
                            >
                                <RadioGroupItem
                                    value={option.value}
                                    id={option.value}
                                    disabled={option.disabled}
                                    className="mt-1"
                                />
                                <div>
                                    <Label htmlFor={option.value} className="font-medium cursor-pointer">
                                        {option.label}
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Reporte semanal por WhatsApp</CardTitle>
                    <CardDescription>
                        Cada lunes a las 9:00 AM a tu WhatsApp personal.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <p className="text-sm font-medium">Recibir insights por WhatsApp</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {hasPersonalInstance
                                    ? "Tu WhatsApp personal está conectado."
                                    : "Conecta tu WhatsApp personal en Canales para activarlo — mientras tanto los insights quedan en este dashboard."}
                            </p>
                        </div>
                        <Switch
                            checked={notifyOnInsight}
                            onCheckedChange={setNotifyOnInsight}
                            disabled={!hasPersonalInstance}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </div>
    )
}
