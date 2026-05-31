# Elevar Channel Cutover Sheet

Generated from GTM dependency artifacts to drive channel-by-channel replacement without breaking dependencies.

## Usage
1. Implement replacement variables first (compatibility layer).
2. Repoint tags/triggers channel-by-channel.
3. Check off items only after preview + platform validation.

## Channel: Elevar 2.0 - GA4
- Tags in scope: 16
- Referenced variables: 24
- Referenced triggers: 16

### Tag Checklist
- [ ] Recreate tag: GA4 - Add Payment Info [274] (gaawe)
- [ ] Recreate tag: GA4 - Add Shipping Info [297] (gaawe)
- [ ] Recreate tag: GA4 - Add to Cart [305] (gaawe)
- [ ] Recreate tag: GA4 - Begin Checkout [290] (gaawe)
- [ ] Recreate tag: GA4 - Click Item From Collection Page [278] (gaawe)
- [ ] Recreate tag: GA4 - Collection View [293] (gaawe)
- [ ] Recreate tag: GA4 - Email Subscribe [298] (gaawe)
- [ ] Recreate tag: GA4 - Item View [299] (gaawe)
- [ ] Recreate tag: GA4 - Login [280] (gaawe)
- [ ] Recreate tag: GA4 - Purchase [302] (gaawe)
- [ ] Recreate tag: GA4 - Remove From Cart [295] (gaawe)
- [ ] Recreate tag: GA4 - Search [269] (gaawe)
- [ ] Recreate tag: GA4 - Sign Up For Account [304] (gaawe)
- [ ] Recreate tag: GA4 - SMS Subscribe [288] (gaawe)
- [ ] Recreate tag: GA4 - View Cart [292] (gaawe)
- [ ] Recreate tag: GA4 Base Tag Configuration [286] (googtag)

### Trigger Checklist
- [ ] Recreate trigger: Event - add_payment_info [162]
- [ ] Recreate trigger: Event - add_shipping_info [296]
- [ ] Recreate trigger: Event - add_to_cart [36]
- [ ] Recreate trigger: Event - begin_checkout [169]
- [ ] Recreate trigger: Event - dl_purchase [62]
- [ ] Recreate trigger: Event - login [279]
- [ ] Recreate trigger: Event - remove_from_cart [294]
- [ ] Recreate trigger: Event - select_item [275]
- [ ] Recreate trigger: Event - sign_up [87]
- [ ] Recreate trigger: Event - subscribe - email [90]
- [ ] Recreate trigger: Event - subscribe - phone [113]
- [ ] Recreate trigger: Event - user_data [120]
- [ ] Recreate trigger: Event - view_cart [45]
- [ ] Recreate trigger: Event - view_item [64]
- [ ] Recreate trigger: Event - view_item_list [35]
- [ ] Recreate trigger: Event - view_search_results [55]

### Variable Replacement Matrix
| Legacy variable | ID | Suggested replacement in new setup |
|---|---:|---|
| dlv - Cart Total | 48 | ecommerce.value numeric from checkout/order |
| dlv - Global - Currency Code | 28 | dataLayer.ecommerce.currency or shop currency fallback |
| dlv - Product View - Price | 70 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Coupon Code Name | 92 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer ID | 125 | user_data.customer_id / external_id from Shopify customer |
| dlv - Thank You Page - Order Revenue | 22 | ecommerce.value numeric from checkout/order |
| dlv - Thank You Page - Shipping | 109 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Tax | 114 | Custom mapping in compatibility variable layer |
| dlv - User ID | 213 | Custom mapping in compatibility variable layer |
| GA4 - transaction identifier | 287 | ecommerce.transaction_id from checkout/order payload |
| GA4 Config Settings | 268 | Custom mapping in compatibility variable layer |
| GA4 Event Settings | 285 | Custom mapping in compatibility variable layer |
| GA4 ID | 215 | Constant: GA4 measurement ID from env map |
| js - Add To Cart Value | 300 | ecommerce.value numeric from checkout/order |
| js - GA4 - add to cart | 303 | Custom mapping in compatibility variable layer |
| js - GA4 - begin checkout | 273 | Custom mapping in compatibility variable layer |
| js - GA4 - purchase | 301 | Custom mapping in compatibility variable layer |
| js - GA4 - remove from cart | 272 | Custom mapping in compatibility variable layer |
| js - GA4 - select item | 277 | Custom mapping in compatibility variable layer |
| js - GA4 - view cart | 291 | Custom mapping in compatibility variable layer |
| js - GA4 - view item | 281 | Custom mapping in compatibility variable layer |
| js - GA4 - view item list | 289 | Custom mapping in compatibility variable layer |
| js - Remove From Cart Value | 284 | ecommerce.value numeric from checkout/order |
| url - Search - Search Term | 56 | URL param q/search with fallback |

### Validation Checklist
- [ ] GTM Preview: tag fires only on expected event(s)
- [ ] Payload fields complete (currency, value, item identifiers, user data where required)
- [ ] Event parity validated against legacy (count + value)
- [ ] Consent behavior matches Pandectes/GTM consent mode rules

## Channel: Elevar 2.0 - Google Ads
- Tags in scope: 11
- Referenced variables: 25
- Referenced triggers: 9

### Tag Checklist
- [ ] Recreate tag: Conversion Linker [8] (gclidw)
- [ ] Recreate tag: Google Ads - Enhanced Conversions - Email [313] (awud)
- [ ] Recreate tag: Google Ads - Enhanced Conversions - Phone [312] (awud)
- [ ] Recreate tag: Google Ads Conversion - Purchase [78] (awct)
- [ ] Recreate tag: Google Ads Remarketing - Add to Cart [44] (sp)
- [ ] Recreate tag: Google Ads Remarketing - Cart Page [49] (sp)
- [ ] Recreate tag: Google Ads Remarketing - Pageview [81] (sp)
- [ ] Recreate tag: Google Ads Remarketing - Purchase [80] (sp)
- [ ] Recreate tag: Google Ads Remarketing - Search Results [58] (sp)
- [ ] Recreate tag: Google Ads Remarketing - View Item [71] (sp)
- [ ] Recreate tag: Google Ads Remarketing - View Item List [68] (sp)

### Trigger Checklist
- [ ] Recreate trigger: All Events - Email Defined [311]
- [ ] Recreate trigger: All Events - Phone Defined [310]
- [ ] Recreate trigger: All Pages - Window Loaded [59]
- [ ] Recreate trigger: Event - add_to_cart [36]
- [ ] Recreate trigger: Event - dl_purchase [62]
- [ ] Recreate trigger: Event - view_cart [45]
- [ ] Recreate trigger: Event - view_item [64]
- [ ] Recreate trigger: Event - view_item_list [35]
- [ ] Recreate trigger: Event - view_search_results [55]

### Variable Replacement Matrix
| Legacy variable | ID | Suggested replacement in new setup |
|---|---:|---|
| dlv - Add to Cart - Price | 43 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Variant ID | 42 | Custom mapping in compatibility variable layer |
| dlv - Cart Total | 48 | ecommerce.value numeric from checkout/order |
| dlv - Collection View - Name | 51 | Custom mapping in compatibility variable layer |
| dlv - Customer ID | 40 | user_data.customer_id / external_id from Shopify customer |
| dlv - Global - Currency Code | 28 | dataLayer.ecommerce.currency or shop currency fallback |
| dlv - Global - Visitor Type | 41 | Custom mapping in compatibility variable layer |
| dlv - Product View - Price | 70 | Custom mapping in compatibility variable layer |
| dlv - Product View - Variant ID | 61 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Lifetime Value | 67 | ecommerce.value numeric from checkout/order |
| dlv - Thank You Page - Customer Total Order Count | 53 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Discount Amount | 118 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Order ID | 69 | ecommerce.transaction_id from checkout/order payload |
| dlv - Thank You Page - Order Revenue | 22 | ecommerce.value numeric from checkout/order |
| Enhanced Conversion Data | 77 | Custom mapping in compatibility variable layer |
| Google Ads - Conversion ID - 874796722 | 24 | Custom mapping in compatibility variable layer |
| js - Google Ads - Add to Cart - Shopify ID | 38 | Canonical item_id: sku > variant_id > product_id |
| js - Google Ads - Cart Page - Shopify ID | 47 | Canonical item_id: sku > variant_id > product_id |
| js - Google Ads - Collection Page - Shopify ID | 57 | Canonical item_id: sku > variant_id > product_id |
| js - Google Ads - Product View - Shopify ID | 33 | Canonical item_id: sku > variant_id > product_id |
| js - Google Ads - Purchase - Shopify ID | 79 | Canonical item_id: sku > variant_id > product_id |
| js - Google Ads - Purchase Product Data | 82 | Custom mapping in compatibility variable layer |
| js - New Customer - True or False | 66 | Custom mapping in compatibility variable layer |
| regex - Page Type | 30 | Custom mapping in compatibility variable layer |
| url - Search - Search Term | 56 | URL param q/search with fallback |

### Validation Checklist
- [ ] GTM Preview: tag fires only on expected event(s)
- [ ] Payload fields complete (currency, value, item identifiers, user data where required)
- [ ] Event parity validated against legacy (count + value)
- [ ] Consent behavior matches Pandectes/GTM consent mode rules

## Channel: Elevar 2.0 - FB
- Tags in scope: 13
- Referenced variables: 42
- Referenced triggers: 14

### Tag Checklist
- [ ] Recreate tag: Facebook - Account Sign Up [198] (html)
- [ ] Recreate tag: Facebook - Add Payment Info [201] (html)
- [ ] Recreate tag: Facebook - Add to Cart [203] (html)
- [ ] Recreate tag: Facebook - Email Signup [207] (html)
- [ ] Recreate tag: Facebook - Initiate Checkout [204] (html)
- [ ] Recreate tag: Facebook - Product View [205] (html)
- [ ] Recreate tag: Facebook - Purchase [210] (html)
- [ ] Recreate tag: Facebook - Search [199] (html)
- [ ] Recreate tag: Facebook - Sitewide Pixel [179] (html)
- [ ] Recreate tag: Facebook - SMS Signup [180] (html)
- [ ] Recreate tag: Facebook - Store event_id [182] (html)
- [ ] Recreate tag: Facebook - Subscribe [193] (html)
- [ ] Recreate tag: Facebook - View Category [206] (html)

### Trigger Checklist
- [ ] Recreate trigger: Event - add_payment_info [162]
- [ ] Recreate trigger: Event - add_to_cart [36]
- [ ] Recreate trigger: Event - begin_checkout [169]
- [ ] Recreate trigger: Event - purchase [480]
- [ ] Recreate trigger: Event - sign_up [87]
- [ ] Recreate trigger: Event - subscribe - email [90]
- [ ] Recreate trigger: Event - subscribe - phone [113]
- [ ] Recreate trigger: Event - subscription purchase [159]
- [ ] Recreate trigger: Event - user_data [120]
- [ ] Recreate trigger: Event - user_data - Thank You Page [181]
- [ ] Recreate trigger: Event - view_item [64]
- [ ] Recreate trigger: Event - view_item_list [35]
- [ ] Recreate trigger: Event - view_search_results [55]
- [ ] Recreate trigger: Exception Event - Purchase Thank You Page [178]

### Variable Replacement Matrix
| Legacy variable | ID | Suggested replacement in new setup |
|---|---:|---|
| cookie - GA Client ID | 191 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Add Array | 37 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Category | 117 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Price | 43 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Product Name | 132 | Custom mapping in compatibility variable layer |
| dlv - Cart Total | 48 | ecommerce.value numeric from checkout/order |
| dlv - event_id | 83 | Deterministic event_id generator (topic/order/item seed) |
| dlv - Global - Currency Code | 28 | dataLayer.ecommerce.currency or shop currency fallback |
| dlv - Product View - Category Name | 126 | Custom mapping in compatibility variable layer |
| dlv - Product View - Details Array | 31 | Custom mapping in compatibility variable layer |
| dlv - Product View - Name | 129 | Custom mapping in compatibility variable layer |
| dlv - Product View - Price | 70 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Action Field | 152 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer City | 73 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Country Code | 52 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Email | 50 | user_data.email normalized (hash per destination requirements) |
| dlv - Thank You Page - Customer First Name | 74 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Last Name | 65 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Phone Number | 72 | user_data.phone normalized E.164 (hash per destination requirements) |
| dlv - Thank You Page - Customer Province Code | 189 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Customer Zip | 63 | Custom mapping in compatibility variable layer |
| dlv - Thank You Page - Order ID | 69 | ecommerce.transaction_id from checkout/order payload |
| dlv - user_id | 176 | Custom mapping in compatibility variable layer |
| Facebook - conversion value | 186 | ecommerce.value numeric from checkout/order |
| Facebook - Pixel ID | 177 | Constant: Meta Pixel ID from env map |
| Facebook - product group | 192 | Custom mapping in compatibility variable layer |
| Facebook - product identifier | 183 | Canonical item_id: sku > variant_id > product_id |
| js - Customer Type | 190 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_Category - Checkout Page | 478 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_Category - Thank You Page | 477 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_IDs - Checkout Page | 200 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_IDs - Impressions | 197 | Canonical ecommerce.items[] from event context |
| js - Facebook - Content_IDs - Thank You Page | 188 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_Name - Checkout Page | 479 | Custom mapping in compatibility variable layer |
| js - Facebook - Content_Name - Thank You Page | 476 | Custom mapping in compatibility variable layer |
| js - Facebook - Contents - Add to Cart | 202 | Custom mapping in compatibility variable layer |
| js - Facebook - Contents - Checkout Page | 195 | Custom mapping in compatibility variable layer |
| js - Facebook - Contents - Impressions | 184 | Canonical ecommerce.items[] from event context |
| js - Facebook - Contents - Product View | 196 | Custom mapping in compatibility variable layer |
| js - Facebook - Contents - Thank You Page | 187 | Custom mapping in compatibility variable layer |
| url - Search - Search Term | 56 | URL param q/search with fallback |
| var - Thank You Page - User Data Event ID | 185 | Custom mapping in compatibility variable layer |

### Validation Checklist
- [ ] GTM Preview: tag fires only on expected event(s)
- [ ] Payload fields complete (currency, value, item identifiers, user data where required)
- [ ] Event parity validated against legacy (count + value)
- [ ] Consent behavior matches Pandectes/GTM consent mode rules

## Channel: Elevar / Pinterest
- Tags in scope: 9
- Referenced variables: 15
- Referenced triggers: 9

### Tag Checklist
- [ ] Recreate tag: Pinterest - Account Sign Up [88] (pntr)
- [ ] Recreate tag: Pinterest - Add to Cart [128] (pntr)
- [ ] Recreate tag: Pinterest - Base Tag [131] (pntr)
- [ ] Recreate tag: Pinterest - Lead [111] (pntr)
- [ ] Recreate tag: Pinterest - Pageview [124] (pntr)
- [ ] Recreate tag: Pinterest - Product Detail View [127] (pntr)
- [ ] Recreate tag: Pinterest - Search [103] (pntr)
- [ ] Recreate tag: Pinterest - Transaction [107] (pntr)
- [ ] Recreate tag: Pinterest - View Category [105] (pntr)

### Trigger Checklist
- [ ] Recreate trigger: Event - add_to_cart [36]
- [ ] Recreate trigger: Event - dl_purchase [62]
- [ ] Recreate trigger: Event - sign_up [87]
- [ ] Recreate trigger: Event - subscribe - email [90]
- [ ] Recreate trigger: Event - user_data [120]
- [ ] Recreate trigger: Event - view_item [64]
- [ ] Recreate trigger: Event - view_item_list [35]
- [ ] Recreate trigger: Event - view_search_results [55]
- [ ] Recreate trigger: Exception - Product Pages [123]

### Variable Replacement Matrix
| Legacy variable | ID | Suggested replacement in new setup |
|---|---:|---|
| dlv - Add to Cart - Price | 43 | Custom mapping in compatibility variable layer |
| dlv - Add to Cart - Quantity | 116 | Custom mapping in compatibility variable layer |
| dlv - Customer Email | 84 | user_data.email normalized (hash per destination requirements) |
| dlv - event_id | 83 | Deterministic event_id generator (topic/order/item seed) |
| dlv - Global - Currency Code | 28 | dataLayer.ecommerce.currency or shop currency fallback |
| dlv - Thank You Page - Order ID | 69 | ecommerce.transaction_id from checkout/order payload |
| dlv - Thank You Page - Order Revenue | 22 | ecommerce.value numeric from checkout/order |
| DOM - Page Title | 104 | Custom mapping in compatibility variable layer |
| js - Add To Cart - Pinterest line items | 115 | Canonical ecommerce.items[] from event context |
| js - Collection - Pinterest line items | 102 | Canonical ecommerce.items[] from event context |
| js - Product View - Pinterest line items | 119 | Canonical ecommerce.items[] from event context |
| js - Thank You Page - Pinterest line items | 106 | Canonical ecommerce.items[] from event context |
| js - Thank You Page - Total Product Quantity | 93 | Custom mapping in compatibility variable layer |
| Pinterest ID | 86 | Constant: Pinterest tag ID from env map |
| url - Search - Search Term | 56 | URL param q/search with fallback |

### Validation Checklist
- [ ] GTM Preview: tag fires only on expected event(s)
- [ ] Payload fields complete (currency, value, item identifiers, user data where required)
- [ ] Event parity validated against legacy (count + value)
- [ ] Consent behavior matches Pandectes/GTM consent mode rules

## Channel: Elevar - GA4 Custom Events
- Tags in scope: 22
- Referenced variables: 1
- Referenced triggers: 24

### Tag Checklist
- [ ] Recreate tag: GA4 Event - cart drawer - checkout click [259] (gaawe)
- [ ] Recreate tag: GA4 Event - cart drawer - upsell products click [239] (gaawe)
- [ ] Recreate tag: GA4 Event - collection page - colletion filter click [255] (gaawe)
- [ ] Recreate tag: GA4 Event - collection page - product lists click [221] (gaawe)
- [ ] Recreate tag: GA4 Event - global feature - quickshop atc button click [247] (gaawe)
- [ ] Recreate tag: GA4 Event - global feature - quickshop variant option click [262] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - deal of the week click [248] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - featured category click [261] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - featured collection click [223] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - featured products click [237] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - hero image button click [256] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - instagram feed interaction click [264] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - shop onesies click [233] (gaawe)
- [ ] Recreate tag: GA4 Event - home page - shop outfit section click [265] (gaawe)
- [ ] Recreate tag: GA4 Event - navigation - announcement header click [263] (gaawe)
- [ ] Recreate tag: GA4 Event - navigation - desktop main nav click [250] (gaawe)
- [ ] Recreate tag: GA4 Event - navigation - footer nav click [227] (gaawe)
- [ ] Recreate tag: GA4 Event - navigation - mobile main nav click [253] (gaawe)
- [ ] Recreate tag: GA4 Event - product page - add to cart click [229] (gaawe)
- [ ] Recreate tag: GA4 Event - product page - hot seller products click [251] (gaawe)
- [ ] Recreate tag: GA4 Event - product page - product variants click [260] (gaawe)
- [ ] Recreate tag: GA4 Event - recommended products click [231] (gaawe)

### Trigger Checklist
- [ ] Recreate trigger: Click - GA4 Event - cart drawer - checkout click [242]
- [ ] Recreate trigger: Click - GA4 Event - cart drawer - upsell products click [238]
- [ ] Recreate trigger: Click - GA4 Event - collection page - colletion filter click [254]
- [ ] Recreate trigger: Click - GA4 Event - collection page - product lists click [220]
- [ ] Recreate trigger: Click - GA4 Event - global feature - quickshop atc button click [246]
- [ ] Recreate trigger: Click - GA4 Event - global feature - quickshop variant option click [257]
- [ ] Recreate trigger: Click - GA4 Event - home page - deal of the week click [245]
- [ ] Recreate trigger: Click - GA4 Event - home page - featured category click [224]
- [ ] Recreate trigger: Click - GA4 Event - home page - featured collection click [222]
- [ ] Recreate trigger: Click - GA4 Event - home page - featured products 2 click [236]
- [ ] Recreate trigger: Click - GA4 Event - home page - featured products click [235]
- [ ] Recreate trigger: Click - GA4 Event - home page - hero image button click [249]
- [ ] Recreate trigger: Click - GA4 Event - home page - instagram feed interaction click [234]
- [ ] Recreate trigger: Click - GA4 Event - home page - shop onesies click [232]
- [ ] Recreate trigger: Click - GA4 Event - home page - shop outfit section click [240]
- [ ] Recreate trigger: Click - GA4 Event - navigation - announcement header click [225]
- [ ] Recreate trigger: Click - GA4 Event - navigation - desktop main nav 2 click [241]
- [ ] Recreate trigger: Click - GA4 Event - navigation - desktop main nav click [243]
- [ ] Recreate trigger: Click - GA4 Event - navigation - footer nav click [226]
- [ ] Recreate trigger: Click - GA4 Event - navigation - mobile main nav click [252]
- [ ] Recreate trigger: Click - GA4 Event - product page - add to cart click [228]
- [ ] Recreate trigger: Click - GA4 Event - product page - hot seller products click [244]
- [ ] Recreate trigger: Click - GA4 Event - product page - product variants click [258]
- [ ] Recreate trigger: Click - GA4 Event - recommended products click [230]

### Variable Replacement Matrix
| Legacy variable | ID | Suggested replacement in new setup |
|---|---:|---|
| GA4 ID | 215 | Constant: GA4 measurement ID from env map |

### Validation Checklist
- [ ] GTM Preview: tag fires only on expected event(s)
- [ ] Payload fields complete (currency, value, item identifiers, user data where required)
- [ ] Event parity validated against legacy (count + value)
- [ ] Consent behavior matches Pandectes/GTM consent mode rules

## Global Decommission Gate
- [ ] Elevar ties report shows zero inbound references to Elevar entities
- [ ] Elevar templates/tags disabled in staging first
- [ ] Final production publish approved

Source files:
- docs/elevar-analysis/Elevar_Entities_v2.csv
- docs/elevar-analysis/Elevar_Ties_v2.csv
