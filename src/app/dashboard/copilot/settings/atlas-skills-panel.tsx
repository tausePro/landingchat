"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ATLAS_SKILLS, isAtlasSkillEnabled, type AtlasSkillsConfig, type AtlasSkillId } from "@/lib/copilot/atlas-skills"
import { setAtlasSkillEnabled } from "../actions"

const TIER_LABEL: Record<string, string> = { free: "Incluido", pro: "Pro", premium: "Premium" }

export function AtlasSkillsPanel({ initialConfig }: { initialConfig: AtlasSkillsConfig }) {
    const [config, setConfig] = useState<AtlasSkillsConfig>(initialConfig ?? {})
    const [savingId, setSavingId] = useState<AtlasSkillId | null>(null)

    const handleToggle = async (id: AtlasSkillId, enabled: boolean) => {
        setSavingId(id)
        setConfig((prev) => ({ ...prev, [id]: { ...prev[id], enabled } })) // optimista
        try {
            const result = await setAtlasSkillEnabled({ skillId: id, enabled })
            if (result.success) {
                toast.success(enabled ? "Habilidad activada" : "Habilidad desactivada")
            } else {
                toast.error(result.error)
                setConfig((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !enabled } })) // revertir
            }
        } catch {
            toast.error("Error al guardar")
            setConfig((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !enabled } }))
        } finally {
            setSavingId(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Habilidades de Atlas</CardTitle>
                <CardDescription>
                    Las capacidades que Atlas puede usar para hacer crecer tu negocio. Activa las disponibles; las demás llegan pronto.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {ATLAS_SKILLS.map((skill) => {
                    const comingSoon = skill.status === "coming_soon"
                    const enabled = isAtlasSkillEnabled(skill.id, config)
                    return (
                        <div
                            key={skill.id}
                            className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${comingSoon ? "opacity-60" : ""}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                    <span className="material-symbols-outlined text-lg">{skill.icon}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm">{skill.name}</p>
                                        {comingSoon ? (
                                            <Badge variant="outline" className="text-[10px]">Próximamente</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">Activa</Badge>
                                        )}
                                        <Badge variant="outline" className="text-[10px]">{TIER_LABEL[skill.tier]}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{skill.description}</p>
                                </div>
                            </div>
                            <Switch
                                checked={enabled}
                                disabled={comingSoon || savingId === skill.id}
                                onCheckedChange={(checked) => handleToggle(skill.id, checked)}
                            />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
