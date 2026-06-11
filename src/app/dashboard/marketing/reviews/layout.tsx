import { DashboardLayout } from "@/components/layout/dashboard-layout"
import ReviewRequestsConfigPage from "./page"

// Mismo patrón que marketing/shipping: el layout monta el shell del dashboard
export default function ReviewRequestsPage() {
    return (
        <DashboardLayout>
            <ReviewRequestsConfigPage />
        </DashboardLayout>
    )
}
