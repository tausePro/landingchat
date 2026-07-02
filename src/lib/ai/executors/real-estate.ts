import { searchProperties as repoSearchProperties, findProperty, getOrgUrlInfo, buildPropertyUrl } from "@/lib/repositories/properties"
import { SearchPropertiesSchema, ShowPropertySchema } from "@/lib/ai/tools"
import type { ToolHandler } from "./types"

const searchProperties: ToolHandler = async (supabase, input, context) => {
    const validated = SearchPropertiesSchema.parse(input)
    let { query, property_type, city, neighborhood, min_price, max_price, bedrooms, property_class, limit = 5 } = validated

    const queryLower = (query || "").toLowerCase()
    const classMap: Record<string, string> = {
        "apartamento": "Apartamento", "apto": "Apartamento", "aptos": "Apartamento",
        "casa": "Casa", "casas": "Casa",
        "local": "Local", "locales": "Local",
        "oficina": "Oficina", "oficinas": "Oficina",
        "bodega": "Bodega", "bodegas": "Bodega",
        "lote": "Lote", "lotes": "Lote",
        "finca": "Finca", "fincas": "Finca"
    }

    if (!property_class) {
        for (const [keyword, cls] of Object.entries(classMap)) {
            if (queryLower.includes(keyword)) {
                property_class = cls
                break
            }
        }
    }
    if (!property_type) {
        if (queryLower.includes("arriendo") || queryLower.includes("arrendar") || queryLower.includes("alquiler")) {
            property_type = "arriendo"
        } else if (queryLower.includes("venta") || queryLower.includes("comprar") || queryLower.includes("compra")) {
            property_type = "venta"
        }
    }

    const { data: properties, error } = await repoSearchProperties(supabase, context.organizationId, {
        query,
        propertyType: property_type,
        city,
        neighborhood,
        minPrice: min_price,
        maxPrice: max_price,
        bedrooms,
        propertyClass: property_class,
        limit,
    })

    if (error) {
        return { success: false, error }
    }

    const formatPrice = (price: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)
    const { slug: orgSlug, customDomain } = await getOrgUrlInfo(supabase, context.organizationId)

    return {
        success: true,
        data: {
            properties: properties.map((p: any) => ({
                id: p.id,
                title: p.title,
                external_code: p.external_code || null,
                type: p.property_type,
                class: p.property_class,
                location: `${p.neighborhood || ""}, ${p.city || ""}`.replace(/^, |, $/g, ""),
                address: p.address,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                area: p.area_m2 ? `${p.area_m2} m²` : null,
                stratum: p.stratum,
                priceRent: p.price_rent ? formatPrice(p.price_rent) : null,
                priceSale: p.price_sale ? formatPrice(p.price_sale) : null,
                priceAdmin: p.price_admin ? formatPrice(p.price_admin) : null,
                image_url: p.images?.[0]?.url || null,
                url: buildPropertyUrl(p.id, orgSlug, customDomain)
            })),
            totalFound: properties.length,
            tip: "Usa show_property con el ID para mostrar la ficha completa al cliente. Comparte la URL de la propiedad para que el cliente pueda verla."
        }
    }
}

const showProperty: ToolHandler = async (supabase, input, context) => {
    const { property_id } = ShowPropertySchema.parse(input)

    const { data: property, error } = await findProperty(supabase, context.organizationId, property_id)
    if (!property) {
        return { success: false, error: error || `Propiedad "${property_id}" no encontrada. Usa el ID exacto de los resultados de búsqueda.` }
    }

    const { slug: orgSlug, customDomain } = await getOrgUrlInfo(supabase, context.organizationId)
    const propertyUrl = buildPropertyUrl(property.id, orgSlug, customDomain)

    const formatPrice = (price: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)

    const features = (property.features || [])
        .filter((f) => f.value && f.value !== "0" && f.value !== "No")
        .map((f) => `${f.description}: ${f.valueText || f.value}`)

    return {
        success: true,
        data: {
            ui_component: "property_card",
            property: {
                id: property.id,
                title: property.title,
                description: property.description,
                type: property.property_type,
                class: property.property_class,
                status: property.status,
                location: {
                    city: property.city,
                    neighborhood: property.neighborhood,
                    address: property.address,
                    department: property.department,
                    stratum: property.stratum
                },
                specs: {
                    bedrooms: property.bedrooms,
                    bathrooms: property.bathrooms,
                    area: property.area_m2 ? `${property.area_m2} m²` : null,
                    parking: property.parking_spots,
                    floor: property.floor_number,
                    age: property.age_years ? `${property.age_years} años` : null
                },
                prices: {
                    rent: property.price_rent ? formatPrice(property.price_rent) : null,
                    sale: property.price_sale ? formatPrice(property.price_sale) : null,
                    admin: property.price_admin ? formatPrice(property.price_admin) : null
                },
                images: (property.images || []).slice(0, 10).map((img) => img.url),
                features: features.slice(0, 15),
                is_featured: property.is_featured,
                external_code: property.external_code,
                url: propertyUrl
            }
        }
    }
}

export const realEstateToolHandlers: Record<string, ToolHandler> = {
    search_properties: searchProperties,
    show_property: showProperty,
}
