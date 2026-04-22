"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { ProductEngagementSummary, ProductReview } from "@/types/product"
import {
  createProductReview,
  deleteProductReview,
  getProductEngagementSummaryForDashboard,
  getProductReviewsForDashboard,
  updateProductReview,
} from "../review-actions"

type ReviewDraft = {
  author_name: string
  author_role: string
  title: string
  content: string
  rating: number
  verified_purchase: boolean
  is_published: boolean
}

const emptyDraft: ReviewDraft = {
  author_name: "",
  author_role: "",
  title: "",
  content: "",
  rating: 5,
  verified_purchase: false,
  is_published: false,
}

interface ProductReviewsManagerProps {
  productId: string
  initialError?: string
  initialEngagementSummary: ProductEngagementSummary
  initialReviews: ProductReview[]
}

export function ProductReviewsManager({ productId, initialError, initialEngagementSummary, initialReviews }: ProductReviewsManagerProps) {
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews)
  const [engagementSummary, setEngagementSummary] = useState<ProductEngagementSummary>(initialEngagementSummary)
  const [error, setError] = useState(initialError || "")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)

  const stats = useMemo(() => {
    const published = reviews.filter((review) => review.is_published).length
    const verified = reviews.filter((review) => review.verified_purchase).length
    const average = reviews.length > 0
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
      : 0

    return {
      total: reviews.length,
      published,
      verified,
      average,
    }
  }, [reviews])

  const reloadReviews = async () => {
    setLoading(true)
    setError("")
    const [reviewsResult, engagementResult] = await Promise.all([
      getProductReviewsForDashboard(productId),
      getProductEngagementSummaryForDashboard(productId),
    ])

    if (reviewsResult.success) {
      setReviews(reviewsResult.data)
    } else {
      setError(reviewsResult.error)
    }

    if (engagementResult.success) {
      setEngagementSummary(engagementResult.data)
    } else if (!reviewsResult.success) {
      setError(engagementResult.error)
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    setError("")

    const result = await createProductReview(productId, {
      author_name: draft.author_name.trim(),
      author_role: draft.author_role.trim() || null,
      title: draft.title.trim() || null,
      content: draft.content.trim(),
      rating: draft.rating,
      verified_purchase: draft.verified_purchase,
      is_published: draft.is_published,
    })

    if (!result.success) {
      setError(result.error)
      setCreating(false)
      return
    }

    setReviews((current) => [result.data, ...current])
    setDraft(emptyDraft)
    setCreating(false)
  }

  const handleToggle = async (
    reviewId: string,
    field: "is_published" | "verified_purchase",
    value: boolean,
  ) => {
    setError("")
    const result = await updateProductReview(reviewId, { [field]: value })
    if (!result.success) {
      setError(result.error)
      return
    }

    setReviews((current) => current.map((review) => review.id === reviewId ? result.data : review))
  }

  const handleDelete = async (reviewId: string) => {
    setError("")
    const result = await deleteProductReview(reviewId)
    if (!result.success) {
      setError(result.error)
      return
    }

    setReviews((current) => current.filter((review) => review.id !== reviewId))
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Reseñas reales</CardTitle>
            <CardDescription>
              Administra las opiniones que alimentan la ficha pública y el `aggregateRating` del producto.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={reloadReviews} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Total</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Publicadas</p>
            <p className="mt-1 text-2xl font-bold">{stats.published}</p>
          </div>
          <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Verificadas</p>
            <p className="mt-1 text-2xl font-bold">{stats.verified}</p>
          </div>
          <div className="rounded-lg border border-border-light dark:border-border-dark p-4">
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Promedio</p>
            <p className="mt-1 text-2xl font-bold">{stats.average > 0 ? stats.average.toFixed(1) : "-"}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border-light dark:border-border-dark p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Agregar reseña manual</h3>
            <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Úsalo para cargar reseñas auténticas confirmadas por tu equipo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Nombre</label>
              <Input
                value={draft.author_name}
                onChange={(event) => setDraft((current) => ({ ...current, author_name: event.target.value }))}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Rol</label>
              <Input
                value={draft.author_role}
                onChange={(event) => setDraft((current) => ({ ...current, author_role: event.target.value }))}
                placeholder="Ej: Cliente frecuente"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Título</label>
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Resumen corto de la reseña"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Calificación</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={draft.rating}
                onChange={(event) => {
                  const nextRating = Number(event.target.value)
                  setDraft((current) => ({
                    ...current,
                    rating: Number.isFinite(nextRating) ? Math.min(5, Math.max(1, nextRating)) : 5,
                  }))
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Contenido</label>
            <Textarea
              rows={4}
              value={draft.content}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              placeholder="Escribe la opinión real del cliente"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Switch
                checked={draft.verified_purchase}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, verified_purchase: checked }))}
              />
              Compra verificada
            </label>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Switch
                checked={draft.is_published}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_published: checked }))}
              />
              Publicar de inmediato
            </label>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Guardando..." : "Guardar reseña"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-light dark:border-border-dark p-6 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              Aún no hay reseñas reales cargadas para este producto.
            </div>
          ) : reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border-light dark:border-border-dark p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{review.author_name}</h3>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {review.rating}/5
                    </span>
                    {review.title && (
                      <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">{review.title}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
                    {review.author_role || "Sin rol"}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(review.id)}>
                  Eliminar
                </Button>
              </div>

              <p className="text-sm leading-6 text-text-light-primary dark:text-text-dark-primary">
                {review.content}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <label className="flex items-center gap-3 font-medium">
                  <Switch
                    checked={Boolean(review.verified_purchase)}
                    onCheckedChange={(checked) => handleToggle(review.id, "verified_purchase", checked)}
                  />
                  Compra verificada
                </label>
                <label className="flex items-center gap-3 font-medium">
                  <Switch
                    checked={Boolean(review.is_published)}
                    onCheckedChange={(checked) => handleToggle(review.id, "is_published", checked)}
                  />
                  Publicada
                </label>
                <span className="text-text-light-secondary dark:text-text-dark-secondary">
                  {new Date(review.published_at || review.created_at).toLocaleDateString("es-CO")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
