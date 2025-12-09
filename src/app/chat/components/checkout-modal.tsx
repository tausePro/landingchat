"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCartStore } from "@/store/cart-store"
import { createOrder } from "../actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface CheckoutModalProps {
    isOpen: boolean
    onClose: () => void
    slug: string
}

export function CheckoutModal({ isOpen, onClose, slug }: CheckoutModalProps) {
    const { items, total, clearCart } = useCartStore()
    const [step, setStep] = useState<'contact' | 'payment' | 'success'>('contact')
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        // Tax/Invoicing fields
        document_type: "CC" as string,
        document_number: "",
        person_type: "Natural" as string,
        business_name: ""
    })

    const [paymentMethod, setPaymentMethod] = useState<'wompi' | 'manual'>('manual')

    const subtotal = total()
    const shippingCost = 5.00 // Fixed for now, should come from settings
    const finalTotal = subtotal + shippingCost

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleSubmitContact = (e: React.FormEvent) => {
        e.preventDefault()
        
        // Validate tax fields
        if (!formData.document_type || !formData.document_number || !formData.person_type) {
            toast.error("Por favor completa todos los campos de facturación")
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
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(price)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'contact' && "Información de Envío"}
                        {step === 'payment' && "Pago y Confirmación"}
                        {step === 'success' && "¡Orden Recibida!"}
                    </DialogTitle>
                </DialogHeader>

                {step === 'contact' && (
                    <form onSubmit={handleSubmitContact} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input id="name" name="name" required value={formData.name} onChange={handleInputChange} placeholder="Juan Pérez" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" required value={formData.email} onChange={handleInputChange} placeholder="juan@ejemplo.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleInputChange} placeholder="+57 300 123 4567" />
                        </div>
                        
                        {/* Tax/Invoicing Fields */}
                        <div className="border-t pt-4 space-y-4">
                            <h4 className="font-medium text-sm">Información de Facturación</h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="document_type">Tipo de Documento</Label>
                                    <Select value={formData.document_type} onValueChange={(value) => handleSelectChange('document_type', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                                            <SelectItem value="NIT">NIT</SelectItem>
                                            <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                                            <SelectItem value="Passport">Pasaporte</SelectItem>
                                            <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="document_number">Número de Documento</Label>
                                    <Input id="document_number" name="document_number" required value={formData.document_number} onChange={handleInputChange} placeholder="123456789" />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Tipo de Persona</Label>
                                <RadioGroup value={formData.person_type} onValueChange={(value: string) => handleSelectChange('person_type', value)} className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Natural" id="natural" />
                                        <Label htmlFor="natural" className="font-normal cursor-pointer">Natural (Persona)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Jurídica" id="juridica" />
                                        <Label htmlFor="juridica" className="font-normal cursor-pointer">Jurídica (Empresa)</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {formData.person_type === "Jurídica" && (
                                <div className="grid gap-2">
                                    <Label htmlFor="business_name">Nombre de la Empresa</Label>
                                    <Input id="business_name" name="business_name" value={formData.business_name} onChange={handleInputChange} placeholder="Mi Empresa S.A.S." />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input id="city" name="city" required value={formData.city} onChange={handleInputChange} placeholder="Bogotá" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Dirección</Label>
                                <Input id="address" name="address" required value={formData.address} onChange={handleInputChange} placeholder="Calle 123 # 45-67" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90">
                                Continuar al Pago
                            </Button>
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
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === 'wompi' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => setPaymentMethod('wompi')}
                                >
                                    <span className="font-bold">Wompi</span>
                                    <span className="text-xs text-center text-slate-500">Tarjetas, PSE, Nequi</span>
                                </div>
                                <div
                                    className={`border rounded-lg p-3 cursor-pointer flex flex-col items-center gap-2 transition-all ${paymentMethod === 'manual' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => setPaymentMethod('manual')}
                                >
                                    <span className="font-bold">Manual</span>
                                    <span className="text-xs text-center text-slate-500">Transferencia / Contraentrega</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setStep('contact')} className="flex-1">
                                Atrás
                            </Button>
                            <Button onClick={handlePlaceOrder} disabled={loading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                                {loading ? "Procesando..." : "Confirmar Orden"}
                            </Button>
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
                        <Button onClick={onClose} className="mt-4 min-w-[200px]">
                            Volver a la tienda
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
