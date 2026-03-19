import type { ComponentProps } from "react"
import { RealEstateTemplate } from "./real-estate-template"
import type { StorefrontViewModel } from "@/types/storefront"

type RealEstateTemplateV2Props = ComponentProps<typeof RealEstateTemplate> & {
    storefrontViewModel?: StorefrontViewModel
}

export function RealEstateTemplateV2({ storefrontViewModel, ...props }: RealEstateTemplateV2Props) {
    void storefrontViewModel
    return <RealEstateTemplate {...props} />
}
