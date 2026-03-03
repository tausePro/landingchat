import { Suspense } from "react"
import { CampaignDetailView } from "./campaign-detail-view"

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <Suspense fallback={<CampaignDetailSkeleton />}>
                <CampaignDetailView campaignId={id} />
            </Suspense>
        </div>
    )
}

function CampaignDetailSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                ))}
            </div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
    )
}
