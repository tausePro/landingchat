"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface ProductSpecificationItem {
  label: string
  value: string
}

export interface ProductFaqItem {
  question: string
  answer: string
}

interface ProductStructuredContentEditorProps {
  brand: string
  onBrandChange: (value: string) => void
  benefits: string[]
  onBenefitsChange: (value: string[]) => void
  specifications: ProductSpecificationItem[]
  onSpecificationsChange: (value: ProductSpecificationItem[]) => void
  faq: ProductFaqItem[]
  onFaqChange: (value: ProductFaqItem[]) => void
}

export function ProductStructuredContentEditor({
  brand,
  onBrandChange,
  benefits,
  onBenefitsChange,
  specifications,
  onSpecificationsChange,
  faq,
  onFaqChange,
}: ProductStructuredContentEditorProps) {
  const updateBenefit = (index: number, value: string) => {
    onBenefitsChange(benefits.map((benefit, currentIndex) => currentIndex === index ? value : benefit))
  }

  const addBenefit = () => {
    onBenefitsChange([...benefits, ""])
  }

  const removeBenefit = (index: number) => {
    onBenefitsChange(benefits.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateSpecification = (
    index: number,
    field: keyof ProductSpecificationItem,
    value: string,
  ) => {
    onSpecificationsChange(
      specifications.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
    )
  }

  const addSpecification = () => {
    onSpecificationsChange([...specifications, { label: "", value: "" }])
  }

  const removeSpecification = (index: number) => {
    onSpecificationsChange(specifications.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateFaq = (index: number, field: keyof ProductFaqItem, value: string) => {
    onFaqChange(
      faq.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
    )
  }

  const addFaq = () => {
    onFaqChange([...faq, { question: "", answer: "" }])
  }

  const removeFaq = (index: number) => {
    onFaqChange(faq.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
      <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">
        Contenido para SEO, AEO y conversión
      </h2>

      <div className="mt-6 flex flex-col gap-8">
        <div>
          <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-brand">
            Marca
          </label>
          <Input
            id="product-brand"
            value={brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="Ej: Lummia"
            className="mt-2 bg-background-light dark:bg-background-dark"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                Beneficios clave
              </h3>
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                Se muestran en la ficha y ayudan a reforzar intención de compra y snippets útiles.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addBenefit}>
              Agregar beneficio
            </Button>
          </div>

          {benefits.length > 0 ? benefits.map((benefit, index) => (
            <div key={`benefit-${index}`} className="flex items-center gap-3">
              <Input
                value={benefit}
                onChange={(event) => updateBenefit(index, event.target.value)}
                placeholder="Ej: Reduce el tiempo de uso diario"
                className="bg-background-light dark:bg-background-dark"
              />
              <Button type="button" variant="outline" onClick={() => removeBenefit(index)}>
                Quitar
              </Button>
            </div>
          )) : (
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Aún no has agregado beneficios.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                Especificaciones
              </h3>
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                Útiles para comparativas, rich results y lectura por agentes de IA.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addSpecification}>
              Agregar especificación
            </Button>
          </div>

          {specifications.length > 0 ? specifications.map((specification, index) => (
            <div key={`specification-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <Input
                value={specification.label}
                onChange={(event) => updateSpecification(index, "label", event.target.value)}
                placeholder="Ej: Intensidad"
                className="bg-background-light dark:bg-background-dark"
              />
              <Input
                value={specification.value}
                onChange={(event) => updateSpecification(index, "value", event.target.value)}
                placeholder="Ej: 8 niveles"
                className="bg-background-light dark:bg-background-dark"
              />
              <Button type="button" variant="outline" onClick={() => removeSpecification(index)}>
                Quitar
              </Button>
            </div>
          )) : (
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Aún no has agregado especificaciones.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                Preguntas frecuentes
              </h3>
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                Alimentan la sección FAQ del producto y el schema FAQPage.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addFaq}>
              Agregar pregunta
            </Button>
          </div>

          {faq.length > 0 ? faq.map((item, index) => (
            <div key={`faq-${index}`} className="rounded-lg border border-border-light dark:border-border-dark p-4 bg-background-light dark:bg-background-dark space-y-3">
              <Input
                value={item.question}
                onChange={(event) => updateFaq(index, "question", event.target.value)}
                placeholder="Ej: ¿Cuándo se ven los primeros resultados?"
              />
              <Textarea
                value={item.answer}
                onChange={(event) => updateFaq(index, "answer", event.target.value)}
                placeholder="Responde de forma clara, útil y verificable"
                rows={4}
              />
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => removeFaq(index)}>
                  Quitar
                </Button>
              </div>
            </div>
          )) : (
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Aún no has agregado preguntas frecuentes.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
