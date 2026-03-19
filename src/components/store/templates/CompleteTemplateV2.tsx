import type { ComponentProps } from "react"
import { CompleteTemplate } from "./complete-template"
import { CompleteTemplateV2Hero } from "./CompleteTemplateV2Hero"
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
            <CompleteTemplate {...props} hideHeroSection />
        </>
    )
}
