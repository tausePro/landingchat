"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ItemForm } from "./components/item-form"
import { MarketplaceItemData } from "./actions"
import { deleteMarketplaceItem } from "./actions"
import { useRouter } from "next/navigation"

interface MarketplaceManagerProps {
    items: any[]
}

export function MarketplaceManager({ items }: MarketplaceManagerProps) {
    const router = useRouter()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<MarketplaceItemData | undefined>(undefined)

    const handleEdit = (item: any) => {
        // Map DB item to Form Data
        const formData: MarketplaceItemData = {
            id: item.id,
            type: item.type,
            name: item.name,
            description: item.description,
            icon: item.icon,
            base_price: item.base_price,
            cost: item.cost,
            billing_period: item.billing_period,
            config_schema: item.config_schema,
            is_active: item.is_active,
            // Agent specific
            agent_role: item.agent_templates?.[0]?.role,
            system_prompt: item.agent_templates?.[0]?.system_prompt,
            default_config: item.agent_templates?.[0]?.default_config,
        }
        setSelectedItem(formData)
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setSelectedItem(undefined)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este item?")) {
            await deleteMarketplaceItem(id)
            router.refresh()
        }
    }

    const handleSuccess = () => {
        setIsDialogOpen(false)
        router.refresh()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Marketplace</h2>
                    <p className="text-muted-foreground">
                        Gestiona los productos, agentes y planes que ofreces a tus clientes.
                    </p>
                </div>
                <Button onClick={handleCreate}>
                    <span className="material-symbols-outlined mr-2">add</span>
                    Nuevo Item
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedItem ? "Editar Item" : "Crear Nuevo Item"}
                        </DialogTitle>
                        <DialogDescription>
                            Configura los detalles del producto o agente que aparecerá en el marketplace.
                        </DialogDescription>
                    </DialogHeader>
                    <ItemForm initialData={selectedItem} onSuccess={handleSuccess} />
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => (
                    <Card key={item.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="text-4xl mb-2">{item.icon || '📦'}</div>
                                <Badge variant={item.is_active ? "default" : "secondary"}>
                                    {item.is_active ? "Activo" : "Inactivo"}
                                </Badge>
                            </div>
                            <CardTitle className="text-xl">{item.name}</CardTitle>
                            <CardDescription className="line-clamp-2">
                                {item.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Tipo:</span>
                                <span className="font-medium capitalize">{item.type.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Precio:</span>
                                <span className="font-bold text-green-600">
                                    ${item.base_price.toLocaleString()} / {item.billing_period}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Costo:</span>
                                <span className="font-medium text-slate-500">
                                    ${item.cost.toLocaleString()}
                                </span>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                                <span className="material-symbols-outlined text-red-500">delete</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                                <span className="material-symbols-outlined mr-2">edit</span>
                                Editar
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}
