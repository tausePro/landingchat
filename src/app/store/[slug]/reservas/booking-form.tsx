"use client"

import { useState } from "react"
import Link from "next/link"
import { t } from "@/lib/i18n/storefront-strings"
import type { SupportedLocale } from "@/types/organization"

interface BookingDay {
    date: string
    dayName: string
    slots: Array<{ time: string; isoDate: string }>
}

interface BookingFormProps {
    slug: string
    locale: SupportedLocale
    storeLink: string
    days: BookingDay[]
}

/**
 * Form público de reserva: día → hora → datos → POST /api/bookings/create
 * (endpoint existente, rate-limited). La cita queda pendiente de
 * confirmación del equipo.
 */
export function BookingForm({ slug, locale, storeLink, days }: BookingFormProps) {
    const [selectedDay, setSelectedDay] = useState(days[0]?.date ?? "")
    const [selectedSlot, setSelectedSlot] = useState<string>("")
    const [service, setService] = useState("")
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmed, setConfirmed] = useState<{ date: string; time: string } | null>(null)

    const activeDay = days.find((day) => day.date === selectedDay)

    if (days.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-sm text-slate-500">{t("store.booking.no_slots", locale)}</p>
                <Link href={storeLink} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
                    {t("store.booking.back_to_store", locale)}
                </Link>
            </div>
        )
    }

    if (confirmed) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {t("store.booking.success_title", locale)}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                    {t("store.booking.success_body", locale, { date: confirmed.date, time: confirmed.time })}
                </p>
                <Link href={storeLink} className="text-sm font-semibold text-primary hover:underline">
                    {t("store.booking.back_to_store", locale)}
                </Link>
            </div>
        )
    }

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
                    proposedDate: selectedSlot,
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    customerEmail: email.trim() || undefined,
                    title: service.trim() || undefined,
                }),
            })
            const data = await response.json()

            if (response.ok && data.success) {
                setConfirmed({ date: data.appointment.date, time: data.appointment.time })
            } else if (response.status === 409) {
                setError(t("store.booking.error_conflict", locale))
            } else {
                setError(data.error || t("store.booking.error_generic", locale))
            }
        } catch {
            setError(t("store.booking.error_generic", locale))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                <p className="text-sm font-semibold text-slate-900">{t("store.booking.pick_slot", locale)}</p>

                {/* Días */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {days.map((day) => (
                        <button
                            key={day.date}
                            type="button"
                            onClick={() => { setSelectedDay(day.date); setSelectedSlot("") }}
                            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                                selectedDay === day.date
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                        >
                            <span className="block capitalize">{day.dayName}</span>
                            <span className="block text-[10px] text-slate-400">{day.date.slice(5)}</span>
                        </button>
                    ))}
                </div>

                {/* Horas */}
                <div className="grid grid-cols-4 gap-2">
                    {activeDay?.slots.map((slot) => (
                        <button
                            key={slot.isoDate}
                            type="button"
                            onClick={() => setSelectedSlot(slot.isoDate)}
                            className={`rounded-lg border px-2 py-2 text-xs font-mono transition-colors ${
                                selectedSlot === slot.isoDate
                                    ? "border-primary bg-primary text-white"
                                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                            }`}
                        >
                            {slot.time}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("store.booking.service_label", locale)}
                    </label>
                    <input
                        type="text"
                        value={service}
                        onChange={(event) => setService(event.target.value)}
                        maxLength={120}
                        placeholder={t("store.booking.service_placeholder", locale)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("store.booking.name_label", locale)}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        minLength={2}
                        maxLength={80}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("store.booking.phone_label", locale)}
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        required
                        minLength={7}
                        maxLength={20}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("store.booking.email_label", locale)}
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        maxLength={120}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}

            <button
                type="submit"
                disabled={submitting || !selectedSlot}
                className="w-full rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {submitting ? t("store.booking.submitting", locale) : t("store.booking.submit", locale)}
            </button>
        </form>
    )
}
