"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    RefreshCw,
    Users,
    DollarSign,
    TrendingUp,
    Clock,
    Edit,
    Trash2,
    Plus,
    Rocket,
    Target,
    Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
    getFoundingProgram,
    updateFoundingProgram,
    toggleFoundingProgram,
    getFoundingTiersWithStats,
    updateFoundingTier,
    getFoundingMetrics,
    getFoundingSlots,
} from "./actions"
import {
    type FoundingProgram,
    type FoundingTier,
    type FoundingMetrics,
    type FoundingSlotWithRelations,
    formatFoundingPrice,
    calculateAnnualPrice,
} from "@/types"

export default function FoundingAdminPage() {
    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<FoundingProgram | null>(null)
    const [tiers, setTiers] = useState<Array<FoundingTier & { slots_remaining: number; slots_claimed: number; current_price: number }>>([])
    const [metrics, setMetrics] = useState<FoundingMetrics | null>(null)
    const [slots, setSlots] = useState<FoundingSlotWithRelations[]>([])

    // Dialog states
    const [editingTier, setEditingTier] = useState<FoundingTier | null>(null)
    const [showProgramSettings, setShowProgramSettings] = useState(false)

    const loadData = async () => {
        setLoading(true)

        const [programResult, tiersResult] = await Promise.all([
            getFoundingProgram(),
            program?.id ? getFoundingTiersWithStats(program.id) : Promise.resolve({ success: false, data: [] }),
        ])

        if (programResult.success && programResult.data) {
            setProgram(programResult.data)

            // Load tiers and metrics with program ID
            const [tiersRes, metricsRes, slotsRes] = await Promise.all([
                getFoundingTiersWithStats(programResult.data.id),
                getFoundingMetrics(programResult.data.id),
                getFoundingSlots(programResult.data.id),
            ])

            if (tiersRes.success) setTiers(tiersRes.data || [])
            if (metricsRes.success) setMetrics(metricsRes.data || null)
            if (slotsRes.success) setSlots(slotsRes.data || [])
        }

        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleToggleProgram = async () => {
        if (!program) return

        const result = await toggleFoundingProgram(program.id, !program.is_active)
        if (result.success) {
            toast.success(program.is_active ? "Programa desactivado" : "¡Programa activado!")
            loadData()
        } else {
            toast.error(result.error)
        }
    }

    const handleSaveTier = async (tierId: string, data: Partial<FoundingTier>) => {
        const result = await updateFoundingTier(tierId, data)
        if (result.success) {
            toast.success("Tier actualizado")
            setEditingTier(null)
            loadData()
        } else {
            toast.error(result.error)
        }
    }

    const handleSaveProgram = async (data: Partial<FoundingProgram>) => {
        if (!program) return

        const result = await updateFoundingProgram(program.id, data)
        if (result.success) {
            toast.success("Configuración guardada")
            setShowProgramSettings(false)
            loadData()
        } else {
            toast.error(result.error)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!program) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">No hay programa de founding configurado.</p>
                <p className="text-sm text-muted-foreground mt-2">
                    Ejecuta la migración para crear el programa inicial.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Rocket className="h-6 w-6 text-primary" />
                        Founding Members
                    </h2>
                    <p className="text-muted-foreground">
                        Configura el programa de early adopters y preventa.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={loadData}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowProgramSettings(true)}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Configuración
                    </Button>
                    <Button
                        variant={program.is_active ? "destructive" : "default"}
                        onClick={handleToggleProgram}
                    >
                        {program.is_active ? "Desactivar" : "Activar Programa"}
                    </Button>
                </div>
            </div>

            {/* Status Banner */}
            <Card className={program.is_active ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" : "border-amber-500 bg-amber-50/50 dark:bg-amber-900/10"}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Badge className={program.is_active ? "bg-green-500" : "bg-amber-500"}>
                                {program.is_active ? "ACTIVO" : "INACTIVO"}
                            </Badge>
                            <span className="text-sm">
                                {program.is_active
                                    ? `Programa activo desde ${new Date(program.starts_at || "").toLocaleDateString("es-CO")}`
                                    : "El programa no está visible para usuarios"}
                            </span>
                        </div>
                        {metrics && (
                            <div className="flex items-center gap-6 text-sm">
                                <span className="font-medium">
                                    {metrics.slots_remaining}/{metrics.total_slots} cupos disponibles
                                </span>
                                <span className="text-green-600 font-medium">
                                    {formatFoundingPrice(metrics.revenue_current)} recaudado
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Metrics Cards */}
            {metrics && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Cupos Restantes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="text-3xl font-bold">{metrics.slots_remaining}</span>
                                <Target className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                de {metrics.total_slots} totales
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Cupos Activos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="text-3xl font-bold">{metrics.slots_by_status.active || 0}</span>
                                <Users className="h-8 w-8 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {metrics.slots_by_status.reserved || 0} reservados
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Ingresos Actuales
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-bold">
                                    {formatFoundingPrice(metrics.revenue_current)}
                                </span>
                                <DollarSign className="h-8 w-8 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Potencial: {formatFoundingPrice(metrics.revenue_potential)}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tasa de Conversión
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="text-3xl font-bold">{metrics.conversion_rate}%</span>
                                <TrendingUp className="h-8 w-8 text-blue-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                reserva → pago
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tiers Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Planes Founding</CardTitle>
                            <CardDescription>
                                Configura precios, cupos y beneficios de cada nivel.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan</TableHead>
                                <TableHead>Precio Founding</TableHead>
                                <TableHead>Precio Actual</TableHead>
                                <TableHead>Precio Regular</TableHead>
                                <TableHead>Cupos</TableHead>
                                <TableHead>Incremento/Semana</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tiers.map((tier) => {
                                const annual = calculateAnnualPrice(tier.current_price, program.free_months)
                                return (
                                    <TableRow key={tier.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{tier.name}</span>
                                                {tier.is_popular && (
                                                    <Badge variant="secondary">Popular</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {tier.description}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium">
                                                {formatFoundingPrice(tier.founding_price)}/mes
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-primary">
                                                {formatFoundingPrice(tier.current_price)}/mes
                                            </span>
                                            <p className="text-xs text-muted-foreground">
                                                Anual: {formatFoundingPrice(annual.totalPrice)}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <span className="line-through text-muted-foreground">
                                                {formatFoundingPrice(tier.regular_price)}/mes
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {tier.slots_claimed}/{tier.total_slots}
                                                </span>
                                                <Badge variant={tier.slots_remaining <= 5 ? "destructive" : "secondary"}>
                                                    {tier.slots_remaining} restantes
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {tier.price_increase_amount ? (
                                                <span className="text-amber-600 font-medium">
                                                    +{formatFoundingPrice(tier.price_increase_amount)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    +{program.price_increase_percentage}%
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingTier(tier)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Recent Slots */}
            <Card>
                <CardHeader>
                    <CardTitle>Founding Members Recientes</CardTitle>
                    <CardDescription>
                        Últimos early adopters que tomaron un cupo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {slots.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No hay founding members aún.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Organización</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Precio Congelado</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Fecha</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {slots.slice(0, 10).map((slot) => (
                                    <TableRow key={slot.id}>
                                        <TableCell className="font-mono">
                                            #{slot.slot_number}
                                        </TableCell>
                                        <TableCell>
                                            {slot.organization ? (
                                                <div>
                                                    <p className="font-medium">{slot.organization.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {slot.organization.subdomain}.landingchat.co
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {slot.tier?.name || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium">
                                                {formatFoundingPrice(slot.locked_price)}/mes
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    slot.status === "active" ? "default" :
                                                        slot.status === "reserved" ? "secondary" :
                                                            "destructive"
                                                }
                                            >
                                                {slot.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(slot.reserved_at).toLocaleDateString("es-CO")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Tier Dialog */}
            {editingTier && (
                <TierEditDialog
                    tier={editingTier}
                    onClose={() => setEditingTier(null)}
                    onSave={(data) => handleSaveTier(editingTier.id, data)}
                />
            )}

            {/* Program Settings Dialog */}
            {showProgramSettings && program && (
                <ProgramSettingsDialog
                    program={program}
                    onClose={() => setShowProgramSettings(false)}
                    onSave={handleSaveProgram}
                />
            )}
        </div>
    )
}

// =============================================================================
// DIALOGS
// =============================================================================

function TierEditDialog({
    tier,
    onClose,
    onSave,
}: {
    tier: FoundingTier
    onClose: () => void
    onSave: (data: Partial<FoundingTier>) => void
}) {
    const [formData, setFormData] = useState({
        name: tier.name,
        description: tier.description || "",
        total_slots: tier.total_slots,
        founding_price: tier.founding_price,
        regular_price: tier.regular_price,
        price_increase_amount: tier.price_increase_amount || 0,
        max_products: tier.max_products,
        max_agents: tier.max_agents,
        max_monthly_conversations: tier.max_monthly_conversations,
        is_popular: tier.is_popular,
        badge_text: tier.badge_text || "",
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({
            ...formData,
            price_increase_amount: formData.price_increase_amount || null,
            badge_text: formData.badge_text || null,
            description: formData.description || null,
        })
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Plan: {tier.name}</DialogTitle>
                    <DialogDescription>
                        Configura precios, cupos y límites del plan.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Badge</Label>
                            <Input
                                value={formData.badge_text}
                                onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                                placeholder="30 CUPOS"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Precio Founding (COP/mes)</Label>
                            <Input
                                type="number"
                                value={formData.founding_price}
                                onChange={(e) => setFormData({ ...formData, founding_price: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio Regular (COP/mes)</Label>
                            <Input
                                type="number"
                                value={formData.regular_price}
                                onChange={(e) => setFormData({ ...formData, regular_price: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Incremento/Semana (COP)</Label>
                            <Input
                                type="number"
                                value={formData.price_increase_amount}
                                onChange={(e) => setFormData({ ...formData, price_increase_amount: Number(e.target.value) })}
                                placeholder="0 = usar % del programa"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Total Cupos</Label>
                            <Input
                                type="number"
                                value={formData.total_slots}
                                onChange={(e) => setFormData({ ...formData, total_slots: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Máx. Productos</Label>
                            <Input
                                type="number"
                                value={formData.max_products}
                                onChange={(e) => setFormData({ ...formData, max_products: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Máx. Agentes</Label>
                            <Input
                                type="number"
                                value={formData.max_agents}
                                onChange={(e) => setFormData({ ...formData, max_agents: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Conv/Mes</Label>
                            <Input
                                type="number"
                                value={formData.max_monthly_conversations}
                                onChange={(e) => setFormData({ ...formData, max_monthly_conversations: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={formData.is_popular}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
                        />
                        <Label>Marcar como "Más Popular"</Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Guardar Cambios</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function ProgramSettingsDialog({
    program,
    onClose,
    onSave,
}: {
    program: FoundingProgram
    onClose: () => void
    onSave: (data: Partial<FoundingProgram>) => void
}) {
    const [formData, setFormData] = useState({
        total_slots: program.total_slots,
        free_months: program.free_months,
        price_increase_enabled: program.price_increase_enabled,
        price_increase_interval_days: program.price_increase_interval_days,
        price_increase_percentage: program.price_increase_percentage,
        hero_title: program.hero_title,
        hero_subtitle: program.hero_subtitle,
        hero_description: program.hero_description,
        cta_button_text: program.cta_button_text,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(formData)
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Configuración del Programa</DialogTitle>
                    <DialogDescription>
                        Configura los parámetros globales del programa founding.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Total de Cupos</Label>
                            <Input
                                type="number"
                                value={formData.total_slots}
                                onChange={(e) => setFormData({ ...formData, total_slots: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Meses Gratis</Label>
                            <Input
                                type="number"
                                value={formData.free_months}
                                onChange={(e) => setFormData({ ...formData, free_months: Number(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Pagan {12 - formData.free_months} meses, obtienen 12
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Incremento cada X días</Label>
                            <Input
                                type="number"
                                value={formData.price_increase_interval_days}
                                onChange={(e) => setFormData({ ...formData, price_increase_interval_days: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Incremento Automático de Precio</p>
                            <p className="text-sm text-muted-foreground">
                                El precio sube {formData.price_increase_percentage}% cada {formData.price_increase_interval_days} días
                            </p>
                        </div>
                        <Switch
                            checked={formData.price_increase_enabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, price_increase_enabled: checked })}
                        />
                    </div>

                    {formData.price_increase_enabled && (
                        <div className="space-y-2">
                            <Label>Porcentaje de Incremento (%)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={formData.price_increase_percentage}
                                onChange={(e) => setFormData({ ...formData, price_increase_percentage: Number(e.target.value) })}
                            />
                        </div>
                    )}

                    <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-4">Textos de la Landing</h4>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Título Principal</Label>
                                <Input
                                    value={formData.hero_title}
                                    onChange={(e) => setFormData({ ...formData, hero_title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Subtítulo</Label>
                                <Input
                                    value={formData.hero_subtitle}
                                    onChange={(e) => setFormData({ ...formData, hero_subtitle: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Textarea
                                    value={formData.hero_description}
                                    onChange={(e) => setFormData({ ...formData, hero_description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Texto del Botón CTA</Label>
                                <Input
                                    value={formData.cta_button_text}
                                    onChange={(e) => setFormData({ ...formData, cta_button_text: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit">Guardar Configuración</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
