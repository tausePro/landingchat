import { getFoundingLandingData } from "./actions"
import { FoundingLanding } from "./components/founding-landing"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "Founding Members - Solo 100 Cupos",
    description: "Acceso exclusivo para los primeros 100 Early Adopters. Precio congelado de por vida. Domina el Chat-Commerce antes que tu competencia.",
    openGraph: {
        title: "Founding Members | LandingChat",
        description: "Solo 100 cupos. Precio congelado de por vida.",
        type: "website",
    },
}

export default async function FoundingPage() {
    const result = await getFoundingLandingData()

    // Si el programa no está activo, redirigir al home
    if (!result.success || !result.data) {
        redirect("/")
    }

    return <FoundingLanding data={result.data} />
}
