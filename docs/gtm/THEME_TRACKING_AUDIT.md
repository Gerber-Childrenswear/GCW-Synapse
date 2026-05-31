# Theme Tracking Audit

- Theme path: D:\Users\ncassidy\Downloads\theme_export_gcw_30may2026_unzipped
- Status: warning

## App Embeds

- Total app embeds: 8
- Elevar embeds: 1
- Triple Whale embeds: 1
- Pandectes embeds: 1

### Embed Detail

| Block ID | Type | Disabled |
|---|---|---|
| 5419279292971490355 | shopify://apps/flair/blocks/init/51d5ae10-f90f-4540-9ec6-f09f14107bf4 | false |
| 7570552984445421165 | shopify://apps/yotpo-product-reviews/blocks/settings/eb7dfd7d-db44-4334-bc49-c893b51b36cf | false |
| 14339172867238703359 | shopify://apps/yotpo-product-reviews/blocks/reviews_tab/eb7dfd7d-db44-4334-bc49-c893b51b36cf | true |
| 17676059084223943535 | shopify://apps/triplewhale/blocks/triple_pixel_snippet/483d496b-3f1a-4609-aea7-8eee3b6b7a2a | false |
| 15351435345818755577 | shopify://apps/pandectes-gdpr/blocks/banner/58c0baa2-6cc1-480c-9ea6-38d6d559556a | false |
| 15685250022964305326 | shopify://apps/elevar-conversion-tracking/blocks/dataLayerEmbed/bc30ab68-b15c-4311-811f-8ef485877ad6 | false |
| 8962992520437913685 | shopify://apps/yotpo-loyalty-rewards/blocks/loader-app-embed-block/2f9660df-5018-4e02-9868-ee1fb88d6ccd | false |
| 10846099452475747276 | shopify://apps/bloomreach-discovery-v2/blocks/bloomreach-config/e3c4fb23-6863-4316-8be9-235ee031a37d | true |

## Runtime Markers

- Foxtheme head injection present: true
- Foxtheme body injection present: true
- Commerce Shield pixel guard present: true
- Bloomreach dataLayer hook present: true

## Findings

- Elevar and Triple Whale app embeds are both enabled. This can double-fire client events.
- Foxtheme head/body metafield injection is present. Hidden tracking snippets can be injected outside source control.

## Monday Action Checklist

- Disable Elevar app embed when Synapse/TW pipeline is verified.
- Keep only one owner for client pixel events per channel (TW or GTM/Synapse).
- Audit foxtheme code_head/code_body values in Shopify admin before launch.
- Confirm GTM Preview shows one event path per action (no duplicate purchase/add_to_cart).
- Validate /ops/alerts and /ops/dead-letter are clean before go-live.
