import { ReactivateResultContent } from "./result-content"

export const dynamic = "force-dynamic"

export default async function ReactivateResultPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string }>
}) {
    const { id } = await searchParams
    return <ReactivateResultContent transactionId={id ?? null} />
}
