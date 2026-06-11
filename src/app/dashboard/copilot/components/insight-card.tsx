"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { decideCopilotInsight } from "../actions"
import type { CopilotInsightRow } from "@/lib/copilot/types"

const STATUS_LABELS: Record<CopilotInsightRow["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
    proposed: { label: "Pendiente", variant: "default" },
    approved: { label: "Aprobado", variant: "default" },
    executed: { label: "Ejecutado", variant: "default" },
    dismissed: { label: "Rechazado", variant: "secondary" },
    expired: { label: "Expirado", variant: "secondary" },
}

interface InsightCardProps {
    insight: CopilotInsightRow
    mode: "pending" | "history"
}

/**
 * Card de un insight del copilot: body en markdown + acciones propuestas
 * con selección por checkbox + modales de confirmación (aprobar/rechazar).
 */
export function InsightCard({ insight, mode }: InsightCardProps) {
    const router = useRouter()
    const [selected, setSelected] = useState<number[]>(
        insight.proposed_actions.map((_, index) => index)
    )
    const [approveOpen, setApproveOpen] = useState(false)
    const [dismissOpen, setDismissOpen] = useState(false)
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const generatedDate = new Date(insight.generated_at).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })

    const toggleAction = (index: number) =>
        setSelected((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort())

    const handleDecision = async (decision: "approve" | "dismiss") => {
        setSubmitting(true)
        try {
            const result = await decideCopilotInsight({
                insightId: insight.id,
                decision,
                note: note.trim() || undefined,
                actionIndices: decision === "approve" ? selected : undefined,
            })
            if (result.success) {
                if (decision === "approve") {
                    const { executed, failed } = result.data
                    if (failed > 0) {
                        toast.warning(`${executed} acciones ejecutadas, ${failed} fallaron (ver historial)`)
                    } else {
                        toast.success(executed > 0 ? `${executed} ${executed === 1 ? "acción ejecutada" : "acciones ejecutadas"}` : "Insight aprobado")
                    }
                } else {
                    toast.success("Insight rechazado")
                }
                setApproveOpen(false)
                setDismissOpen(false)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Error inesperado")
        } finally {
            setSubmitting(false)
        }
    }

    const status = STATUS_LABELS[insight.status]
    const selectedActions = insight.proposed_actions.filter((_, index) => selected.includes(index))

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {insight.scope === "weekly" ? "Reporte semanal" : "Insight"} · {generatedDate}
                    </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown>{insight.body}</ReactMarkdown>
                </div>

                {insight.proposed_actions.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-border-light dark:border-border-dark p-4">
                        <p className="text-sm font-semibold">Acciones propuestas</p>
                        {insight.proposed_actions.map((action, index) => (
                            <div key={index} className="flex items-start gap-2">
                                {mode === "pending" ? (
                                    <Checkbox
                                        id={`${insight.id}-action-${index}`}
                                        checked={selected.includes(index)}
                                        onCheckedChange={() => toggleAction(index)}
                                        className="mt-0.5"
                                    />
                                ) : (
                                    <span className="text-xs mt-0.5">•</span>
                                )}
                                <label
                                    htmlFor={`${insight.id}-action-${index}`}
                                    className="text-sm leading-snug cursor-pointer"
                                >
                                    {action.human_label}
                                    <Badge variant="outline" className="ml-2 text-[10px]">{action.kind}</Badge>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {mode === "history" && insight.decision_note && (
                    <p className="text-xs text-muted-foreground">Nota: {insight.decision_note}</p>
                )}

                {mode === "pending" && (
                    <div className="flex gap-3 pt-1">
                        <Button onClick={() => setApproveOpen(true)} disabled={submitting}>
                            Aprobar{selectedActions.length > 0 ? ` (${selectedActions.length})` : ""}
                        </Button>
                        <Button variant="outline" onClick={() => setDismissOpen(true)} disabled={submitting}>
                            Rechazar
                        </Button>
                    </div>
                )}
            </CardContent>

            {/* Modal de aprobación con preview del efecto */}
            <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar aprobación</DialogTitle>
                        <DialogDescription>
                            {selectedActions.length > 0
                                ? "Se ejecutarán estas acciones inmediatamente:"
                                : "No seleccionaste acciones — el insight se marcará como aprobado sin ejecutar nada."}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedActions.length > 0 && (
                        <ul className="space-y-1 text-sm list-disc pl-5">
                            {selectedActions.map((action, index) => (
                                <li key={index}>{action.human_label}</li>
                            ))}
                        </ul>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button onClick={() => handleDecision("approve")} disabled={submitting}>
                            {submitting ? "Ejecutando..." : "Confirmar y ejecutar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de rechazo con nota opcional */}
            <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rechazar insight</DialogTitle>
                        <DialogDescription>
                            Opcional: cuéntale al copilot por qué — mejora los próximos reportes.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Ej: este producto se pausa solo en temporada baja"
                        maxLength={500}
                        rows={3}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDismissOpen(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={() => handleDecision("dismiss")} disabled={submitting}>
                            {submitting ? "Guardando..." : "Rechazar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
