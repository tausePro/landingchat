import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/dashboard/",
                    "/admin/",
                    "/api/",
                    "/onboarding/",
                    "/order/",
                ],
            },
        ],
        sitemap: "https://landingchat.co/sitemap.xml",
    }
}
