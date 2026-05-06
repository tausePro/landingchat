WITH campaign AS (
    SELECT '{
        "id": "tez-mothers-day-2026",
        "enabled": true,
        "startsAt": "2026-05-06T00:00:00-05:00",
        "endsAt": "2026-05-11T23:59:59-05:00",
        "targets": {
            "productSlugs": ["ritual-renovacion-total-tez"]
        },
        "urgencyBanner": {
            "enabled": true,
            "desktopText": "Pide antes del sábado 8 de mayo para garantizar entrega el Día de la Madre",
            "mobileText": "Pide antes del sáb 8 mayo → llega a mamá",
            "countdownEndsAt": "2026-05-08T23:59:59-05:00",
            "backgroundColor": "#1D9E75",
            "textColor": "#FFFFFF"
        },
        "cta": {
            "primaryText": "Regalar esto a mamá — {price}",
            "mobilePrimaryText": "Regalar a mamá",
            "stickyPrimaryText": "Regalar a mamá",
            "secondaryText": "Chatear para regalar",
            "mobileSecondaryText": "Chat regalo",
            "stickySecondaryText": "Chatear"
        },
        "priceContext": {
            "enabled": true,
            "text": "Precio especial Día de la Madre · Kit completo para sorprender a mamá"
        },
        "inventory": {
            "enabled": true,
            "badge": "Entrega garantizada",
            "title": "Pide hoy y llega antes del Día de la Madre ✓",
            "description": "Fecha límite real: compra antes del sábado 8 de mayo para asegurar entrega a tiempo.",
            "trustLabel": "Entrega a tiempo si pides antes del sáb 8"
        },
        "trust": {
            "enabled": true,
            "guaranteeText": "Garantía de satisfacción — Si no le gusta, lo cambiamos.",
            "paymentMethodsText": "Métodos de pago: contra-entrega, Nequi, PSE, Bancolombia y tarjeta.",
            "securePaymentText": "Pago 100% seguro y compra asistida por chat si tienes dudas."
        },
        "landingMode": {
            "enabled": true,
            "applyTo": "paid_traffic",
            "hideMenu": true,
            "hideSearch": true,
            "hideProfile": true,
            "hideAnnouncementBar": true
        }
    }'::jsonb AS payload
), prepared AS (
    SELECT
        id,
        jsonb_set(
            jsonb_set(
                COALESCE(settings, '{}'::jsonb),
                '{storefront}',
                COALESCE(settings->'storefront', '{}'::jsonb),
                true
            ),
            '{storefront,productDetail}',
            COALESCE(settings #> '{storefront,productDetail}', '{}'::jsonb),
            true
        ) AS settings_with_product_detail
    FROM organizations
    WHERE slug = 'tez'
)
UPDATE organizations AS organization
SET settings = jsonb_set(
    prepared.settings_with_product_detail,
    '{storefront,productDetail,croCampaigns}',
    (
        SELECT COALESCE(jsonb_agg(existing_campaign.value), '[]'::jsonb)
        FROM jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(prepared.settings_with_product_detail #> '{storefront,productDetail,croCampaigns}') = 'array'
                    THEN prepared.settings_with_product_detail #> '{storefront,productDetail,croCampaigns}'
                ELSE '[]'::jsonb
            END
        ) AS existing_campaign(value)
        WHERE existing_campaign.value->>'id' <> 'tez-mothers-day-2026'
    ) || jsonb_build_array(campaign.payload),
    true
)
FROM prepared, campaign
WHERE organization.id = prepared.id;
