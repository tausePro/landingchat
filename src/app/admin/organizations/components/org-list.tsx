"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { OrganizationData, updateOrganizationStatus, deleteOrganization } from "../actions"
import { AssignPlanDialog } from "../../subscriptions/components/assign-plan-dialog"
import { LocaleDialog } from "./locale-dialog"
import { toast } from "sonner"
import { formatBogotaDate } from "@/lib/utils/date"

const PAGE_SIZE = 15

interface OrgListProps {
    initialData: {
        organizations: OrganizationData[]
        total: number
        totalPages: number
    }
}

export function OrgList({ initialData }: OrgListProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [assigningPlanFor, setAssigningPlanFor] = useState<OrganizationData | null>(null)
    const [editingLocaleFor, setEditingLocaleFor] = useState<OrganizationData | null>(null)

    // Filtro + paginación del lado del cliente: instantáneo y matchea nombre Y slug.
    const query = searchTerm.trim().toLowerCase()
    const filtered = query
        ? initialData.organizations.filter(
            (org) =>
                org.name.toLowerCase().includes(query) ||
                org.slug.toLowerCase().includes(query),
        )
        : initialData.organizations
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const handleStatusChange = async (id: string, status: 'active' | 'suspended' | 'archived') => {
        if (confirm(`¿Estás seguro de cambiar el estado a ${status}?`)) {
            setLoading(true)
            try {
                await updateOrganizationStatus(id, status)
                router.refresh()
            } catch {
                alert("Error al actualizar estado")
            } finally {
                setLoading(false)
            }
        }
    }

    const handleDelete = async (id: string, name: string) => {
        const confirmation = prompt(`Escribe "${name}" para confirmar la eliminación:`)
        if (confirmation !== name) {
            if (confirmation !== null) toast.error("El nombre no coincide. Operación cancelada.")
            return
        }
        setLoading(true)
        try {
            const result = await deleteOrganization(id)
            if (result.success) {
                toast.success(`Organización "${name}" eliminada`)
                router.refresh()
            } else {
                toast.error(result.error || "Error al eliminar")
            }
        } catch {
            toast.error("Error inesperado al eliminar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex w-full max-w-sm items-center space-x-2">
                    <Input
                        placeholder="Buscar organización..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                        className="h-9"
                    />
                </div>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-900">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Organización</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Moneda / Idioma</TableHead>
                            <TableHead>Usuarios</TableHead>
                            <TableHead>Chats</TableHead>
                            <TableHead>Fecha Registro</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageItems.map((org) => (
                            <TableRow key={org.id}>
                                <TableCell>
                                    <Link href={`/admin/organizations/${org.id}`} className="flex flex-col group">
                                        <span className="font-medium group-hover:text-indigo-600 group-hover:underline">{org.name}</span>
                                        <span className="text-xs text-muted-foreground">{org.slug}</span>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={
                                        org.status === 'active' ? 'default' :
                                            org.status === 'suspended' ? 'destructive' : 'secondary'
                                    }>
                                        {org.status === 'active' ? 'Activo' :
                                            org.status === 'suspended' ? 'Suspendido' : 'Archivado'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className="text-xs text-muted-foreground">
                                        {org.currency_code || "COP"} · {org.locale || "es-CO"}
                                    </span>
                                </TableCell>
                                <TableCell>{org.users_count}</TableCell>
                                <TableCell>{org.chats_count}</TableCell>
                                <TableCell>{formatBogotaDate(org.created_at)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Abrir menú</span>
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/organizations/${org.id}`}>Ver ficha 360</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(org.id)}>
                                                Copiar ID
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setAssigningPlanFor(org)}>
                                                Asignar plan
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setEditingLocaleFor(org)}>
                                                Idioma y moneda
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'active')}>
                                                Marcar Activo
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'suspended')} className="text-red-600">
                                                Suspender
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(org.id, org.name)}
                                                className="text-red-600 font-semibold"
                                                disabled={loading}
                                            >
                                                Eliminar Organización
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{filtered.length} organización{filtered.length === 1 ? "" : "es"}</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Anterior
                    </Button>
                    <span>Página {currentPage} de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Siguiente
                    </Button>
                </div>
            </div>

            {assigningPlanFor && (
                <AssignPlanDialog
                    organizationId={assigningPlanFor.id}
                    organizationName={assigningPlanFor.name}
                    open={!!assigningPlanFor}
                    onOpenChange={(open) => {
                        if (!open) setAssigningPlanFor(null)
                    }}
                    onSuccess={() => router.refresh()}
                />
            )}

            {editingLocaleFor && (
                <LocaleDialog
                    organizationId={editingLocaleFor.id}
                    organizationName={editingLocaleFor.name}
                    currentCurrency={editingLocaleFor.currency_code}
                    currentLocale={editingLocaleFor.locale}
                    currentCountry={editingLocaleFor.country_code}
                    open={!!editingLocaleFor}
                    onOpenChange={(open) => {
                        if (!open) setEditingLocaleFor(null)
                    }}
                    onSuccess={() => router.refresh()}
                />
            )}
        </div>
    )
}
