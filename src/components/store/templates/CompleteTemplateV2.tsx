import type { ComponentProps } from "react"
import { CompleteTemplate } from "./complete-template"
import { CompleteTemplateV2Hero } from "./CompleteTemplateV2Hero"
import { CompleteTemplateV2FeaturedBand } from "./CompleteTemplateV2FeaturedBand"
import { CompleteTemplateV2CatalogSection } from "./CompleteTemplateV2CatalogSection"
import { CompleteTemplateV2HowItWorks } from "./CompleteTemplateV2HowItWorks"
import { CompleteTemplateV2SocialProof } from "./CompleteTemplateV2SocialProof"
import { CompleteTemplateV2CtaFinal } from "./CompleteTemplateV2CtaFinal"
import type { StorefrontViewModel } from "@/types/storefront"

type CompleteTemplateV2Props = ComponentProps<typeof CompleteTemplate> & {
    storefrontViewModel?: StorefrontViewModel
}

export function CompleteTemplateV2({ storefrontViewModel, ...props }: CompleteTemplateV2Props) {
    if (!storefrontViewModel) {
        return <CompleteTemplate {...props} />
    }

    return (
        <>
            <CompleteTemplateV2Hero
                organization={props.organization}
                primaryColor={props.primaryColor}
                heroSettings={props.heroSettings}
                onStartChat={props.onStartChat}
                storefrontViewModel={storefrontViewModel}
                isSubdomain={props.isSubdomain ?? false}
            />
            <CompleteTemplateV2FeaturedBand
                organization={props.organization}
                products={props.products}
                primaryColor={props.primaryColor}
                onStartChat={props.onStartChat}
                storefrontViewModel={storefrontViewModel}
                isSubdomain={props.isSubdomain ?? false}
            />
            <CompleteTemplateV2CatalogSection
                organization={props.organization}
                products={props.products}
                badges={props.badges}
                primaryColor={props.primaryColor}
                onStartChat={props.onStartChat}
                storefrontViewModel={storefrontViewModel}
                isSubdomain={props.isSubdomain ?? false}
            />
            <CompleteTemplateV2HowItWorks
                organization={props.organization}
                primaryColor={props.primaryColor}
                storefrontViewModel={storefrontViewModel}
            />
            <CompleteTemplateV2SocialProof
                organization={props.organization}
                primaryColor={props.primaryColor}
                storefrontViewModel={storefrontViewModel}
            />
            <CompleteTemplateV2CtaFinal
                organization={props.organization}
                primaryColor={props.primaryColor}
                onStartChat={props.onStartChat}
                storefrontViewModel={storefrontViewModel}
            />
            <CompleteTemplate {...props} hideHeroSection hideProductSection hideMiddleSections />
        </>
    )
}
