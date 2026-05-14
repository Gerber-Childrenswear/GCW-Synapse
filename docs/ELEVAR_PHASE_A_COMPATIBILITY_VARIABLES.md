# Phase A Compatibility Variable Build List

Build these variables first so existing tags can be repointed without breaking event flow.

## Priority Rules
- P0: 20+ external references
- P1: 10-19 external references
- P2: 5-9 external references
- P3: <5 external references

## Priority Build Table
| Priority | Legacy variable | ID | Folder | External refs | Suggested variable type | Suggested source |
|---|---|---:|---|---:|---|---|
| P0 | GA4 ID | 215 | Elevar 2.0 - GA4 | 39 | Constant / Lookup variable | Env-backed constant for GA4 measurement ID |
| P0 | dlv - Global - Currency Code | 28 | Elevar 2.0 - Global | 30 | Data Layer variable | dataLayer.ecommerce.currency with Shopify currency fallback |
| P0 | dlv - event_id | 83 | Elevar 2.0 - Global | 27 | Constant / Lookup variable | Deterministic event_id generator using topic + order/item seed |
| P1 | dlv - Customer ID | 40 | Elevar 2.0 - Cart and Checkout | 15 | Constant / Lookup variable | Shopify customer ID / external identifier |
| P1 | dlv - Customer Email | 84 | Elevar 2.0 - Global | 13 | Data Layer variable | Shopify customer/contact email normalized for platform use |
| P1 | dlv - Thank You Page - ecommerce.purchase.products | 54 | Elevar 2.0 - Cart and Checkout | 13 | Data Layer variable | Canonical ecommerce.items array for event context |
| P1 | Facebook - Pixel ID | 177 | Elevar 2.0 - FB | 12 | Constant / Lookup variable | Env-backed constant for Meta Pixel ID |
| P1 | Facebook - product identifier | 183 | Elevar 2.0 - Product Identifier | 11 | Custom variable | Canonical item identifier resolver |
| P2 | GA4 - product identifier | 270 | Elevar 2.0 - Product Identifier | 9 | Custom variable | Canonical item identifier resolver |
| P2 | dlv - Thank You Page - Order ID | 69 | Elevar 2.0 - Cart and Checkout | 9 | Constant / Lookup variable | Shopify order_number or transaction_id |
| P2 | Pinterest ID | 86 | Elevar / Pinterest | 9 | Constant / Lookup variable | Env-backed constant for Pinterest ID |
| P2 | dlv - Cart Total | 48 | Elevar 2.0 - Cart and Checkout | 9 | Data Layer variable | Canonical ecommerce.value |
| P2 | Facebook - product group | 192 | Elevar 2.0 - Product Identifier | 8 | Custom variable | Compatibility layer custom logic |
| P2 | DOM - Page Title | 104 | Elevar 2.0 - Global | 8 | DOM variable | document.title fallback |
| P2 | dlv - ecommerce.checkout.products | 91 | Elevar 2.0 - Cart and Checkout | 7 | Data Layer variable | Canonical ecommerce.items array for event context |
| P2 | url - Search - Search Term | 56 | Elevar 2.0 - Collection and Search Page | 7 | URL variable | URL query parameter search key fallback map |
| P2 | dlv - ecommerce.impressions | 46 | Elevar 2.0 - Collection and Search Page | 7 | Data Layer variable | Canonical ecommerce.items array for event context |
| P2 | dlv - Add to Cart - Price | 43 | Elevar 2.0 - Product Page | 6 | Data Layer variable | Compatibility layer custom logic |
| P2 | dlv - Thank You Page - Customer Phone Number | 72 | Elevar 2.0 - Cart and Checkout | 6 | Data Layer variable | Shopify phone normalized to E.164 |
| P2 | dlv - Global - Visitor Type | 41 | Elevar 2.0 - Global | 6 | Data Layer variable | Compatibility layer custom logic |
| P2 | dlv - Add to Cart - Add Array | 37 | Elevar 2.0 - Product Page | 6 | Data Layer variable | Compatibility layer custom logic |
| P2 | dlv - Product View - Details Array | 31 | Elevar 2.0 - Product Page | 6 | Data Layer variable | Compatibility layer custom logic |
| P2 | dlv - Add to Cart - Category | 117 | Elevar 2.0 - Product Page | 5 | Data Layer variable | Compatibility layer custom logic |
| P2 | dlv - Thank You Page - Order Revenue | 22 | Elevar 2.0 - Cart and Checkout | 5 | Data Layer variable | Canonical ecommerce.value |
| P2 | dlv - Thank You Page - Customer ID | 125 | Elevar 2.0 - Cart and Checkout | 5 | Constant / Lookup variable | Shopify customer ID / external identifier |
| P2 | dlv - Thank You Page - Action Field | 152 | Elevar 2.0 - Cart and Checkout | 5 | Data Layer variable | Compatibility layer custom logic |
| P3 | dlv - Product View - Price | 70 | Elevar 2.0 - Product Page | 4 | Data Layer variable | Compatibility layer custom logic |
| P3 | dlv - Thank You Page - Customer Email | 50 | Elevar 2.0 - Cart and Checkout | 4 | Data Layer variable | Shopify customer/contact email normalized for platform use |
| P3 | dlv - Product View - Name | 129 | Elevar 2.0 - Product Page | 4 | Data Layer variable | Compatibility layer custom logic |
| P3 | dlv - Add to Cart - Quantity | 116 | Elevar 2.0 - Product Page | 4 | Data Layer variable | Compatibility layer custom logic |

## Detailed Build Order
### P0 - GA4 ID [215]
- Folder: Elevar 2.0 - GA4
- External references: 39
- Suggested variable type: Constant / Lookup variable
- Suggested source: Env-backed constant for GA4 measurement ID
- Tied entities to preserve during swap:
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
  - ... plus 27 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P0 - dlv - Global - Currency Code [28]
- Folder: Elevar 2.0 - Global
- External references: 30
- Suggested variable type: Data Layer variable
- Suggested source: dataLayer.ecommerce.currency with Shopify currency fallback
- Tied entities to preserve during swap:
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
  - ... plus 18 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P0 - dlv - event_id [83]
- Folder: Elevar 2.0 - Global
- External references: 27
- Suggested variable type: Constant / Lookup variable
- Suggested source: Deterministic event_id generator using topic + order/item seed
- Tied entities to preserve during swap:
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
  - ... plus 15 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P1 - dlv - Customer ID [40]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 15
- Suggested variable type: Constant / Lookup variable
- Suggested source: Shopify customer ID / external identifier
- Tied entities to preserve during swap:
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
  - ... plus 3 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P1 - dlv - Customer Email [84]
- Folder: Elevar 2.0 - Global
- External references: 13
- Suggested variable type: Data Layer variable
- Suggested source: Shopify customer/contact email normalized for platform use
- Tied entities to preserve during swap:
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
  - ... plus 1 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P1 - dlv - Thank You Page - ecommerce.purchase.products [54]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 13
- Suggested variable type: Data Layer variable
- Suggested source: Canonical ecommerce.items array for event context
- Tied entities to preserve during swap:
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
  - ... plus 1 additional inbound references
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P1 - Facebook - Pixel ID [177]
- Folder: Elevar 2.0 - FB
- External references: 12
- Suggested variable type: Constant / Lookup variable
- Suggested source: Env-backed constant for Meta Pixel ID
- Tied entities to preserve during swap:
  - tag: Facebook - Account Sign Up [198]
  - tag: Facebook - Add Payment Info [201]
  - tag: Facebook - Add to Cart [203]
  - tag: Facebook - Email Signup [207]
  - tag: Facebook - Initiate Checkout [204]
  - tag: Facebook - Product View [205]
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Search [199]
  - tag: Facebook - Sitewide Pixel [179]
  - tag: Facebook - SMS Signup [180]
  - tag: Facebook - Subscribe [193]
  - tag: Facebook - View Category [206]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P1 - Facebook - product identifier [183]
- Folder: Elevar 2.0 - Product Identifier
- External references: 11
- Suggested variable type: Custom variable
- Suggested source: Canonical item identifier resolver
- Tied entities to preserve during swap:
  - tag: Facebook - Add to Cart [203]
  - tag: Facebook - Product View [205]
  - variable: js - Facebook - Content_IDs - Checkout Page [200]
  - variable: js - Facebook - Content_IDs - Impressions [197]
  - variable: js - Facebook - Content_IDs - Thank You Page [188]
  - variable: js - Facebook - Contents - Add to Cart [202]
  - variable: js - Facebook - Contents - Cart Contents [211]
  - variable: js - Facebook - Contents - Checkout Page [195]
  - variable: js - Facebook - Contents - Impressions [184]
  - variable: js - Facebook - Contents - Product View [196]
  - variable: js - Facebook - Contents - Thank You Page [187]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - GA4 - product identifier [270]
- Folder: Elevar 2.0 - Product Identifier
- External references: 9
- Suggested variable type: Custom variable
- Suggested source: Canonical item identifier resolver
- Tied entities to preserve during swap:
  - variable: js - GA4 - add to cart [303]
  - variable: js - GA4 - begin checkout [273]
  - variable: js - GA4 - purchase [301]
  - variable: js - GA4 - remove from cart [272]
  - variable: js - GA4 - remove from cart_import_1 [509]
  - variable: js - GA4 - select item [277]
  - variable: js - GA4 - view cart [291]
  - variable: js - GA4 - view item [281]
  - variable: js - GA4 - view item list [289]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Thank You Page - Order ID [69]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 9
- Suggested variable type: Constant / Lookup variable
- Suggested source: Shopify order_number or transaction_id
- Tied entities to preserve during swap:
  - tag: BloomReach - Purchase (Conversion Page) [409]
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Subscribe [193]
  - tag: Google Ads Conversion - Purchase [78]
  - tag: Pinterest - Transaction [107]
  - tag: TikTok - Place An Order [161]
  - tag: TikTok - Purchase (Complete Payment) [154]
  - tag: TikTok - Subscription Purchase [160]
  - variable: JS - TikTok Event ID [563]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - Pinterest ID [86]
- Folder: Elevar / Pinterest
- External references: 9
- Suggested variable type: Constant / Lookup variable
- Suggested source: Env-backed constant for Pinterest ID
- Tied entities to preserve during swap:
  - tag: Pinterest - Account Sign Up [88]
  - tag: Pinterest - Add to Cart [128]
  - tag: Pinterest - Base Tag [131]
  - tag: Pinterest - Lead [111]
  - tag: Pinterest - Pageview [124]
  - tag: Pinterest - Product Detail View [127]
  - tag: Pinterest - Search [103]
  - tag: Pinterest - Transaction [107]
  - tag: Pinterest - View Category [105]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Cart Total [48]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 9
- Suggested variable type: Data Layer variable
- Suggested source: Canonical ecommerce.value
- Tied entities to preserve during swap:
  - tag: Facebook - Add Payment Info [201]
  - tag: Facebook - Initiate Checkout [204]
  - tag: GA4 - Add Payment Info [274]
  - tag: GA4 - Add Shipping Info [297]
  - tag: GA4 - Begin Checkout [290]
  - tag: GA4 - View Cart [292]
  - tag: Google Ads Remarketing - Cart Page [49]
  - tag: TikTok - Add Payment Info [164]
  - tag: TikTok - Initiate Checkout [170]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - Facebook - product group [192]
- Folder: Elevar 2.0 - Product Identifier
- External references: 8
- Suggested variable type: Custom variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Add Payment Info [201]
  - tag: Facebook - Add to Cart [203]
  - tag: Facebook - Initiate Checkout [204]
  - tag: Facebook - Product View [205]
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Search [199]
  - tag: Facebook - Subscribe [193]
  - tag: Facebook - View Category [206]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - DOM - Page Title [104]
- Folder: Elevar 2.0 - Global
- External references: 8
- Suggested variable type: DOM variable
- Suggested source: document.title fallback
- Tied entities to preserve during swap:
  - tag: BloomReach - Category Page [417]
  - tag: BloomReach - Content Page (Blog, Article, Pages) [418]
  - tag: BloomReach - Home Page [424]
  - tag: BloomReach - Product Page (Event) [412]
  - tag: BloomReach - Purchase (Conversion Page) [409]
  - tag: BloomReach - Search Results Page [389]
  - tag: Pinterest - View Category [105]
  - tag: TikTok - Collection View [148]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - ecommerce.checkout.products [91]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 7
- Suggested variable type: Data Layer variable
- Suggested source: Canonical ecommerce.items array for event context
- Tied entities to preserve during swap:
  - variable: js - Checkout Page - SKUs [94]
  - variable: js - Facebook - Content_Category - Checkout Page [478]
  - variable: js - Facebook - Content_IDs - Checkout Page [200]
  - variable: js - Facebook - Content_Name - Checkout Page [479]
  - variable: js - Facebook - Contents - Checkout Page [195]
  - variable: js - GA4 - begin checkout [273]
  - variable: js - TikTok Checkout Contents [163]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - url - Search - Search Term [56]
- Folder: Elevar 2.0 - Collection and Search Page
- External references: 7
- Suggested variable type: URL variable
- Suggested source: URL query parameter search key fallback map
- Tied entities to preserve during swap:
  - tag: BloomReach - Search Event [425]
  - tag: BloomReach - Search Results Page [389]
  - tag: Facebook - Search [199]
  - tag: GA4 - Search [269]
  - tag: Google Ads Remarketing - Search Results [58]
  - tag: Pinterest - Search [103]
  - tag: TikTok - Search [168]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - ecommerce.impressions [46]
- Folder: Elevar 2.0 - Collection and Search Page
- External references: 7
- Suggested variable type: Data Layer variable
- Suggested source: Canonical ecommerce.items array for event context
- Tied entities to preserve during swap:
  - variable: js - Collection - Pinterest line items [102]
  - variable: js - Facebook - Content_IDs - Impressions [197]
  - variable: js - Facebook - Contents - Impressions [184]
  - variable: js - GA4 - view cart [291]
  - variable: js - GA4 - view item list [289]
  - variable: js - Google Ads - Cart Page - Shopify ID [47]
  - variable: js - Google Ads - Collection Page - Shopify ID [57]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Add to Cart - Price [43]
- Folder: Elevar 2.0 - Product Page
- External references: 6
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Add to Cart [203]
  - tag: Google Ads Remarketing - Add to Cart [44]
  - tag: Pinterest - Add to Cart [128]
  - tag: TikTok - Add to Cart [157]
  - variable: js - Add To Cart Value [300]
  - variable: js - TikTok AddToCart Value [156]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Thank You Page - Customer Phone Number [72]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 6
- Suggested variable type: Data Layer variable
- Suggested source: Shopify phone normalized to E.164
- Tied entities to preserve during swap:
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Subscribe [193]
  - tag: TikTok - Place An Order [161]
  - trigger: All Events - Phone Defined [310]
  - variable: Enhanced Conversion Data [77]
  - variable: js - TikTok Phone (E164) [503]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Global - Visitor Type [41]
- Folder: Elevar 2.0 - Global
- External references: 6
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Google Ads Remarketing - Add to Cart [44]
  - tag: Google Ads Remarketing - Purchase [80]
  - tag: Google Ads Remarketing - Search Results [58]
  - tag: Google Ads Remarketing - View Item [71]
  - tag: Google Ads Remarketing - View Item List [68]
  - variable: GA4 Event Settings [285]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Add to Cart - Add Array [37]
- Folder: Elevar 2.0 - Product Page
- External references: 6
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Add to Cart [203]
  - tag: TikTok - Add to Cart [157]
  - variable: js - Add To Cart - Pinterest line items [115]
  - variable: js - Facebook - Contents - Add to Cart [202]
  - variable: js - GA4 - add to cart [303]
  - variable: js - Google Ads - Add to Cart - Shopify ID [38]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Product View - Details Array [31]
- Folder: Elevar 2.0 - Product Page
- External references: 6
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Product View [205]
  - tag: TikTok - Product View [155]
  - variable: js - Facebook - Contents - Product View [196]
  - variable: js - GA4 - view item [281]
  - variable: js - Google Ads - Product View - Shopify ID [33]
  - variable: js - Product View - Pinterest line items [119]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Add to Cart - Category [117]
- Folder: Elevar 2.0 - Product Page
- External references: 5
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: BloomReach - Add To Cart [379]
  - tag: Facebook - Add to Cart [203]
  - tag: TikTok - Add to Cart [157]
  - variable: BloomReach Cart Data [378]
  - variable: BloomReach Cart Data_import_1 [553]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Thank You Page - Order Revenue [22]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 5
- Suggested variable type: Data Layer variable
- Suggested source: Canonical ecommerce.value
- Tied entities to preserve during swap:
  - tag: GA4 - Purchase [302]
  - tag: Google Ads Conversion - Purchase [78]
  - tag: Google Ads Remarketing - Purchase [80]
  - tag: Pinterest - Transaction [107]
  - variable: js - TikTok Purchase Value (cleaned) [520]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Thank You Page - Customer ID [125]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 5
- Suggested variable type: Constant / Lookup variable
- Suggested source: Shopify customer ID / external identifier
- Tied entities to preserve during swap:
  - tag: GA4 - Purchase [302]
  - tag: TikTok - Place An Order [161]
  - tag: TikTok - Purchase (Complete Payment) [154]
  - tag: TikTok - Subscription Purchase [160]
  - variable: GA4 Event Settings [285]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P2 - dlv - Thank You Page - Action Field [152]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 5
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Subscribe [193]
  - tag: TikTok - Place An Order [161]
  - tag: TikTok - Subscription Purchase [160]
  - variable: js - TikTok Purchase Value (cleaned) [520]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P3 - dlv - Product View - Price [70]
- Folder: Elevar 2.0 - Product Page
- External references: 4
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Facebook - Product View [205]
  - tag: GA4 - Item View [299]
  - tag: Google Ads Remarketing - View Item [71]
  - tag: TikTok - Product View [155]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P3 - dlv - Thank You Page - Customer Email [50]
- Folder: Elevar 2.0 - Cart and Checkout
- External references: 4
- Suggested variable type: Data Layer variable
- Suggested source: Shopify customer/contact email normalized for platform use
- Tied entities to preserve during swap:
  - tag: Facebook - Purchase [210]
  - tag: Facebook - Subscribe [193]
  - tag: TikTok - Place An Order [161]
  - variable: js - TikTok Email (cleaned) [505]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P3 - dlv - Product View - Name [129]
- Folder: Elevar 2.0 - Product Page
- External references: 4
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: BloomReach - Product Page (Event) [412]
  - tag: Facebook - Product View [205]
  - tag: TikTok - Product View [155]
  - variable: BloomReach Product Name [398]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

### P3 - dlv - Add to Cart - Quantity [116]
- Folder: Elevar 2.0 - Product Page
- External references: 4
- Suggested variable type: Data Layer variable
- Suggested source: Compatibility layer custom logic
- Tied entities to preserve during swap:
  - tag: Pinterest - Add to Cart [128]
  - tag: TikTok - Add to Cart [157]
  - variable: js - Add To Cart Value [300]
  - variable: js - TikTok AddToCart Value [156]
- Build checklist:
  - [ ] Create new variable with same output shape
  - [ ] Validate output in GTM preview against legacy variable
  - [ ] Repoint one dependent tag/trigger in staging
  - [ ] Compare payload parity
  - [ ] Expand to remaining dependents

## Phase A Exit Criteria
- Top coupling variables recreated and parity checked
- No high-volume channel blocked by missing compatibility variables
- Ready to start channel cutover sheet execution
