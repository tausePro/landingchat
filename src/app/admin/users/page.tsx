import { getUsers } from "./actions"
import { UserList } from "./components/user-list"

export const dynamic = 'force-dynamic'

export default async function UsersPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1
    const search = typeof searchParams.search === 'string' ? searchParams.search : ""

    const data = await getUsers(page, 10, search)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
                <p className="text-muted-foreground">
                    Gestiona todos los usuarios, sus roles y permisos de acceso.
                </p>
            </div>

            <UserList initialData={data} searchParams={searchParams} />
        </div>
    )
}
