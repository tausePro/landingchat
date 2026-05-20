/**
 * Country profiles registry — formularios country-aware.
 *
 * Para cada `SupportedCountry` define los atributos de UI/UX que cambian
 * por país: phone prefix + flag, tipos de documento, person type options,
 * lista de states/regiones, placeholders y código ISO de 2 letras lowercase
 * para Meta Pixel Advanced Matching.
 *
 * Fase 1 — single-country-per-tenant: cada tenant tiene un país fijo definido
 * por el dueño. No hay selector de país por cliente final.
 *
 * Spec: .kiro/specs/i18n-fase-1/ (T1.4)
 */

import type { SupportedCountry } from "@/types/organization"
import { COLOMBIA_DEPARTMENTS } from "@/lib/constants/colombia-departments"
import { US_STATES } from "@/lib/constants/us-states"
import type { StorefrontStringKey } from "./storefront-strings"

/**
 * Opción de tipo de documento. El `value` es lo que se persiste en DB
 * (no traducir); el `label` es lo que ve el usuario en el dropdown.
 */
export interface DocumentTypeOption {
  /** Valor persistido en `customers.document_type` y `orders.customer_info`. */
  value: string
  /** Label del dropdown. Estable por país (no se traduce). */
  label: string
}

/**
 * Opción de tipo de persona (natural vs legal entity).
 *
 * El `value` se persiste en `customers.person_type`. El `labelKey` apunta
 * a una key i18n del diccionario; el componente que renderiza el option
 * resuelve el string con `t(labelKey)`.
 */
export interface PersonTypeOption {
  /** Valor persistido. Estable. */
  value: string
  /** Key del diccionario i18n del label visible. */
  labelKey: StorefrontStringKey
}

/**
 * Profile completo de UI/UX dependiente del país. Cada `SupportedCountry`
 * tiene un profile fijo en este registry.
 */
export interface CountryProfile {
  // ============= Phone =============
  /** Prefix internacional, e.g. `"+57"`. */
  phonePrefix: string
  /** Flag emoji del país, e.g. `"🇨🇴"`. */
  phoneFlag: string
  /** Placeholder localizado del input de teléfono nacional. */
  phonePlaceholderKey: StorefrontStringKey

  // ============= Document =============
  /** Lista de tipos de documento aceptados en checkout/profile. */
  documentTypes: DocumentTypeOption[]
  /** Valor default cuando se inicializa el form. */
  defaultDocumentType: string
  /** Placeholder del input de número de documento. */
  documentNumberPlaceholderKey: StorefrontStringKey

  // ============= Person type =============
  /** Opciones de persona natural vs legal entity. */
  personTypeOptions: PersonTypeOption[]
  /** Valor default. */
  defaultPersonType: string

  // ============= Address =============
  /** Lista completa de states/regions del país. */
  states: readonly string[]
  /** Label del campo state/region (e.g. "Departamento" en CO, "State" en US). */
  stateLabelKey: StorefrontStringKey
  /** Placeholder del select de state/region. */
  statePlaceholderKey: StorefrontStringKey
  /** Placeholder del input de ciudad. */
  cityPlaceholderKey: StorefrontStringKey
  /** Placeholder del input de dirección completa. */
  addressPlaceholderKey: StorefrontStringKey

  // ============= Tracking =============
  /**
   * Código ISO 3166-1 alpha-2 lowercase para Meta Pixel Advanced Matching
   * (`country` field). Meta espera lowercase 2-letter ISO.
   */
  metaPixelCountry: string
}

/**
 * Registry de profiles. Cada país soportado tiene un profile fijo.
 *
 * Para agregar un país nuevo en Fase 2 (e.g. México, Brasil), agregar:
 * 1. El nuevo `SupportedCountry` literal en `@/types/organization`.
 * 2. Una constante con la lista de states (similar a `US_STATES`).
 * 3. Una entrada en este registry.
 * 4. Tests en `src/__tests__/lib/i18n/country-profiles.test.ts`.
 */
export const COUNTRY_PROFILES: Readonly<Record<SupportedCountry, CountryProfile>> = Object.freeze({
  CO: {
    phonePrefix: "+57",
    phoneFlag: "🇨🇴",
    phonePlaceholderKey: "store.checkout.contact_phone_placeholder",
    documentTypes: [
      { value: "CC", label: "C.C." },
      { value: "NIT", label: "NIT" },
      { value: "CE", label: "C.E." },
      { value: "Passport", label: "Pas." },
      { value: "TI", label: "T.I." },
    ],
    defaultDocumentType: "CC",
    documentNumberPlaceholderKey: "store.checkout.billing_document_number_placeholder",
    personTypeOptions: [
      { value: "Natural", labelKey: "store.checkout.billing_person_natural" },
      { value: "Jurídica", labelKey: "store.checkout.billing_person_legal" },
    ],
    defaultPersonType: "Natural",
    states: COLOMBIA_DEPARTMENTS,
    stateLabelKey: "store.checkout.location_state_label_co",
    statePlaceholderKey: "store.checkout.location_state_placeholder",
    cityPlaceholderKey: "store.checkout.location_city_placeholder",
    addressPlaceholderKey: "store.checkout.location_address_placeholder",
    metaPixelCountry: "co",
  },
  US: {
    phonePrefix: "+1",
    phoneFlag: "🇺🇸",
    phonePlaceholderKey: "store.checkout.contact_phone_placeholder_us",
    documentTypes: [
      // Para tenants US el documento es opcional pero conservamos el campo
      // para compat con la DB existente. SSN solo si hace falta facturación
      // formal; EIN para businesses; Passport como fallback.
      { value: "SSN", label: "SSN" },
      { value: "EIN", label: "EIN" },
      { value: "Passport", label: "Passport" },
    ],
    defaultDocumentType: "SSN",
    documentNumberPlaceholderKey: "store.checkout.billing_document_number_placeholder_us",
    personTypeOptions: [
      { value: "Natural", labelKey: "store.checkout.billing_person_individual" },
      { value: "Jurídica", labelKey: "store.checkout.billing_person_business" },
    ],
    defaultPersonType: "Natural",
    states: US_STATES,
    stateLabelKey: "store.checkout.location_state_label_us",
    statePlaceholderKey: "store.checkout.location_state_placeholder_us",
    cityPlaceholderKey: "store.checkout.location_city_placeholder_us",
    addressPlaceholderKey: "store.checkout.location_address_placeholder_us",
    metaPixelCountry: "us",
  },
})

/**
 * Resuelve el profile de un país. Función segura: si recibe un valor inválido
 * (defensa contra `as any` o datos corruptos), retorna el profile de Colombia
 * que es el default histórico.
 *
 * @example
 * ```ts
 * const profile = getCountryProfile("US")
 * console.log(profile.phonePrefix) // "+1"
 * ```
 */
export function getCountryProfile(country: SupportedCountry | undefined | null): CountryProfile {
  if (country && country in COUNTRY_PROFILES) {
    return COUNTRY_PROFILES[country]
  }
  return COUNTRY_PROFILES.CO
}
