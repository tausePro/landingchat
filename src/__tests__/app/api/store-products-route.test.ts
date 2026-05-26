import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { createClientMock, listProductsWithVariantsMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  listProductsWithVariantsMock: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}))

vi.mock("@/lib/commerce/listProductsWithVariants", () => ({
  listProductsWithVariants: listProductsWithVariantsMock,
}))

import { GET } from "@/app/api/store/[slug]/products/route"

function createOrganizationsClient(params: {
  organization: { id: string } | null
  error?: { message: string } | null
}) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}

      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return builder
        },
        async single() {
          if (table !== "organizations") {
            throw new Error(`Unexpected single query on ${table}`)
          }

          return {
            data: params.organization,
            error: params.error ?? null,
          }
        },
      }

      return builder
    },
  }
}

describe("GET /api/store/[slug]/products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("preserva el contrato del payload usando el read path centralizado", async () => {
    createClientMock.mockResolvedValue(
      createOrganizationsClient({
        organization: { id: "org-1" },
      }),
    )
    listProductsWithVariantsMock.mockResolvedValue([
      {
        id: "product-1",
        organization_id: "org-1",
        slug: "camiseta-premium",
        name: "Camiseta Premium",
        description: "Algodón pesado",
        image_url: "https://example.com/product.jpg",
        images: ["https://example.com/product.jpg"],
        categories: ["ropa"],
        is_active: true,
        has_quantity_pricing: false,
        price_tiers: null,
        default_variant: {
          id: "variant-1",
          product_id: "product-1",
          organization_id: "org-1",
          title: "Default",
          sku: "SKU-1",
          position: 0,
          is_default: true,
          is_active: true,
          price: 65000,
          compare_at_price: null,
          stock_quantity: 4,
          image_url: "https://example.com/variant.jpg",
          option_values: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        variants: [],
        price_range: {
          has_range: false,
          min_price: 65000,
          max_price: 65000,
          min_compare_at: null,
          max_compare_at: null,
        },
        legacy_price: 80000,
        legacy_sale_price: 70000,
      },
    ])

    const request = new NextRequest("https://example.com/api/store/demo-store/products?search=camiseta&limit=5")
    const response = await GET(request, {
      params: Promise.resolve({ slug: "demo-store" }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listProductsWithVariantsMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      client: expect.any(Object),
      search: "camiseta",
      limit: 5,
      minPrice: null,
      maxPrice: null,
      categories: null,
    })
    expect(payload).toEqual({
      products: [
        {
          id: "product-1",
          name: "Camiseta Premium",
          price: 65000,
          price_range: {
            has_range: false,
            min_price: 65000,
            max_price: 65000,
            min_compare_at: null,
            max_compare_at: null,
          },
          image_url: "https://example.com/variant.jpg",
          slug: "camiseta-premium",
          description: "Algodón pesado",
        },
      ],
      total: 1,
    })
  })

  it("propaga filtros opcionales min_price, max_price y categorias al read path", async () => {
    createClientMock.mockResolvedValue(
      createOrganizationsClient({
        organization: { id: "org-1" },
      }),
    )
    listProductsWithVariantsMock.mockResolvedValue([])

    const request = new NextRequest(
      "https://example.com/api/store/demo-store/products?search=arena&limit=20&min_price=1000&max_price=80000&categorias=mascotas,gatos",
    )
    const response = await GET(request, {
      params: Promise.resolve({ slug: "demo-store" }),
    })

    expect(response.status).toBe(200)
    expect(listProductsWithVariantsMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      client: expect.any(Object),
      search: "arena",
      limit: 20,
      minPrice: 1000,
      maxPrice: 80000,
      categories: ["mascotas", "gatos"],
    })
  })

  it("ignora min_price/max_price no numericos y categorias vacias", async () => {
    createClientMock.mockResolvedValue(
      createOrganizationsClient({
        organization: { id: "org-1" },
      }),
    )
    listProductsWithVariantsMock.mockResolvedValue([])

    const request = new NextRequest(
      "https://example.com/api/store/demo-store/products?min_price=abc&max_price=&categorias=,,",
    )
    await GET(request, {
      params: Promise.resolve({ slug: "demo-store" }),
    })

    expect(listProductsWithVariantsMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      client: expect.any(Object),
      search: null,
      limit: 20,
      minPrice: null,
      maxPrice: null,
      categories: null,
    })
  })

  it("devuelve 404 si la tienda no existe", async () => {
    createClientMock.mockResolvedValue(
      createOrganizationsClient({
        organization: null,
        error: { message: "not found" },
      }),
    )

    const request = new NextRequest("https://example.com/api/store/unknown/products")
    const response = await GET(request, {
      params: Promise.resolve({ slug: "unknown" }),
    })
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({ error: "Store not found" })
    expect(listProductsWithVariantsMock).not.toHaveBeenCalled()
  })
})
