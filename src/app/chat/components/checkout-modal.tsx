"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCartStore } from "@/store/cart-store"
import { useTracking } from "@/components/analytics/tracking-provider"
import { createOrder } from "../actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { COLOMBIA_DEPARTMENTS } from "@/lib/constants/colombia-departments"

interface CheckoutModalProps {
    isOpen: boolean
    onClose: () => void
    slug: string
}


import { getAvailablePaymentGateways, getShippingConfig } from "../actions"
import { calculateShippingCost } from "@/lib/utils/shipping"
import { useEffect } from "react"

export function CheckoutModal({ isOpen, onClose, slug }: CheckoutModalProps) {
    const { items, total, clearCart } = useCartStore()
    const { trackInitiateCheckout } = useTracking()
    const [step, setStep] = useState<'contact' | 'payment' | 'success'>('contact')
    const [loading, setLoading] = useState(false)
    const [shippingConfig, setShippingConfig] = useState<any>(null)
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
    const [availableGateways, setAvailableGateways] = useState<Array<{provider: string, is_active: boolean, is_test_mode: boolean}>>([])
    const [gatewaysLoading, setGatewaysLoading] = useState(true)

    useEffect(() => {
        if (isOpen) {
            // Track InitiateCheckout event when modal opens
            const contentIds = items.map(item => item.id)
            trackInitiateCheckout(total(), "COP", contentIds)

            // Load shipping configuration
            getShippingConfig(slug).then(result => {
                if (result.success && result.config) {
                    setShippingConfig(result.config)
                } else {
                    // Default shipping config
                    setShippingConfig({
                        default_shipping_rate: 5000,
                        free_shipping_enabled: false,
                        free_shipping_min_amount: null,
                        free_shipping_zones: null
                    })
                }
            })

            // Load available payment gateways
            setGatewaysLoading(true)
            getAvailablePaymentGateways(slug).then(result => {
                if (result.success) {
                    setAvailableGateways(result.gateways)
                    // Set default payment method based on available gateways
                    if (result.gateways.length > 0) {
                        setPaymentMethod(result.gateways[0].provider as 'wompi' | 'epayco' | 'manual')
                    } else {
                        setPaymentMethod('manual')
                    }
                }
                setGatewaysLoading(false)
            })
        }
    }, [isOpen, slug])

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "", // Departamento
        // Tax/Invoicing fields
        document_type: "CC" as string,
        document_number: "",
        person_type: "Natural" as string,
        business_name: ""
    })

    const [paymentMethod, setPaymentMethod] = useState<'wompi' | 'epayco' | 'manual'>('manual')

    const subtotal = total()
    const shippingCost = shippingConfig ? calculateShippingCost(shippingConfig, subtotal, formData.city) : 0
    const finalTotal = subtotal + shippingCost

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleSubmitContact = (e: React.FormEvent) => {
        e.preventDefault()

        // Validate required fields
        if (!formData.document_type || !formData.document_number || !formData.person_type) {
            toast.error("Por favor completa todos los campos de facturación")
            return
        }
        
        if (!formData.state) {
            toast.error("Por favor selecciona tu departamento")
            return
        }

        // If Jurídica, business_name is recommended but not required
        if (formData.person_type === "Jurídica" && !formData.business_name) {
            toast.warning("Se recomienda ingresar el nombre de la empresa para personas jurídicas")
        }

        setStep('payment')
    }

    const handlePlaceOrder = async () => {
        setLoading(true)
        try {
            const result = await createOrder({
                slug,
                customerInfo: formData,
                items,
                subtotal,
                shippingCost,
                total: finalTotal,
                paymentMethod
            })

            if (result.success) {
                if (result.order) {
                    setCreatedOrderId(result.order.id) // Store ID for redirection
                }

                // If payment URL exists, redirect to gateway
                if (result.paymentUrl) {
                    window.location.href = result.paymentUrl
                    return
                }

                // Manual payment - show success
                setStep('success')
                clearCart()
            } else {
                toast.error("Error al crear la orden: " + result.error)
            }
        } catch (error) {
            console.error(error)
            toast.error("Ocurrió un error inesperado")
        } finally {
            setLoading(false)
        }
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(price)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] w-[95vw] bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>
                        {step === 'contact' && "Información de Envío"}
                        {step === 'payment' && "Pago y Confirmación"}
                        {step === 'success' && "¡Orden Recibida!"}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    {step === 'contact' && (
                        <form onSubmit={handleSubmitContact} className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Completo</Label>
                                <Input 
                                    id="name" 
                                    name="name" 
                                    required 
                                    value={formData.name} 
                                    onChange={handleInputChange} 
                                    placeholder="Ej. Juan Pérez"
                                    className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Email <span className="text-gray-400 text-xs font-normal">(Opcional)</span>
                                </Label>
                                <Input 
                                    id="email" 
                                    name="email" 
                                    type="email" 
                                    value={formData.email} 
                                    onChange={handleInputChange} 
                                    placeholder="juan@ejemplo.com"
                                    className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono (WhatsApp)</Label>
                                <div className="flex">
                                    <div className="inline-flex items-center justify-center px-4 rounded-l-xl border border-r-0 border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">
                                        🇨🇴 +57
                                    </div>
                                    <Input 
                                        id="phone" 
                                        name="phone" 
                                        type="tel" 
                                        required 
                                        value={formData.phone} 
                                        onChange={handleInputChange} 
                                        placeholder="300 123 4567"
                                        className="flex-1 h-12 rounded-l-none rounded-r-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Tax/Invoicing Fields */}
                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-dark mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">receipt_long</span> Información de Facturación
                                </h4>

                                <div>
                                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Documento de Identidad</Label>
                                    <div className="flex gap-2">
                                        <Select value={formData.document_type} onValueChange={(value) => handleSelectChange('document_type', value)}>
                                            <SelectTrigger className="w-28 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                                                <SelectItem value="CC" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">C.C.</SelectItem>
                                                <SelectItem value="NIT" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">NIT</SelectItem>
                                                <SelectItem value="CE" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">C.E.</SelectItem>
                                                <SelectItem value="Passport" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">Pas.</SelectItem>
                                                <SelectItem value="TI" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">T.I.</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input 
                                            id="document_number" 
                                            name="document_number" 
                                            required 
                                            value={formData.document_number} 
                                            onChange={handleInputChange} 
                                            placeholder="Número"
                                            className="flex-1 h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label 
                                        className={`relative flex items-center p-3 rounded-xl border cursor-pointer transition-all shadow-sm hover:border-primary dark:hover:border-primary ${
                                            formData.person_type === 'Natural' 
                                                ? 'border-primary bg-blue-50 dark:bg-blue-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                                        }`}
                                        onClick={() => handleSelectChange('person_type', 'Natural')}
                                    >
                                        <input 
                                            type="radio" 
                                            name="person_type" 
                                            checked={formData.person_type === 'Natural'}
                                            onChange={() => {}}
                                            className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary">
                                            Natural (Persona)
                                        </span>
                                    </label>
                                    <label 
                                        className={`relative flex items-center p-3 rounded-xl border cursor-pointer transition-all shadow-sm hover:border-primary dark:hover:border-primary ${
                                            formData.person_type === 'Jurídica' 
                                                ? 'border-primary bg-blue-50 dark:bg-blue-900/20' 
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                                        }`}
                                        onClick={() => handleSelectChange('person_type', 'Jurídica')}
                                    >
                                        <input 
                                            type="radio" 
                                            name="person_type" 
                                            checked={formData.person_type === 'Jurídica'}
                                            onChange={() => {}}
                                            className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300"
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary">
                                            Jurídica (Empresa)
                                        </span>
                                    </label>
                                </div>

                                {formData.person_type === "Jurídica" && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="business_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Empresa</Label>
                                        <Input 
                                            id="business_name" 
                                            name="business_name" 
                                            value={formData.business_name} 
                                            onChange={handleInputChange} 
                                            placeholder="Mi Empresa S.A.S."
                                            className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Ubicación</Label>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <Select value={formData.state} onValueChange={(value) => handleSelectChange('state', value)}>
                                        <SelectTrigger className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm">
                                            <SelectValue placeholder="Departamento" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg z-50">
                                            {COLOMBIA_DEPARTMENTS.map((dept) => (
                                                <SelectItem 
                                                    key={dept} 
                                                    value={dept} 
                                                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer px-3 py-2"
                                                >
                                                    {dept}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        id="city" 
                                        name="city" 
                                        required 
                                        value={formData.city} 
                                        onChange={handleInputChange} 
                                        placeholder="Ciudad"
                                        className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                    />
                                </div>
                                <Input 
                                    id="address" 
                                    name="address" 
                                    required 
                                    value={formData.address} 
                                    onChange={handleInputChange} 
                                    placeholder="Dirección completa"
                                    className="h-12 rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary shadow-sm"
                                />
                            </div>
                            <div className="pt-4 space-y-3">
                                <Button type="submit" className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold">
                                    Continuar al Pago
                                </Button>
                                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                                    <svg className="size-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="text-xs font-medium">Información segura y encriptada SSL 256-bit.</span>
                                </div>
                            </div>
                        </form>
                    )}

                    {step === 'payment' && (
                        <div className="space-y-6 py-4">
                            {/* Order Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Subtotal ({items.length} items)</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Envío</span>
                                    <span>{formatPrice(shippingCost)}</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-base">
                                    <span>Total a Pagar</span>
                                    <span className="text-primary">{formatPrice(finalTotal)}</span>
                                </div>
                            </div>

                            {/* Payment Method Selection */}
                            <div className="space-y-3">
                                <Label>Método de Pago</Label>
                                {gatewaysLoading ? (
                                    <div className="text-center py-4 text-slate-500">
                                        Cargando métodos de pago...
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Show available payment gateways */}
                                        {availableGateways.map((gateway) => (
                                            <div
                                                key={gateway.provider}
                                                className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === gateway.provider ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                                onClick={() => setPaymentMethod(gateway.provider as 'wompi' | 'epayco' | 'manual')}
                                            >
                                                <span className="font-bold">
                                                    {gateway.provider === 'wompi' && 'Wompi'}
                                                    {gateway.provider === 'epayco' && 'ePayco'}
                                                </span>
                                                <span className="text-xs text-center text-slate-500">
                                                    {gateway.provider === 'wompi' && 'Tarjetas, PSE, Nequi'}
                                                    {gateway.provider === 'epayco' && 'Tarjetas, PSE, Nequi'}
                                                </span>
                                                {gateway.is_test_mode && (
                                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                                        Pruebas
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {/* Always show manual payment option */}
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === 'manual' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                            onClick={() => setPaymentMethod('manual')}
                                        >
                                            <span className="font-bold">Transferencia</span>
                                            <span className="text-xs text-center text-slate-500">Bancolombia / Nequi</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setStep('contact')} className="flex-1">
                                        Atrás
                                    </Button>
                                    <Button onClick={handlePlaceOrder} disabled={loading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                                        {loading ? "Procesando..." : "Confirmar Orden"}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-slate-400 opacity-80">
                                    <svg className="size-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="text-xs font-medium">Información segura y encriptada SSL 256-bit.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-8 flex flex-col items-center text-center space-y-4">
                            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-3xl">check</span>
                            </div>
                            <h3 className="text-xl font-bold">¡Gracias por tu compra!</h3>
                            <p className="text-slate-500 max-w-xs">
                                Hemos recibido tu orden correctamente. Te enviaremos un correo con los detalles y el número de guía.
                            </p>
                            <Button
                                onClick={() => {
                                    if (createdOrderId) {
                                        window.location.href = `/store/${slug}/order/${createdOrderId}`
                                    } else {
                                        onClose()
                                    }
                                }}
                                className="mt-4 min-w-[200px]"
                            >
                                Ver Pedido
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}