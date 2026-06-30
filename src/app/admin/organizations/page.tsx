import { getOrganizations } from "./actions"
import { OrgList } from "./components/org-list"

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage() {
    // Filtro y paginación del lado del cliente (plataforma con pocas orgs):
    // cargamos todas para que el buscador sea instantáneo y matchee nombre Y slug.
    const data = await getOrganizations(1, 1000, "")

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Organizaciones</h2>
                <p className="text-muted-foreground">
                    Gestiona todas las empresas registradas en la plataforma.
                </p>
            </div>

            <OrgList initialData={data} />
        </div>
    )
}
