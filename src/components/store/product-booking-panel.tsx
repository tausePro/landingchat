"use client"

import { useState, useEffect, useCallback } from "react"
import { t } from "@/lib/i18n/storefront-strings"
import type { SupportedLocale } from "@/types/organization"

interface ProductBookingPanelProps {
    slug: string
    /** Nombre del servicio (producto) — va como título de la cita. */
    serviceName: string
    primaryColor: string
    locale: SupportedLocale
}

interface AvailableDay {
    date: string
    dayName: string
    slots: Array<{ time: string; isoDate: string }>
}

/**
 * Panel de reserva embebido en el PDP de un producto reservable
 * (Booking Fase 2b). Mismo patrón que el BookingPanel de propiedades de la
 * vertical inmobiliaria: disponibilidad real + cita con el servicio prefijado.
 */
export function ProductBookingPanel({ slug, serviceName, primaryColor, locale }: ProductBookingPanelProps) {
    const [availability, setAvailability] = useState<AvailableDay[]>([])
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<{ time: string; isoDate: string } | null>(null)
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [loadingSlots, setLoadingSlots] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState<{ date: string; time: string } | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchAvailability = useCallback(async () => {
        setLoadingSlots(true)
        try {
            const response = await fetch("/api/bookings/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, date: new Date().toISOString(), daysAhead: 8 }),
            })
            const data = await response.json()
            if (data.availability) {
                setAvailability(data.availability)
                if (data.availability.length > 0) setSelectedDate(data.availability[0].date)
            }
        } catch {
            // Sin disponibilidad cargable: el panel muestra el empty state
        } finally {
            setLoadingSlots(false)
        }
    }, [slug])

    useEffect(() => {
        fetchAvailability()
    }, [fetchAvailability])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!selectedSlot) return
        setError(null)
        setSubmitting(true)
        try {
            const response = await fetch("/api/bookings/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug,
                    proposedDate: selectedSlot.isoDate,
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    title: serviceName,
                }),
            })
            const data = await response.json()
            if (response.ok && data.success) {
                setSuccess({ date: data.appointment.date, time: data.appointment.time })
            } else if (response.status === 409) {
                setError(t("store.booking.error_conflict", locale))
                fetchAvailability()
            } else {
                setError(data.error || t("store.booking.error_generic", locale))
            }
        } catch {
            setError(t("store.booking.error_generic", locale))
        } finally {
            setSubmitting(false)
        }
    }

    const activeDay = availability.find((day) => day.date === selectedDate)

    return (
        <div id="product-booking" className="mt-8 scroll-mt-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-xl" style={{ color: primaryColor }}>event_available</span>
                {t("store.booking.title", locale)}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("store.booking.subtitle", locale)}
            </p>

            {success ? (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 p-4 text-center">
                    <div className="text-3xl mb-2">🎉</div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                        {t("store.booking.success_title", locale)}
                    </p>
                    <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                        {t("store.booking.success_body", locale, { date: success.date, time: success.time })}
                    </p>
                </div>
            ) : loadingSlots ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                    ))}
                </div>
            ) : availability.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">{t("store.booking.no_slots", locale)}</p>
            ) : (
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {availability.map((day) => (
                            <button
                                key={day.date}
                                type="button"
                                onClick={() => { setSelectedDate(day.date); setSelectedSlot(null) }}
                                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    selectedDate === day.date
                                        ? "text-white"
                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                }`}
                                style={selectedDate === day.date ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                            >
                                <span className="capitalize">{day.dayName}</span>
                                <span className="ml-1 text-[10px] opacity-70">{day.date.slice(5)}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {activeDay?.slots.map((slot) => (
                            <button
                                key={slot.isoDate}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`rounded-lg border px-2 py-1.5 text-xs font-mono transition-colors ${
                                    selectedSlot?.isoDate === slot.isoDate
                                        ? "text-white"
                                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                }`}
                                style={selectedSlot?.isoDate === slot.isoDate ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                            >
                                {slot.time}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            minLength={2}
                            maxLength={80}
                            placeholder={t("store.booking.name_label", locale)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            required
                            minLength={7}
                            maxLength={20}
                            placeholder={t("store.booking.phone_label", locale)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting || !selectedSlot}
                        className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {submitting ? t("store.booking.submitting", locale) : t("store.booking.submit", locale)}
                    </button>
                </form>
            )}
        </div>
    )
}
