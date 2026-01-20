import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getStorePage } from "../actions"
import { notFound } from "next/navigation"
import { PageEditor } from "./page-editor"

interface PageEditorPageProps {
    params: Promise<{ pageId: string }>
}

export default async function PageEditorPage({ params }: PageEditorPageProps) {
    const { pageId } = await params
    const page = await getStorePage(pageId)

    if (!page) {
        notFound()
    }

    return (
        <DashboardLayout>
            <PageEditor page={page} />
        </DashboardLayout>
    )
}
