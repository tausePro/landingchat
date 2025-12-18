'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Eye, 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle, 
  Code, 
  Monitor, 
  Smartphone,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { saveEmailTemplate, deleteEmailTemplate, previewEmailTemplate } from '../actions'
import { getDefaultTemplate } from '@/lib/email-templates/defaults-client'
import { getTemplateVariables } from '@/types/email-template'
import type { EmailTemplate, EmailTemplateType } from '@/types/email-template'

interface EmailTemplateEditorProps {
  templateType: EmailTemplateType
  initialTemplate?: EmailTemplate | null
  organizationId: string
}

export function EmailTemplateEditor({ 
  templateType, 
  initialTemplate, 
  organizationId 
}: EmailTemplateEditorProps) {
  const [subjectTemplate, setSubjectTemplate] = useState('')
  const [htmlTemplate, setHtmlTemplate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [hasChanges, setHasChanges] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Get default template for this type
  const defaultTemplate = getDefaultTemplate(templateType)
  const availableVariables = getTemplateVariables(templateType)

  // Initialize form with existing template or defaults
  useEffect(() => {
    if (initialTemplate) {
      setSubjectTemplate(initialTemplate.subjectTemplate)
      setHtmlTemplate(initialTemplate.htmlTemplate)
    } else {
      setSubjectTemplate(defaultTemplate.subjectTemplate)
      setHtmlTemplate(defaultTemplate.htmlTemplate)
    }
    setHasChanges(false)
  }, [initialTemplate, defaultTemplate])

  // Track changes
  useEffect(() => {
    const currentSubject = initialTemplate?.subjectTemplate || defaultTemplate.subjectTemplate
    const currentHtml = initialTemplate?.htmlTemplate || defaultTemplate.htmlTemplate
    
    setHasChanges(
      subjectTemplate !== currentSubject || 
      htmlTemplate !== currentHtml
    )
  }, [subjectTemplate, htmlTemplate, initialTemplate, defaultTemplate])

  // Auto-preview when content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handlePreview()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [subjectTemplate, htmlTemplate])

  const handlePreview = async () => {
    if (!subjectTemplate.trim() || !htmlTemplate.trim()) {
      setPreviewSubject('')
      setPreviewHtml('')
      return
    }

    try {
      const result = await previewEmailTemplate(templateType, subjectTemplate, htmlTemplate)
      
      if (result.success && result.preview) {
        setPreviewSubject(result.preview.subject)
        setPreviewHtml(result.preview.html)
      } else {
        console.error('Preview error:', result.error)
        setPreviewSubject('Error en el preview')
        setPreviewHtml('<p>Error generando preview</p>')
      }
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewSubject('Error en el preview')
      setPreviewHtml('<p>Error generando preview</p>')
    }
  }

  const handleSave = async () => {
    if (!subjectTemplate.trim()) {
      toast.error('Por favor completa el asunto del email')
      return
    }
    if (!htmlTemplate.trim()) {
      toast.error('Por favor completa el contenido del email')
      return
    }

    setIsLoading(true)
    try {
      const result = await saveEmailTemplate(templateType, {
        templateType,
        subjectTemplate,
        htmlTemplate,
        variables: {}
      })

      if (result.success) {
        toast.success('Template guardado exitosamente')
        setHasChanges(false)
      } else {
        toast.error(result.error || 'Error guardando template')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Error guardando template')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetToDefault = async () => {
    if (initialTemplate) {
      setIsLoading(true)
      try {
        const result = await deleteEmailTemplate(templateType)
        
        if (result.success) {
          setSubjectTemplate(defaultTemplate.subjectTemplate)
          setHtmlTemplate(defaultTemplate.htmlTemplate)
          setHasChanges(false)
          toast.success('Template restaurado a valores por defecto')
        } else {
          toast.error(result.error || 'Error restaurando template')
        }
      } catch (error) {
        console.error('Reset error:', error)
        toast.error('Error restaurando template')
      } finally {
        setIsLoading(false)
      }
    } else {
      setSubjectTemplate(defaultTemplate.subjectTemplate)
      setHtmlTemplate(defaultTemplate.htmlTemplate)
      setHasChanges(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error('Por favor ingresa un email para la prueba')
      return
    }

    if (!subjectTemplate.trim() || !htmlTemplate.trim()) {
      toast.error('Por favor completa el template antes de enviar la prueba')
      return
    }

    setIsSendingTest(true)
    try {
      const result = await sendTestEmail(templateType, subjectTemplate, htmlTemplate, testEmail)
      
      if (result.success) {
        toast.success(`Email de prueba enviado a ${testEmail}`)
      } else {
        toast.error(result.error || 'Error enviando email de prueba')
      }
    } catch (error) {
      console.error('Test email error:', error)
      toast.error('Error enviando email de prueba')
    } finally {
      setIsSendingTest(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('html-template') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = htmlTemplate.substring(0, start) + `{{${variable}}}` + htmlTemplate.substring(end)
      setHtmlTemplate(newValue)
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {initialTemplate ? (
            <Badge variant="default">Personalizado</Badge>
          ) : (
            <Badge variant="secondary">Por Defecto</Badge>
          )}
          {hasChanges && (
            <Badge variant="outline">
              <AlertCircle className="size-3 mr-1" />
              Cambios sin guardar
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            disabled={isLoading}
          >
            <RotateCcw className="size-4 mr-2" />
            Restaurar por Defecto
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
            size="sm"
          >
            <Save className="size-4 mr-2" />
            {isLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Subject Editor */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject-template">Asunto del Email</Label>
                <Input
                  id="subject-template"
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  placeholder="Ej: Confirmación de Pedido {{orderNumber}}"
                  className="mt-1"
                />
              </div>

              {/* HTML Editor */}
              <div>
                <Label htmlFor="html-template">Contenido HTML</Label>
                <Textarea
                  id="html-template"
                  value={htmlTemplate}
                  onChange={(e) => setHtmlTemplate(e.target.value)}
                  placeholder="Contenido HTML del email..."
                  className="mt-1 font-mono text-sm"
                  rows={20}
                />
              </div>
            </div>

            {/* Quick Variables */}
            <div className="space-y-4">
              <div>
                <Label>Variables Rápidas</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Haz clic para insertar en el cursor
                </p>
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {availableVariables.map((variable) => (
                    <Button
                      key={variable.key}
                      variant="outline"
                      size="sm"
                      className="justify-start text-left h-auto p-3"
                      onClick={() => insertVariable(variable.key)}
                    >
                      <div>
                        <div className="font-mono text-xs text-primary">
                          {`{{${variable.key}}}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {variable.description}
                        </div>
                        {variable.required && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Requerido
                          </Badge>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Preview del Email</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={previewMode === 'desktop' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="size-4 mr-2" />
                Desktop
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="size-4 mr-2" />
                Mobile
              </Button>
            </div>
          </div>

          {/* Test Email Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Enviar Email de Prueba</CardTitle>
              <CardDescription>
                Envía este template a tu email para probarlo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="tu-email@ejemplo.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  type="email"
                />
                <Button
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testEmail.trim()}
                  size="sm"
                >
                  {isSendingTest ? 'Enviando...' : 'Enviar Prueba'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Asunto:</CardTitle>
              <CardDescription className="font-medium text-foreground">
                {previewSubject || 'Sin preview disponible'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`border rounded-lg overflow-hidden ${
                  previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
                }`}
              >
                <div 
                  className="bg-white p-4 overflow-auto"
                  style={{ maxHeight: '600px' }}
                  dangerouslySetInnerHTML={{ 
                    __html: previewHtml || '<p class="text-gray-500">Escribe contenido para ver el preview</p>' 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <Alert>
            <Info className="size-4" />
            <AlertDescription>
              Estas son todas las variables disponibles para este tipo de email. 
              Las variables marcadas como "Requerido" deben estar presentes en el template.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            {availableVariables.map((variable) => (
              <Card key={variable.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono">
                      {`{{${variable.key}}}`}
                    </CardTitle>
                    {variable.required && (
                      <Badge variant="destructive" className="text-xs">
                        Requerido
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-2">
                    {variable.description}
                  </p>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Ejemplo: </span>
                    <code className="bg-muted px-1 py-0.5 rounded">
                      {variable.example}
                    </code>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}