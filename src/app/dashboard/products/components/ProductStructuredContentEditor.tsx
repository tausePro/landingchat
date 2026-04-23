"use client"

import { useState } from "react"

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
  const [newBenefit, setNewBenefit] = useState("")
  const [newSpecLabel, setNewSpecLabel] = useState("")
  const [newFaqQuestion, setNewFaqQuestion] = useState("")

  const addBenefit = () => {
    if (!newBenefit.trim()) return
    onBenefitsChange([...benefits, newBenefit.trim()])
    setNewBenefit("")
  }

  const removeBenefit = (index: number) => {
    onBenefitsChange(benefits.filter((_, currentIndex) => currentIndex !== index))
  }

  const addSpecification = () => {
    const valueStr = newSpecLabel.trim()
    if (!valueStr) return
    let label = ""
    let value = ""
    if (valueStr.includes(":")) {
      const parts = valueStr.split(":")
      label = parts[0].trim()
      value = parts.slice(1).join(":").trim()
    } else {
      label = valueStr
      value = ""
    }
    onSpecificationsChange([...specifications, { label, value }])
    setNewSpecLabel("")
  }

  const removeSpecification = (index: number) => {
    onSpecificationsChange(specifications.filter((_, currentIndex) => currentIndex !== index))
  }

  const addFaq = () => {
    if (!newFaqQuestion.trim()) return
    onFaqChange([...faq, { question: newFaqQuestion.trim(), answer: "" }])
    setNewFaqQuestion("")
  }
  
  const updateFaqAnswer = (index: number, answer: string) => {
    onFaqChange(
      faq.map((item, currentIndex) => currentIndex === index ? { ...item, answer } : item)
    )
  }

  const removeFaq = (index: number) => {
    onFaqChange(faq.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
      <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        Contenido para SEO, AEO y conversión
      </h2>

      <div className="mt-8 flex flex-col gap-8">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-text-light-primary dark:text-text-dark-primary" htmlFor="product-brand">
            <span className="material-symbols-outlined text-sm text-text-light-secondary dark:text-text-dark-secondary">sell</span> Marca
          </label>
          <input
            id="product-brand"
            value={brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="Ej. Lummia"
            className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary h-10"
          />
        </div>

        {/* Beneficios */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
              <span className="material-symbols-outlined text-sm text-text-light-secondary dark:text-text-dark-secondary">stars</span> Beneficios clave
            </label>
            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
              Se muestran en la ficha y ayudan a reforzar intención de compra y snippets útiles.
            </p>
          </div>

          <div className="space-y-3">
            {benefits.length > 0 ? benefits.map((benefit, index) => (
              <div key={`benefit-${index}`} className="flex items-center gap-3">
                <input
                  value={benefit}
                  readOnly
                  className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent h-10"
                />
                <button type="button" onClick={() => removeBenefit(index)} className="px-4 py-2 text-sm font-medium border border-border-light dark:border-border-dark rounded-lg hover:bg-background-light dark:hover:bg-background-dark shrink-0">
                  Quitar
                </button>
              </div>
            )) : (
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                Aún no has agregado beneficios.
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                value={newBenefit}
                onChange={e => setNewBenefit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                placeholder="Ej. Reduce el tiempo de uso diario"
                className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary h-10"
              />
              <button type="button" onClick={addBenefit} disabled={!newBenefit.trim()} className="w-full sm:w-auto px-4 h-10 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 shrink-0 flex items-center justify-center gap-1 disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">add</span> Agregar beneficio
              </button>
            </div>
          </div>
        </div>

        {/* Especificaciones */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
              <span className="material-symbols-outlined text-sm text-text-light-secondary dark:text-text-dark-secondary">list</span> Especificaciones
            </label>
            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
              Útiles para comparativas, rich results y lectura por agentes de IA.
            </p>
          </div>

          <div className="space-y-3">
            {specifications.length > 0 ? specifications.map((spec, index) => (
              <div key={`spec-${index}`} className="flex items-center gap-3">
                <input
                  value={spec.value ? `${spec.label}: ${spec.value}` : spec.label}
                  readOnly
                  className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent h-10"
                />
                <button type="button" onClick={() => removeSpecification(index)} className="px-4 py-2 text-sm font-medium border border-border-light dark:border-border-dark rounded-lg hover:bg-background-light dark:hover:bg-background-dark shrink-0">
                  Quitar
                </button>
              </div>
            )) : (
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                Aún no has agregado especificaciones.
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                value={newSpecLabel}
                onChange={e => setNewSpecLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpecification())}
                placeholder="Ej. Material: Algodón 100%"
                className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary h-10"
              />
              <button type="button" onClick={addSpecification} disabled={!newSpecLabel.trim()} className="w-full sm:w-auto px-4 h-10 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 shrink-0 flex items-center justify-center gap-1 disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">add</span> Agregar especificación
              </button>
            </div>
          </div>
        </div>

        {/* Preguntas */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
              <span className="material-symbols-outlined text-sm text-text-light-secondary dark:text-text-dark-secondary">help</span> Preguntas frecuentes
            </label>
            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
              Alimentan la sección FAQ del producto y el schema FAQPage.
            </p>
          </div>

          <div className="space-y-4">
            {faq.length > 0 ? faq.map((item, index) => (
              <div key={`faq-${index}`} className="flex flex-col gap-3 p-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                <input
                  value={item.question}
                  readOnly
                  className="form-input w-full bg-transparent border-none p-0 font-medium text-text-light-primary dark:text-text-dark-primary focus:ring-0"
                />
                <textarea
                  value={item.answer}
                  onChange={e => updateFaqAnswer(index, e.target.value)}
                  placeholder="Responde de forma clara, útil y verificable"
                  rows={2}
                  className="form-input w-full bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-md p-2 text-sm text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={() => removeFaq(index)} className="px-4 py-1.5 text-sm font-medium border border-border-light dark:border-border-dark rounded-lg hover:bg-white dark:hover:bg-gray-800 shrink-0">
                    Quitar
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                Aún no has agregado preguntas frecuentes.
              </p>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input
                value={newFaqQuestion}
                onChange={e => setNewFaqQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFaq())}
                placeholder="Escribe una pregunta frecuente..."
                className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary h-10"
              />
              <button type="button" onClick={addFaq} disabled={!newFaqQuestion.trim()} className="w-full sm:w-auto px-4 h-10 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center justify-center gap-1 shrink-0 disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">add</span> Agregar pregunta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
