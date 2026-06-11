import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createServiceClient } from "@/lib/supabase/server"
import { getAppointmentAvailability } from "@/lib/appointments/service"
import { getTenantLocale } from "@/lib/i18n/tenant-locale"
import { t } from "@/lib/i18n/storefront-strings"
import { buildStoreCanonicalUrl, resolveDiscoveryOrganization } from "@/lib/seo/site-discovery"
import { getStoreLinkServer } from "@/lib/utils/store-urls-server"
import { BookingForm } from "./booking-form"

interface BookingPageProps {
    params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
    const { slug } = await params
    const organization = await resolveDiscoveryOrganization(createServiceClient(), { slug })
    if (!organization) return {}

    return {
        title: `${t("store.booking.title")} | ${organization.name}`,
        alternates: { canonical: buildStoreCanonicalUrl(organization, "/reservas") },
    }
}

/**
 * Booking de servicios en el storefront (Fase 2). Solo disponible para
 * orgs con el módulo `appointments` habilitado — el resto recibe 404.
 * Los slots salen de getAppointmentAvailability (horario configurable del
 * tenant + Google Calendar + citas existentes).
 */
export default async function BookingPage({ params }: BookingPageProps) {
    const { slug } = await params
    const supabase = createServiceClient()

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, name, slug, enabled_modules, locale, currency_code, country_code, custom_domain, settings")
        .eq("slug", slug)
        .single()

    if (!organization || !(organization.enabled_modules ?? []).includes("appointments")) {
        notFound()
    }

    const tenantLocale = getTenantLocale(organization)
    const locale = tenantLocale.locale
    const storeLink = await getStoreLinkServer("/", slug)

    const availabilityResult = await getAppointmentAvailability(supabase, {
        organizationId: organization.id,
        date: new Date(),
        daysAhead: 14,
        slotDurationMinutes: 60,
        slotStepMinutes: 60,
        includeEmptyDays: false,
    })

    const days = availabilityResult.availability
        .filter((day) => day.slots.length > 0)
        .map((day) => ({
            date: day.date,
            dayName: day.dayName,
            slots: day.slots.map((slot) => ({
                time: slot.time,
                isoDate: slot.isoDate,
            })),
        }))

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
                    <h2 className="text-lg font-semibold text-slate-700 mt-4">
                        {t("store.booking.title", locale)}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {t("store.booking.subtitle", locale)}
                    </p>
                </div>

                <BookingForm
                    slug={slug}
                    locale={locale}
                    storeLink={storeLink}
                    days={days}
                />
            </div>
        </div>
    )
}
