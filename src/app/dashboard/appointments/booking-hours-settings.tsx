"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getBookingHours, updateBookingHours } from "./actions"

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour)

function formatHour(hour: number): string {
    return `${String(hour).padStart(2, "0")}:00`
}

/**
 * Horario de atención del booking (settings.booking). Define los slots que
 * ofrecen el chat AI, el storefront público y la API de reservas.
 */
export function BookingHoursSettings() {
    const [open, setOpen] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [dayStartHour, setDayStartHour] = useState(9)
    const [dayEndHour, setDayEndHour] = useState(18)
    const [skipSundays, setSkipSundays] = useState(true)

    useEffect(() => {
        if (!open || loaded) return
        getBookingHours().then((result) => {
            if (result.success) {
                setDayStartHour(result.data.dayStartHour)
                setDayEndHour(result.data.dayEndHour)
                setSkipSundays(result.data.skipSundays)
            }
            setLoaded(true)
        })
    }, [open, loaded])

    const handleSave = async () => {
        if (dayEndHour <= dayStartHour) {
            toast.error("La hora de cierre debe ser posterior a la de apertura")
            return
        }
        setSaving(true)
        try {
            const result = await updateBookingHours({ dayStartHour, dayEndHour, skipSundays })
            if (result.success) {
                toast.success("Horario de atención guardado")
                setOpen(false)
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
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <span className="material-symbols-outlined text-lg mr-1.5">schedule</span>
                Horario de atención
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Horario de atención</DialogTitle>
                        <DialogDescription>
                            Define las horas en que ofreces citas. Aplica a los horarios que
                            propone el agente AI en el chat y a las reservas del storefront.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-2">
                        <div className="space-y-2">
                            <Label>Apertura</Label>
                            <Select value={String(dayStartHour)} onValueChange={(value) => setDayStartHour(Number(value))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {HOUR_OPTIONS.slice(0, 23).map((hour) => (
                                        <SelectItem key={hour} value={String(hour)}>{formatHour(hour)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Cierre</Label>
                            <Select value={String(dayEndHour)} onValueChange={(value) => setDayEndHour(Number(value))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {HOUR_OPTIONS.slice(1).concat(24).map((hour) => (
                                        <SelectItem key={hour} value={String(hour)}>{formatHour(hour)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="text-sm font-medium">Cerrado los domingos</p>
                            <p className="text-xs text-muted-foreground">Si lo apagas, también se ofrecen domingos</p>
                        </div>
                        <Switch checked={skipSundays} onCheckedChange={setSkipSundays} />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
