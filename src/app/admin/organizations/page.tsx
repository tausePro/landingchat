import { getOrganizations } from "./actions"
import { OrgList } from "./components/org-list"

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1
    const search = typeof searchParams.search === 'string' ? searchParams.search : ""

    const data = await getOrganizations(page, 10, search)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Organizaciones</h2>
                <p className="text-muted-foreground">
                    Gestiona todas las empresas registradas en la plataforma.
                </p>
            </div>

            <OrgList initialData={data} searchParams={searchParams} />
        </div>
    )
}
