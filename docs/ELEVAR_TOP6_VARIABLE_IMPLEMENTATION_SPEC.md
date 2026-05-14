# Top 6 Variable Implementation Spec

These are the first variables to recreate in GTM so existing tags can be re-pointed without breaking downstream destinations.

## GA4 ID [215]
- Variable type to build: constant
- Expected output: string
- Source of truth: Environment-backed constant
- Implementation: Create a Constant variable or Lookup Table keyed by environment/shop that returns the active GA4 Measurement ID.
- Validation: Preview GA4 config and ensure all GA4 tags resolve the same measurement ID as today.
- Dependent entities:
  - tag: 39
- First dependent entities to test:
  - tag: GA4 - Add Payment Info [274]
  - tag: GA4 - Add Shipping Info [297]
  - tag: GA4 - Add to Cart [305]
  - tag: GA4 - Begin Checkout [290]
  - tag: GA4 - Click Item From Collection Page [278]
  - tag: GA4 - Collection View [293]
  - tag: GA4 - Email Subscribe [298]
  - tag: GA4 - event - A/B Test KPI [455]
  - tag: GA4 - Item View [299]
  - tag: GA4 - Login [280]
  - tag: GA4 - Purchase [302]
  - tag: GA4 - Remove From Cart [295]
  - ... plus 27 more dependents
- GTM build notes:
  - Prefer Constant variable first; use Lookup only if multi-store/multi-env requires it.
  - Keep legacy variable name during compatibility phase if possible.

## dlv - Global - Currency Code [28]
- Variable type to build: data-layer
- Expected output: ISO currency code
- Source of truth: dataLayer.ecommerce.currency with Shopify fallback
- Implementation: Create a Data Layer Variable for ecommerce.currency. Add fallback via Custom JS or Lookup to Shopify.currency.active / shop currency when ecommerce.currency is missing.
- Validation: Compare value on PDP, cart, checkout, and purchase pages against current Elevar output.
- Dependent entities:
  - tag: 30
- First dependent entities to test:
  - tag: Facebook - Add Payment Info [201]
  - tag: Facebook - Add to Cart [203]
  - tag: Facebook - Initiate Checkout [204]
  - tag: Facebook - Product View [205]
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Search [199]
  - tag: Facebook - Subscribe [193]
  - tag: Facebook - View Category [206]
  - tag: GA4 - Add Payment Info [274]
  - tag: GA4 - Add Shipping Info [297]
  - tag: GA4 - Add to Cart [305]
  - tag: GA4 - Begin Checkout [290]
  - ... plus 18 more dependents
- GTM build notes:
  - Use fallback order: ecommerce.currency -> checkout.currencyCode -> shop default.
  - Enforce uppercase 3-letter ISO output.

## dlv - event_id [83]
- Variable type to build: custom-js
- Expected output: stable event id string
- Source of truth: Deterministic generator
- Implementation: Create a Custom JavaScript variable that returns a stable event identifier derived from event_name + order_id or product/item context + timestamp bucket. Use one canonical generator across Meta, Pinterest, TikTok, and any dedupe-dependent destinations.
- Validation: Same event should produce the same ID across linked tags in one event execution; purchase IDs should remain stable between browser and server pipelines where dedupe is needed.
- Dependent entities:
  - tag: 26
  - variable: 1
- First dependent entities to test:
  - tag: Facebook - Account Sign Up [198]
  - tag: Facebook - Add Payment Info [201]
  - tag: Facebook - Add to Cart [203]
  - tag: Facebook - Email Signup [207]
  - tag: Facebook - Initiate Checkout [204]
  - tag: Facebook - Product View [205]
  - tag: Facebook - Search [199]
  - tag: Facebook - Sitewide Pixel [179]
  - tag: Facebook - SMS Signup [180]
  - tag: Facebook - Store event_id [182]
  - tag: Facebook - View Category [206]
  - tag: Pinterest - Account Sign Up [88]
  - ... plus 15 more dependents
- GTM build notes:
  - Do not use random UUID per tag; generate once per event context.
  - Consider storing the computed value in dataLayer before tag execution.

## dlv - Customer ID [40]
- Variable type to build: data-layer
- Expected output: string or null
- Source of truth: Shopify customer.id
- Implementation: Create a Data Layer Variable or Custom JS fallback that reads ecommerce/customer user ID from the Shopify payload. Normalize to string; return undefined when absent.
- Validation: Logged-in users should match current value on PDP/cart/checkout; guests should remain blank.
- Dependent entities:
  - tag: 15
- First dependent entities to test:
  - tag: Google Ads Remarketing - Add to Cart [44]
  - tag: Google Ads Remarketing - Cart Page [49]
  - tag: Google Ads Remarketing - Pageview [81]
  - tag: Google Ads Remarketing - Purchase [80]
  - tag: Google Ads Remarketing - Search Results [58]
  - tag: Google Ads Remarketing - View Item [71]
  - tag: Google Ads Remarketing - View Item List [68]
  - tag: TikTok - Account Sign Up [174]
  - tag: TikTok - Add Payment Info [164]
  - tag: TikTok - Add to Cart [157]
  - tag: TikTok - Collection View [148]
  - tag: TikTok - Email Signup [171]
  - ... plus 3 more dependents
- GTM build notes:
  - Return string value only; avoid numeric type drift.

## dlv - Customer Email [84]
- Variable type to build: data-layer
- Expected output: email string
- Source of truth: Shopify customer/contact email
- Implementation: Create a Data Layer Variable or Custom JS variable that returns raw email in lowercase trimmed form. Hashing should not occur here unless the existing destination requires hashed input at tag level.
- Validation: Email-enhanced conversion tags should receive same raw value shape as before; verify no whitespace or casing drift.
- Dependent entities:
  - tag: 10
  - trigger: 1
  - variable: 2
- First dependent entities to test:
  - tag: Pinterest - Account Sign Up [88]
  - tag: Pinterest - Add to Cart [128]
  - tag: Pinterest - Base Tag [131]
  - tag: Pinterest - Lead [111]
  - tag: Pinterest - Pageview [124]
  - tag: Pinterest - Product Detail View [127]
  - tag: Pinterest - Search [103]
  - tag: Pinterest - Transaction [107]
  - tag: Pinterest - View Category [105]
  - tag: TikTok - Search [168]
  - trigger: All Events - Email Defined [311]
  - variable: Enhanced Conversion Data [77]
  - ... plus 1 more dependents
- GTM build notes:
  - Lowercase and trim only; keep hashing at destination layer unless current tag expects pre-hashed input.

## dlv - Thank You Page - ecommerce.purchase.products [54]
- Variable type to build: data-layer
- Expected output: items array
- Source of truth: Canonical ecommerce.items array for purchase
- Implementation: Create a Data Layer Variable or Custom JS variable that returns the normalized purchase items array. Preserve identifiers, item names, quantity, price, category, and variant fields required by current dependent tags.
- Validation: Purchase tags should receive same item count and item identifiers as current Elevar output.
- Dependent entities:
  - variable: 13
- First dependent entities to test:
  - variable: js - Facebook - Content_Category - Thank You Page [477]
  - variable: js - Facebook - Content_IDs - Thank You Page [188]
  - variable: js - Facebook - Content_Name - Thank You Page [476]
  - variable: js - Facebook - Contents - Thank You Page [187]
  - variable: js - GA4 - purchase [301]
  - variable: js - Google Ads - Purchase - Shopify ID [79]
  - variable: js - Google Ads - Purchase Product Data [82]
  - variable: js - Has Subscription Purchase [158]
  - variable: js - Thank You Page - BloomReach line items [421]
  - variable: js - Thank You Page - Pinterest line items [106]
  - variable: js - Thank You Page - Product ID Array [122]
  - variable: js - Thank You Page - Total Product Quantity [93]
  - ... plus 1 more dependents
- GTM build notes:
  - Normalize item_id strategy consistently with GA4/Meta/Pinterest/Google Ads needs.
  - Preserve array order if any destination logic depends on it.

## Build Sequence
1. GA4 ID
2. Global currency code
3. event_id generator
4. Customer ID
5. Customer Email
6. Purchase products array

## Exit Criteria
- Each replacement variable matches legacy output shape in GTM Preview
- At least one dependent tag per variable has been successfully re-pointed in staging
- No platform payload regressions detected for the tested tags
