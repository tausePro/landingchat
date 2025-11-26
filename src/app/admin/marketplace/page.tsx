import { getMarketplaceItems } from "./actions"
import { MarketplaceManager } from "./marketplace-manager"

export const dynamic = 'force-dynamic'

export default async function MarketplacePage() {
    const items = await getMarketplaceItems()

    return (
        <div className="container mx-auto py-6">
            <MarketplaceManager items={items || []} />
        </div>
    )
}
