'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Save, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Building,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  MessageSquare,
  Palette
} from 'lucide-react'
import { toast } from 'sonner'
import { saveEmailSettings } from '../actions'
import type { OrganizationEmailSettings } from '@/types/email-template'

interface EmailSettingsFormProps {
  initialSettings?: OrganizationEmailSettings | null
  organizationId: string
  organizationName: string
}

export function EmailSettingsForm({ 
  initialSettings, 
  organizationId, 
  organizationName 
}: EmailSettingsFormProps) {
  const [formData, setFormData] = useState({
    businessName: '',
    contactEmail: '',
    contactPhone: '',
    businessAddress: '',
    paymentInstructions: '',
    supportMessage: '',
    logoUrl: '',
    primaryColor: '#000000'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form with existing settings or defaults
  useEffect(() => {
    if (initialSettings) {
      setFormData({
        businessName: initialSettings.businessName || '',
        contactEmail: initialSettings.contactEmail || '',
        contactPhone: initialSettings.contactPhone || '',
        businessAddress: initialSettings.businessAddress || '',
        paymentInstructions: initialSettings.paymentInstructions || '',
        supportMessage: initialSettings.supportMessage || '',
        logoUrl: initialSettings.logoUrl || '',
        primaryColor: initialSettings.primaryColor || '#000000'
      })
    } else {
      // Set defaults
      setFormData(prev => ({
        ...prev,
        businessName: organizationName,
        paymentInstructions: 'Por favor contacta al vendedor para obtener los detalles de pago.',
        supportMessage: '¿Tienes preguntas? Contáctanos directamente desde la tienda.'
      }))
    }
    setHasChanges(false)
  }, [initialSettings, organizationName])

  // Track changes
  useEffect(() => {
    if (!initialSettings) {
      setHasChanges(true)
      return
    }

    const hasChanged = (
      formData.businessName !== (initialSettings.businessName || '') ||
      formData.contactEmail !== (initialSettings.contactEmail || '') ||
      formData.contactPhone !== (initialSettings.contactPhone || '') ||
      formData.businessAddress !== (initialSettings.businessAddress || '') ||
      formData.paymentInstructions !== (initialSettings.paymentInstructions || '') ||
      formData.supportMessage !== (initialSettings.supportMessage || '') ||
      formData.logoUrl !== (initialSettings.logoUrl || '') ||
      formData.primaryColor !== (initialSettings.primaryColor || '#000000')
    )
    
    setHasChanges(hasChanged)
  }, [formData, initialSettings])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const result = await saveEmailSettings(formData)

      if (result.success) {
        toast.success('Configuración guardada exitosamente')
        setHasChanges(false)
      } else {
        toast.error(result.error || 'Error guardando configuración')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Error guardando configuración')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {initialSettings ? (
            <Badge variant="default">
              <CheckCircle className="size-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline">
              <AlertCircle className="size-3 mr-1" />
              Sin Configurar
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline">
              <AlertCircle className="size-3 mr-1" />
              Cambios sin guardar
            </Badge>
          )}
        </div>
        
        <Button
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          size="sm"
        >
          <Save className="size-4 mr-2" />
          {isLoading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Esta información se incluye automáticamente en todos los emails que envíes. 
          Los campos opcionales se mostrarán solo si los completas.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="size-4" />
              Información del Negocio
            </CardTitle>
            <CardDescription>
              Información básica que aparecerá en los emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">Nombre del Negocio</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                placeholder={organizationName}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nombre que aparecerá en los emails
              </p>
            </div>

            <div>
              <Label htmlFor="logoUrl">URL del Logo (opcional)</Label>
              <Input
                id="logoUrl"
                type="url"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Logo que aparecerá en el header de los emails
              </p>
            </div>

            <div>
              <Label htmlFor="primaryColor">Color Principal</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Color para títulos y elementos destacados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              Información de Contacto
            </CardTitle>
            <CardDescription>
              Datos de contacto para tus clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contactEmail">Email de Contacto (opcional)</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                placeholder="contacto@miempresa.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contactPhone">Teléfono de Contacto (opcional)</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                placeholder="+57 300 123 4567"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="businessAddress">Dirección del Negocio (opcional)</Label>
              <Textarea
                id="businessAddress"
                value={formData.businessAddress}
                onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                placeholder="Calle 123 #45-67, Bogotá, Colombia"
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" />
              Instrucciones de Pago
            </CardTitle>
            <CardDescription>
              Instrucciones para pagos manuales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="paymentInstructions">Instrucciones de Pago</Label>
              <Textarea
                id="paymentInstructions"
                value={formData.paymentInstructions}
                onChange={(e) => handleInputChange('paymentInstructions', e.target.value)}
                placeholder="Transferir a la cuenta Bancolombia 123-456789-01 a nombre de Mi Empresa SAS"
                className="mt-1"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se muestra cuando el método de pago es "Transferencia Bancaria"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Message */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              Mensaje de Soporte
            </CardTitle>
            <CardDescription>
              Mensaje de ayuda para tus clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="supportMessage">Mensaje de Soporte</Label>
              <Textarea
                id="supportMessage"
                value={formData.supportMessage}
                onChange={(e) => handleInputChange('supportMessage', e.target.value)}
                placeholder="¿Tienes preguntas? Contáctanos al WhatsApp +57 300 123 4567"
                className="mt-1"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aparece en el footer de todos los emails
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}