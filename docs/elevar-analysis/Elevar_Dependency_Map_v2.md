# Elevar GTM Dependency Map (v2 strict)

Generated: 2026-05-14 11:07:43
Entities mapped: 268

## Counts by folder/type
- Elevar - GA4 Custom Events | tag | 22
- Elevar - GA4 Custom Events | trigger | 24
- Elevar - Monitoring | tag | 2
- Elevar - Monitoring | trigger | 2
- Elevar - Video Tagging | tag | 1
- Elevar - Video Tagging | trigger | 1
- Elevar / Pinterest | tag | 9
- Elevar / Pinterest | variable | 6
- Elevar 2.0 - Cart and Checkout | trigger | 11
- Elevar 2.0 - Cart and Checkout | variable | 43
- Elevar 2.0 - Collection and Search Page | trigger | 3
- Elevar 2.0 - Collection and Search Page | variable | 4
- Elevar 2.0 - Conversion Value | variable | 4
- Elevar 2.0 - FB | tag | 13
- Elevar 2.0 - FB | variable | 15
- Elevar 2.0 - GA4 | tag | 16
- Elevar 2.0 - GA4 | variable | 13
- Elevar 2.0 - Global | trigger | 10
- Elevar 2.0 - Global | variable | 12
- Elevar 2.0 - Google Ads | tag | 11
- Elevar 2.0 - Google Ads | variable | 7
- Elevar 2.0 - Product Identifier | variable | 8
- Elevar 2.0 - Product Page | trigger | 4
- Elevar 2.0 - Product Page | variable | 27

## [tag] *Update After Import* GA4 Event - Youtube Videos (442)
- Folder: Elevar - Video Tagging (440)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: 
  - Triggers: Youtube Video [441]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Conversion Linker (8)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: gclidw
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Elevar Monitoring Core Tag (98)
- Folder: Elevar - Monitoring (95)
- Type: cvt_PJNCJ
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: 
  - Triggers: All Pages - Window Loaded [59]
  - Templates: Elevar Monitoring Core Tag [96]
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Elevar Monitoring Tag Info (121)
- Folder: Elevar - Monitoring (95)
- Type: cvt_9938197_110
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: 
  - Triggers: All Events [108]
  - Templates: Elevar Monitoring Tag Info [110]
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Account Sign Up (198)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; Facebook - Pixel ID [177]
  - Triggers: Event - sign_up [87]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Add Payment Info (201)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; dlv - event_id [83]; Facebook - Pixel ID [177]; Facebook - product group [192]; js - Facebook - Contents - Checkout Page [195]; js - Facebook - Content_IDs - Checkout Page [200]; js - Facebook - Content_Category - Checkout Page [478]; js - Facebook - Content_Name - Checkout Page [479]
  - Triggers: Event - add_payment_info [162]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Add to Cart (203)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Add to Cart - Add Array [37]; dlv - Add to Cart - Price [43]; dlv - event_id [83]; dlv - Add to Cart - Category [117]; dlv - Add to Cart - Product Name [132]; Facebook - Pixel ID [177]; Facebook - product identifier [183]; Facebook - product group [192]; js - Facebook - Contents - Add to Cart [202]
  - Triggers: Event - add_to_cart [36]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Email Signup (207)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; Facebook - Pixel ID [177]
  - Triggers: Event - subscribe - email [90]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Initiate Checkout (204)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; dlv - event_id [83]; Facebook - Pixel ID [177]; Facebook - product group [192]; js - Facebook - Contents - Checkout Page [195]; js - Facebook - Content_IDs - Checkout Page [200]; js - Facebook - Content_Category - Checkout Page [478]; js - Facebook - Content_Name - Checkout Page [479]
  - Triggers: Event - begin_checkout [169]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Product View (205)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Product View - Details Array [31]; dlv - Product View - Price [70]; dlv - event_id [83]; dlv - Product View - Category Name [126]; dlv - Product View - Name [129]; Facebook - Pixel ID [177]; Facebook - product identifier [183]; Facebook - product group [192]; js - Facebook - Contents - Product View [196]
  - Triggers: Event - view_item [64]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Purchase (210)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Thank You Page - Customer Email [50]; dlv - Thank You Page - Customer Country Code [52]; dlv - Thank You Page - Customer Zip [63]; dlv - Thank You Page - Customer Last Name [65]; dlv - Thank You Page - Order ID [69]; dlv - Thank You Page - Customer Phone Number [72]; dlv - Thank You Page - Customer City [73]; dlv - Thank You Page - Customer First Name [74]; dlv - Thank You Page - Action Field [152]; dlv - user_id [176]; Facebook - Pixel ID [177]; var - Thank You Page - User Data Event ID [185]; Facebook - conversion value [186]; js - Facebook - Contents - Thank You Page [187]; js - Facebook - Content_IDs - Thank You Page [188]; dlv - Thank You Page - Customer Province Code [189]; js - Customer Type [190]; cookie - GA Client ID [191]; Facebook - product group [192]; js - Facebook - Content_Name - Thank You Page [476]; js - Facebook - Content_Category - Thank You Page [477]
  - Triggers: Event - purchase [480]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Search (199)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; url - Search - Search Term [56]; dlv - event_id [83]; Facebook - Pixel ID [177]; js - Facebook - Contents - Impressions [184]; Facebook - product group [192]; js - Facebook - Content_IDs - Impressions [197]
  - Triggers: Event - view_search_results [55]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Sitewide Pixel (179)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; dlv - user_id [176]; Facebook - Pixel ID [177]
  - Triggers: Event - user_data [120]; Exception Event - Purchase Thank You Page [178]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - SMS Signup (180)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; Facebook - Pixel ID [177]
  - Triggers: Event - subscribe - phone [113]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Store event_id (182)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]
  - Triggers: Event - user_data - Thank You Page [181]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - Subscribe (193)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Thank You Page - Customer Email [50]; dlv - Thank You Page - Customer Country Code [52]; dlv - Thank You Page - Customer Zip [63]; dlv - Thank You Page - Customer Last Name [65]; dlv - Thank You Page - Order ID [69]; dlv - Thank You Page - Customer Phone Number [72]; dlv - Thank You Page - Customer City [73]; dlv - Thank You Page - Customer First Name [74]; dlv - Thank You Page - Action Field [152]; dlv - user_id [176]; Facebook - Pixel ID [177]; var - Thank You Page - User Data Event ID [185]; Facebook - conversion value [186]; js - Facebook - Contents - Thank You Page [187]; js - Facebook - Content_IDs - Thank You Page [188]; dlv - Thank You Page - Customer Province Code [189]; js - Customer Type [190]; cookie - GA Client ID [191]; Facebook - product group [192]; js - Facebook - Content_Name - Thank You Page [476]; js - Facebook - Content_Category - Thank You Page [477]
  - Triggers: Event - subscription purchase [159]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Facebook - View Category (206)
- Folder: Elevar 2.0 - FB (175)
- Type: html
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - event_id [83]; Facebook - Pixel ID [177]; js - Facebook - Contents - Impressions [184]; Facebook - product group [192]; js - Facebook - Content_IDs - Impressions [197]
  - Triggers: Event - view_item_list [35]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Add Payment Info (274)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; GA4 ID [215]; js - GA4 - begin checkout [273]
  - Triggers: Event - add_payment_info [162]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Add Shipping Info (297)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; GA4 ID [215]; js - GA4 - begin checkout [273]
  - Triggers: Event - add_shipping_info [296]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Add to Cart (305)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; GA4 ID [215]; js - Add To Cart Value [300]; js - GA4 - add to cart [303]
  - Triggers: Event - add_to_cart [36]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Begin Checkout (290)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; GA4 ID [215]; js - GA4 - begin checkout [273]
  - Triggers: Event - begin_checkout [169]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Click Item From Collection Page (278)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]; js - GA4 - select item [277]
  - Triggers: Event - select_item [275]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Collection View (293)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]; js - GA4 - view item list [289]
  - Triggers: Event - view_item_list [35]; Event - view_search_results [55]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Email Subscribe (298)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Event - subscribe - email [90]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Item View (299)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Product View - Price [70]; GA4 ID [215]; js - GA4 - view item [281]
  - Triggers: Event - view_item [64]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Login (280)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - User ID [213]; GA4 ID [215]
  - Triggers: Event - login [279]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Purchase (302)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Thank You Page - Order Revenue [22]; dlv - Global - Currency Code [28]; dlv - Thank You Page - Coupon Code Name [92]; dlv - Thank You Page - Shipping [109]; dlv - Thank You Page - Tax [114]; dlv - Thank You Page - Customer ID [125]; GA4 ID [215]; GA4 - transaction identifier [287]; js - GA4 - purchase [301]
  - Triggers: Event - dl_purchase [62]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Remove From Cart (295)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; GA4 ID [215]; js - GA4 - remove from cart [272]; js - Remove From Cart Value [284]
  - Triggers: Event - remove_from_cart [294]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Search (269)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: url - Search - Search Term [56]; GA4 ID [215]
  - Triggers: Event - view_search_results [55]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - Sign Up For Account (304)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Event - sign_up [87]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - SMS Subscribe (288)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Event - subscribe - phone [113]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 - View Cart (292)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Cart Total [48]; GA4 ID [215]; js - GA4 - view cart [291]
  - Triggers: Event - view_cart [45]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Base Tag Configuration (286)
- Folder: Elevar 2.0 - GA4 (267)
- Type: googtag
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]; GA4 Config Settings [268]; GA4 Event Settings [285]
  - Triggers: Event - user_data [120]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - cart drawer - checkout click (259)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - cart drawer - checkout click [242]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - cart drawer - upsell products click (239)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - cart drawer - upsell products click [238]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - collection page - colletion filter click (255)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - collection page - colletion filter click [254]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - collection page - product lists click (221)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - collection page - product lists click [220]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - global feature - quickshop atc button click (247)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - global feature - quickshop atc button click [246]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - global feature - quickshop variant option click (262)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - global feature - quickshop variant option click [257]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - deal of the week click (248)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - deal of the week click [245]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - featured category click (261)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - featured category click [224]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - featured collection click (223)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - featured collection click [222]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - featured products click (237)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - featured products click [235]; Click - GA4 Event - home page - featured products 2 click [236]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - hero image button click (256)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - hero image button click [249]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - instagram feed interaction click (264)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - instagram feed interaction click [234]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - shop onesies click (233)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - shop onesies click [232]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - home page - shop outfit section click (265)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - home page - shop outfit section click [240]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - navigation - announcement header click (263)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - navigation - announcement header click [225]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - navigation - desktop main nav click (250)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - navigation - desktop main nav 2 click [241]; Click - GA4 Event - navigation - desktop main nav click [243]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - navigation - footer nav click (227)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - navigation - footer nav click [226]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - navigation - mobile main nav click (253)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - navigation - mobile main nav click [252]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - product page - add to cart click (229)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - product page - add to cart click [228]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - product page - hot seller products click (251)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - product page - hot seller products click [244]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - product page - product variants click (260)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - product page - product variants click [258]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] GA4 Event - recommended products click (231)
- Folder: Elevar - GA4 Custom Events (212)
- Type: gaawe
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: GA4 ID [215]
  - Triggers: Click - GA4 Event - recommended products click [230]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads - Enhanced Conversions - Email (313)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: awud
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; Enhanced Conversion Data [77]
  - Triggers: All Events - Email Defined [311]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads - Enhanced Conversions - Phone (312)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: awud
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; Enhanced Conversion Data [77]
  - Triggers: All Events - Phone Defined [310]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Conversion - Purchase (78)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: awct
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Thank You Page - Order Revenue [22]; Google Ads - Conversion ID - 874796722 [24]; dlv - Global - Currency Code [28]; js - New Customer - True or False [66]; dlv - Thank You Page - Customer Lifetime Value [67]; dlv - Thank You Page - Order ID [69]; Enhanced Conversion Data [77]; js - Google Ads - Purchase Product Data [82]; dlv - Thank You Page - Discount Amount [118]
  - Triggers: Event - dl_purchase [62]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - Add to Cart (44)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; js - Google Ads - Add to Cart - Shopify ID [38]; dlv - Customer ID [40]; dlv - Global - Visitor Type [41]; dlv - Add to Cart - Variant ID [42]; dlv - Add to Cart - Price [43]
  - Triggers: Event - add_to_cart [36]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - Cart Page (49)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; dlv - Customer ID [40]; js - Google Ads - Cart Page - Shopify ID [47]; dlv - Cart Total [48]
  - Triggers: Event - view_cart [45]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - Pageview (81)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; regex - Page Type [30]; dlv - Customer ID [40]
  - Triggers: All Pages - Window Loaded [59]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - Purchase (80)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Thank You Page - Order Revenue [22]; Google Ads - Conversion ID - 874796722 [24]; dlv - Customer ID [40]; dlv - Global - Visitor Type [41]; dlv - Thank You Page - Customer Total Order Count [53]; dlv - Thank You Page - Customer Lifetime Value [67]; js - Google Ads - Purchase - Shopify ID [79]
  - Triggers: Event - dl_purchase [62]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - Search Results (58)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; dlv - Customer ID [40]; dlv - Global - Visitor Type [41]; url - Search - Search Term [56]; js - Google Ads - Collection Page - Shopify ID [57]
  - Triggers: Event - view_search_results [55]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - View Item (71)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; js - Google Ads - Product View - Shopify ID [33]; dlv - Customer ID [40]; dlv - Global - Visitor Type [41]; dlv - Product View - Variant ID [61]; dlv - Product View - Price [70]
  - Triggers: Event - view_item [64]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Google Ads Remarketing - View Item List (68)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: sp
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: Google Ads - Conversion ID - 874796722 [24]; dlv - Customer ID [40]; dlv - Global - Visitor Type [41]; dlv - Collection View - Name [51]; js - Google Ads - Collection Page - Shopify ID [57]
  - Triggers: Event - view_item_list [35]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Account Sign Up (88)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]
  - Triggers: Event - sign_up [87]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Add to Cart (128)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - Add to Cart - Price [43]; dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]; js - Add To Cart - Pinterest line items [115]; dlv - Add to Cart - Quantity [116]
  - Triggers: Event - add_to_cart [36]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Base Tag (131)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Customer Email [84]; Pinterest ID [86]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Lead (111)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]
  - Triggers: Event - subscribe - email [90]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Pageview (124)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]
  - Triggers: Event - user_data [120]; Exception - Product Pages [123]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Product Detail View (127)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Global - Currency Code [28]; dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]; js - Product View - Pinterest line items [119]
  - Triggers: Event - view_item [64]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Search (103)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: url - Search - Search Term [56]; dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]; js - Collection - Pinterest line items [102]
  - Triggers: Event - view_search_results [55]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - Transaction (107)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - Thank You Page - Order Revenue [22]; dlv - Global - Currency Code [28]; dlv - Thank You Page - Order ID [69]; dlv - Customer Email [84]; Pinterest ID [86]; js - Thank You Page - Total Product Quantity [93]; js - Thank You Page - Pinterest line items [106]
  - Triggers: Event - dl_purchase [62]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [tag] Pinterest - View Category (105)
- Folder: Elevar / Pinterest (85)
- Type: pntr
- Purpose: Dispatches marketing event or config tag.
- References:
  - Variables: dlv - event_id [83]; dlv - Customer Email [84]; Pinterest ID [86]; js - Collection - Pinterest line items [102]; DOM - Page Title [104]
  - Triggers: Event - view_item_list [35]
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [trigger] All Events (108)
- Folder: Elevar - Monitoring (95)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches .*
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Elevar Monitoring Tag Info [121]
  - Triggers: 
  - Variables: 

## [trigger] All Events - Email Defined (311)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches .*
- References:
  - Variables: dlv - Customer Email [84]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads - Enhanced Conversions - Email [313]
  - Triggers: 
  - Variables: 

## [trigger] All Events - Phone Defined (310)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches .*
- References:
  - Variables: dlv - Thank You Page - Customer Phone Number [72]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads - Enhanced Conversions - Phone [312]
  - Triggers: 
  - Variables: 

## [trigger] All Pages - Window Loaded (59)
- Folder: Elevar 2.0 - Global (27)
- Type: WINDOW_LOADED
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Pageview [81]; Elevar Monitoring Core Tag [98]
  - Triggers: 
  - Variables: 

## [trigger] BR - dl_add_to_cart - filtered (568)
- Folder: Elevar 2.0 - Product Page (25)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_add_to_cart
- References:
  - Variables: dlv - Add to Cart - Product ID [39]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Add To Cart [379]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - cart drawer - checkout click (242)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - cart drawer - checkout click [259]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - cart drawer - upsell products click (238)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: js - Add To Cart Value [300]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - cart drawer - upsell products click [239]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - collection page - colletion filter click (254)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - collection page - colletion filter click [255]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - collection page - product lists click (220)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - collection page - product lists click [221]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - global feature - quickshop atc button click (246)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - global feature - quickshop atc button click [247]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - global feature - quickshop variant option click (257)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - global feature - quickshop variant option click [262]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - deal of the week click (245)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - deal of the week click [248]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - featured category click (224)
- Folder: Elevar - GA4 Custom Events (212)
- Type: LINK_CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - featured category click [261]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - featured collection click (222)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - featured collection click [223]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - featured products 2 click (236)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - featured products click [237]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - featured products click (235)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - featured products click [237]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - hero image button click (249)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - hero image button click [256]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - instagram feed interaction click (234)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - instagram feed interaction click [264]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - shop onesies click (232)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - shop onesies click [233]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - home page - shop outfit section click (240)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - home page - shop outfit section click [265]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - navigation - announcement header click (225)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - navigation - announcement header click [263]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - navigation - desktop main nav 2 click (241)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - navigation - desktop main nav click [250]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - navigation - desktop main nav click (243)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - navigation - desktop main nav click [250]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - navigation - footer nav click (226)
- Folder: Elevar - GA4 Custom Events (212)
- Type: LINK_CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - navigation - footer nav click [227]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - navigation - mobile main nav click (252)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - navigation - mobile main nav click [253]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - product page - add to cart click (228)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - product page - add to cart click [229]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - product page - hot seller products click (244)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - product page - hot seller products click [251]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - product page - product variants click (258)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - product page - product variants click [260]
  - Triggers: 
  - Variables: 

## [trigger] Click - GA4 Event - recommended products click (230)
- Folder: Elevar - GA4 Custom Events (212)
- Type: CLICK
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - recommended products click [231]
  - Triggers: 
  - Variables: 

## [trigger] Event - add_payment_info (162)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_add_payment_info
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Add Payment Info [164]; Facebook - Add Payment Info [201]; GA4 - Add Payment Info [274]
  - Triggers: 
  - Variables: 

## [trigger] Event - add_shipping_info (296)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_add_shipping_info
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Add Shipping Info [297]
  - Triggers: 
  - Variables: 

## [trigger] Event - add_to_cart (36)
- Folder: Elevar 2.0 - Product Page (25)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_add_to_cart
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]; Pinterest - Add to Cart [128]; TikTok - Add to Cart [157]; Facebook - Add to Cart [203]; GA4 - Add to Cart [305]; StackAdapt - Add to Cart [610]
  - Triggers: 
  - Variables: 

## [trigger] Event - begin_checkout (169)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_begin_checkout
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Initiate Checkout [170]; Facebook - Initiate Checkout [204]; GA4 - Begin Checkout [290]
  - Triggers: 
  - Variables: 

## [trigger] Event - dl_purchase (62)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_purchase
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Google Ads Remarketing - Purchase [80]; Pinterest - Transaction [107]; TikTok - Purchase (Complete Payment) [154]; TikTok - Place An Order [161]; GA4 - Purchase [302]; BloomReach - Purchase (Conversion Page) [409]; StackAdapt - Purchase [609]
  - Triggers: 
  - Variables: 

## [trigger] Event - login (279)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_login
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Login [280]
  - Triggers: 
  - Variables: 

## [trigger] Event - purchase (480)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_purchase
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [trigger] Event - quick-add (426)
- Folder: Elevar 2.0 - Product Page (25)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches quick-add
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [trigger] Event - remove_from_cart (294)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_remove_from_cart
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Remove From Cart [295]
  - Triggers: 
  - Variables: 

## [trigger] Event - select_item (275)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_select_item
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Click Item From Collection Page [278]
  - Triggers: 
  - Variables: 

## [trigger] Event - shopify_dl_purchase (422)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches shopify_dl_purchase
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [trigger] Event - sign_up (87)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_sign_up
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Account Sign Up [88]; TikTok - Account Sign Up [174]; Facebook - Account Sign Up [198]; GA4 - Sign Up For Account [304]
  - Triggers: 
  - Variables: 

## [trigger] Event - subscribe - email (90)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_subscribe
- References:
  - Variables: dlv - Subscribe - Lead Type [89]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Lead [111]; TikTok - Email Signup [171]; Facebook - Email Signup [207]; GA4 - Email Subscribe [298]
  - Triggers: 
  - Variables: 

## [trigger] Event - subscribe - phone (113)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_subscribe
- References:
  - Variables: dlv - Subscribe - Lead Type [89]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - SMS Signup [180]; GA4 - SMS Subscribe [288]
  - Triggers: 
  - Variables: 

## [trigger] Event - subscription purchase (159)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_purchase
- References:
  - Variables: js - Has Subscription Purchase [158]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Subscription Purchase [160]; Facebook - Subscribe [193]
  - Triggers: 
  - Variables: 

## [trigger] Event - user data - exclude collection and product pages (173)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_user_data
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [trigger] Event - user_data (120)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_user_data
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Pageview [124]; Facebook - Sitewide Pixel [179]; GA4 Base Tag Configuration [286]; StackAdapt - Page View (SPA) [606]
  - Triggers: 
  - Variables: 

## [trigger] Event - user_data - Thank You Page (181)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_user_data
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Store event_id [182]
  - Triggers: 
  - Variables: 

## [trigger] Event - view_cart (45)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_view_cart
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Cart Page [49]; GA4 - View Cart [292]
  - Triggers: 
  - Variables: 

## [trigger] Event - view_item (64)
- Folder: Elevar 2.0 - Product Page (25)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_view_item
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item [71]; Pinterest - Product Detail View [127]; TikTok - Product View [155]; Facebook - Product View [205]; GA4 - Item View [299]; BloomReach - Product Page (Event) [412]; StackAdapt - View Item [611]
  - Triggers: 
  - Variables: 

## [trigger] Event - view_item_list (35)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_view_item_list
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item List [68]; Pinterest - View Category [105]; TikTok - Collection View [148]; Facebook - View Category [206]; GA4 - Collection View [293]
  - Triggers: 
  - Variables: 

## [trigger] Event - view_search_results (55)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches dl_view_search_results
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Search Results [58]; Pinterest - Search [103]; TikTok - Search [168]; Facebook - Search [199]; GA4 - Search [269]; GA4 - Collection View [293]
  - Triggers: 
  - Variables: 

## [trigger] Exception - Product Pages (123)
- Folder: Elevar 2.0 - Global (27)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches .*
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Pageview [124]
  - Triggers: 
  - Variables: 

## [trigger] Exception Event - Purchase Thank You Page (178)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: CUSTOM_EVENT
- Purpose: Fires when dataLayer/custom event matches .*
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Sitewide Pixel [179]
  - Triggers: 
  - Variables: 

## [trigger] Timer - 10 Seconds (97)
- Folder: Elevar - Monitoring (95)
- Type: TIMER
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [trigger] Youtube Video (441)
- Folder: Elevar - Video Tagging (440)
- Type: YOU_TUBE_VIDEO
- Purpose: Fires when dataLayer/custom event matches (rule condition)
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: *Update After Import* GA4 Event - Youtube Videos [442]
  - Triggers: 
  - Variables: 

## [variable] constant - conversion value - product_subtotal (166)
- Folder: Elevar 2.0 - Conversion Value (149)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] constant - conversion value - revenue (150)
- Folder: Elevar 2.0 - Conversion Value (149)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: TikTok - conversion value [151]; Facebook - conversion value [186]

## [variable] constant - conversion value - subtotal (165)
- Folder: Elevar 2.0 - Conversion Value (149)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] constant - product group - product (172)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] constant - product group - product_group (143)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: TikTok - product group [144]; Facebook - product group [192]

## [variable] constant - product identifier - product id (141)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: TikTok - product identifier [142]; Facebook - product identifier [183]

## [variable] constant - product identifier - sku (167)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: GA4 - product identifier [270]

## [variable] constant - product identifier - variant id (138)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] cookie - GA Client ID (191)
- Folder: Elevar 2.0 - Global (27)
- Type: k
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Add Array (37)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Add to Cart [157]; Facebook - Add to Cart [203]
  - Triggers: 
  - Variables: js - Google Ads - Add to Cart - Shopify ID [38]; js - Add To Cart - Pinterest line items [115]; js - Facebook - Contents - Add to Cart [202]; js - GA4 - add to cart [303]

## [variable] dlv - Add to Cart - Category (117)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Add to Cart [157]; Facebook - Add to Cart [203]; BloomReach - Add To Cart [379]
  - Triggers: 
  - Variables: BloomReach Cart Data [378]; BloomReach Cart Data_import_1 [553]

## [variable] dlv - Add to Cart - Image (130)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Inventory (101)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Inventory_import_1 (557)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Price (43)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]; Pinterest - Add to Cart [128]; TikTok - Add to Cart [157]; Facebook - Add to Cart [203]
  - Triggers: 
  - Variables: js - TikTok AddToCart Value [156]; js - Add To Cart Value [300]

## [variable] dlv - Add to Cart - Product ID (39)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Add To Cart [379]
  - Triggers: BR - dl_add_to_cart - filtered [568]
  - Variables: BloomReach Cart Data [378]

## [variable] dlv - Add to Cart - Product ID_import_1 (535)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: BloomReach Cart Data_import_1 [553]

## [variable] dlv - Add to Cart - Product Name (132)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Add to Cart [157]; Facebook - Add to Cart [203]
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Quantity (116)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Add to Cart [128]; TikTok - Add to Cart [157]
  - Triggers: 
  - Variables: js - TikTok AddToCart Value [156]; js - Add To Cart Value [300]

## [variable] dlv - Add to Cart - SKU (60)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Add To Cart [379]
  - Triggers: 
  - Variables: BloomReach Cart Data [378]

## [variable] dlv - Add to Cart - SKU_import_1 (552)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: BloomReach Cart Data_import_1 [553]

## [variable] dlv - Add to Cart - Variant ID (42)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]
  - Triggers: 
  - Variables: 

## [variable] dlv - Add to Cart - Variant ID_import_1 (544)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Cart - Product Impressions (145)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: custom js - TikTok Collection Page Impressions [146]

## [variable] dlv - Cart Total (48)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Cart Page [49]; TikTok - Add Payment Info [164]; TikTok - Initiate Checkout [170]; Facebook - Add Payment Info [201]; Facebook - Initiate Checkout [204]; GA4 - Add Payment Info [274]; GA4 - Begin Checkout [290]; GA4 - View Cart [292]; GA4 - Add Shipping Info [297]
  - Triggers: 
  - Variables: 

## [variable] dlv - Collection View - Name (51)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item List [68]
  - Triggers: 
  - Variables: 

## [variable] dlv - Customer Email (84)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Account Sign Up [88]; Pinterest - Search [103]; Pinterest - View Category [105]; Pinterest - Transaction [107]; Pinterest - Lead [111]; Pinterest - Pageview [124]; Pinterest - Product Detail View [127]; Pinterest - Add to Cart [128]; Pinterest - Base Tag [131]; TikTok - Search [168]
  - Triggers: All Events - Email Defined [311]
  - Variables: Enhanced Conversion Data [77]; js - TikTok Email (cleaned) [505]

## [variable] dlv - Customer ID (40)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]; Google Ads Remarketing - Cart Page [49]; Google Ads Remarketing - Search Results [58]; Google Ads Remarketing - View Item List [68]; Google Ads Remarketing - View Item [71]; Google Ads Remarketing - Purchase [80]; Google Ads Remarketing - Pageview [81]; TikTok - Collection View [148]; TikTok - Product View [155]; TikTok - Add to Cart [157]; TikTok - Add Payment Info [164]; TikTok - Search [168]; TikTok - Initiate Checkout [170]; TikTok - Email Signup [171]; TikTok - Account Sign Up [174]
  - Triggers: 
  - Variables: 

## [variable] dlv - ecommerce.cart_contents.products (208)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Facebook - Contents - Cart Contents [211]

## [variable] dlv - ecommerce.checkout.products (91)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Checkout Page - SKUs [94]; js - TikTok Checkout Contents [163]; js - Facebook - Contents - Checkout Page [195]; js - Facebook - Content_IDs - Checkout Page [200]; js - GA4 - begin checkout [273]; js - Facebook - Content_Category - Checkout Page [478]; js - Facebook - Content_Name - Checkout Page [479]

## [variable] dlv - ecommerce.impressions (46)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Google Ads - Cart Page - Shopify ID [47]; js - Google Ads - Collection Page - Shopify ID [57]; js - Collection - Pinterest line items [102]; js - Facebook - Contents - Impressions [184]; js - Facebook - Content_IDs - Impressions [197]; js - GA4 - view item list [289]; js - GA4 - view cart [291]

## [variable] dlv - event_id (83)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Account Sign Up [88]; Pinterest - Search [103]; Pinterest - View Category [105]; Pinterest - Lead [111]; Pinterest - Pageview [124]; Pinterest - Product Detail View [127]; Pinterest - Add to Cart [128]; TikTok - Collection View [148]; TikTok - Product View [155]; TikTok - Add to Cart [157]; TikTok - Add Payment Info [164]; TikTok - Search [168]; TikTok - Initiate Checkout [170]; TikTok - Email Signup [171]; TikTok - Account Sign Up [174]; Facebook - Sitewide Pixel [179]; Facebook - SMS Signup [180]; Facebook - Store event_id [182]; Facebook - Account Sign Up [198]; Facebook - Search [199]; Facebook - Add Payment Info [201]; Facebook - Add to Cart [203]; Facebook - Initiate Checkout [204]; Facebook - Product View [205]; Facebook - View Category [206]; Facebook - Email Signup [207]
  - Triggers: 
  - Variables: JS - TikTok Event ID [563]

## [variable] dlv - Global - Currency Code (28)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Pinterest - Transaction [107]; Pinterest - Product Detail View [127]; Pinterest - Add to Cart [128]; TikTok - Collection View [148]; TikTok - Purchase (Complete Payment) [154]; TikTok - Product View [155]; TikTok - Add to Cart [157]; TikTok - Subscription Purchase [160]; TikTok - Place An Order [161]; TikTok - Add Payment Info [164]; TikTok - Initiate Checkout [170]; TikTok - Email Signup [171]; TikTok - Account Sign Up [174]; Facebook - Subscribe [193]; Facebook - Search [199]; Facebook - Add Payment Info [201]; Facebook - Add to Cart [203]; Facebook - Initiate Checkout [204]; Facebook - Product View [205]; Facebook - View Category [206]; Facebook - Purchase [210]; GA4 - Add Payment Info [274]; GA4 - Begin Checkout [290]; GA4 - View Cart [292]; GA4 - Remove From Cart [295]; GA4 - Add Shipping Info [297]; GA4 - Item View [299]; GA4 - Purchase [302]; GA4 - Add to Cart [305]
  - Triggers: 
  - Variables: 

## [variable] dlv - Global - Visitor Type (41)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]; Google Ads Remarketing - Search Results [58]; Google Ads Remarketing - View Item List [68]; Google Ads Remarketing - View Item [71]; Google Ads Remarketing - Purchase [80]
  - Triggers: 
  - Variables: GA4 Event Settings [285]

## [variable] dlv - Product View - Category Name (126)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Product View [155]; Facebook - Product View [205]
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Details Array (31)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Product View [155]; Facebook - Product View [205]
  - Triggers: 
  - Variables: js - Google Ads - Product View - Shopify ID [33]; js - Product View - Pinterest line items [119]; js - Facebook - Contents - Product View [196]; js - GA4 - view item [281]

## [variable] dlv - Product View - Image (100)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Inventory (99)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Inventory_import_1 (525)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Name (129)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Product View [155]; Facebook - Product View [205]; BloomReach - Product Page (Event) [412]
  - Triggers: 
  - Variables: BloomReach Product Name [398]

## [variable] dlv - Product View - Price (70)
- Folder: Elevar 2.0 - Product Page (25)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item [71]; TikTok - Product View [155]; Facebook - Product View [205]; GA4 - Item View [299]
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Product ID (29)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Product Page (Event) [412]
  - Triggers: 
  - Variables: BloomReach Product ID [399]

## [variable] dlv - Product View - Product ID_import_1 (513)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: BloomReach Product ID_import_1 [531]

## [variable] dlv - Product View - SKU (26)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Product Page (Event) [412]
  - Triggers: 
  - Variables: BloomReach Product SKU [371]

## [variable] dlv - Product View - SKU_import_1 (514)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: BloomReach Product SKU_import_1 [515]

## [variable] dlv - Product View - Variant ID (61)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item [71]
  - Triggers: 
  - Variables: 

## [variable] dlv - Product View - Variant ID_import_1 (517)
- Folder: Elevar 2.0 - Product Page (25)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Remove From Cart - Array (271)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - GA4 - remove from cart [272]

## [variable] dlv - Remove From Cart - Array_import_1 (508)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - GA4 - remove from cart_import_1 [509]

## [variable] dlv - Remove From Cart - Price (283)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Remove From Cart Value [284]

## [variable] dlv - Remove From Cart - Quantity (282)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Remove From Cart Value [284]

## [variable] dlv - Select Item - Array (276)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - GA4 - select item [277]

## [variable] dlv - Subscribe - Lead Type (89)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: Event - subscribe - email [90]; Event - subscribe - phone [113]
  - Variables: 

## [variable] dlv - Thank You Page - Action Field (152)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Subscription Purchase [160]; TikTok - Place An Order [161]; Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: js - TikTok Purchase Value (cleaned) [520]

## [variable] dlv - Thank You Page - Coupon Code Name (92)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Purchase [302]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Customer Address 1 (75)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer City (73)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer Country Code (52)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer Email (50)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Place An Order [161]; Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: js - TikTok Email (cleaned) [505]

## [variable] dlv - Thank You Page - Customer First Name (74)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer ID (125)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Purchase (Complete Payment) [154]; TikTok - Subscription Purchase [160]; TikTok - Place An Order [161]; GA4 - Purchase [302]
  - Triggers: 
  - Variables: GA4 Event Settings [285]

## [variable] dlv - Thank You Page - Customer Last Name (65)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer Lifetime Value (67)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Google Ads Remarketing - Purchase [80]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Customer Phone Number (72)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: TikTok - Place An Order [161]; Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: All Events - Phone Defined [310]
  - Variables: Enhanced Conversion Data [77]; js - TikTok Phone (E164) [503]

## [variable] dlv - Thank You Page - Customer Province Code (189)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Customer State (76)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Customer Total Order Count (53)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Purchase [80]
  - Triggers: 
  - Variables: js - New Customer - True or False [66]; js - Customer Type [190]

## [variable] dlv - Thank You Page - Customer Zip (63)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: Enhanced Conversion Data [77]

## [variable] dlv - Thank You Page - Discount Amount (118)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - ecommerce (436)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - ecommerce.purchase.products (54)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - Google Ads - Purchase - Shopify ID [79]; js - Google Ads - Purchase Product Data [82]; js - Thank You Page - Total Product Quantity [93]; js - Thank You Page - Pinterest line items [106]; js - Thank You Page - Product ID Array [122]; js - TikTok Purchase Contents [153]; js - Has Subscription Purchase [158]; js - Facebook - Contents - Thank You Page [187]; js - Facebook - Content_IDs - Thank You Page [188]; js - GA4 - purchase [301]; js - Thank You Page - BloomReach line items [421]; js - Facebook - Content_Name - Thank You Page [476]; js - Facebook - Content_Category - Thank You Page [477]

## [variable] dlv - Thank You Page - ecommerce_import_1 (534)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Order ID (69)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Pinterest - Transaction [107]; TikTok - Purchase (Complete Payment) [154]; TikTok - Subscription Purchase [160]; TikTok - Place An Order [161]; Facebook - Subscribe [193]; Facebook - Purchase [210]; BloomReach - Purchase (Conversion Page) [409]
  - Triggers: 
  - Variables: JS - TikTok Event ID [563]

## [variable] dlv - Thank You Page - Order Name (209)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: GA4 - transaction identifier [287]

## [variable] dlv - Thank You Page - Order Revenue (22)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Google Ads Remarketing - Purchase [80]; Pinterest - Transaction [107]; GA4 - Purchase [302]
  - Triggers: 
  - Variables: js - TikTok Purchase Value (cleaned) [520]

## [variable] dlv - Thank You Page - Order Revenue_import_1 (516)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Order Subtotal (112)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_NNSJS
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Purchase (Conversion Page) [409]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Order Subtotal_import_1 (542)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: cvt_9938197_507
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Shipping (109)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Purchase [302]
  - Triggers: 
  - Variables: 

## [variable] dlv - Thank You Page - Tax (114)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Purchase [302]
  - Triggers: 
  - Variables: 

## [variable] dlv - User ID (213)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Login [280]
  - Triggers: 
  - Variables: GA4 Config Settings [268]

## [variable] dlv - user_id (176)
- Folder: Elevar 2.0 - Global (27)
- Type: v
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Sitewide Pixel [179]; Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] DOM - Page Title (104)
- Folder: Elevar 2.0 - Global (27)
- Type: d
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - View Category [105]; TikTok - Collection View [148]; BloomReach - Search Results Page [389]; BloomReach - Purchase (Conversion Page) [409]; BloomReach - Product Page (Event) [412]; BloomReach - Category Page [417]; BloomReach - Content Page (Blog, Article, Pages) [418]; BloomReach - Home Page [424]
  - Triggers: 
  - Variables: 

## [variable] Enhanced Conversion Data (77)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: awec
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - Customer Country Code [52]; dlv - Thank You Page - Customer Zip [63]; dlv - Thank You Page - Customer Last Name [65]; dlv - Thank You Page - Customer Phone Number [72]; dlv - Thank You Page - Customer City [73]; dlv - Thank You Page - Customer First Name [74]; dlv - Thank You Page - Customer Address 1 [75]; dlv - Thank You Page - Customer State [76]; dlv - Customer Email [84]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]; Google Ads - Enhanced Conversions - Phone [312]; Google Ads - Enhanced Conversions - Email [313]
  - Triggers: 
  - Variables: 

## [variable] Facebook - conversion value (186)
- Folder: Elevar 2.0 - Conversion Value (149)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: constant - conversion value - revenue [150]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] Facebook - Pixel ID (177)
- Folder: Elevar 2.0 - FB (175)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Sitewide Pixel [179]; Facebook - SMS Signup [180]; Facebook - Subscribe [193]; Facebook - Account Sign Up [198]; Facebook - Search [199]; Facebook - Add Payment Info [201]; Facebook - Add to Cart [203]; Facebook - Initiate Checkout [204]; Facebook - Product View [205]; Facebook - View Category [206]; Facebook - Email Signup [207]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] Facebook - product group (192)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: constant - product group - product_group [143]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Search [199]; Facebook - Add Payment Info [201]; Facebook - Add to Cart [203]; Facebook - Initiate Checkout [204]; Facebook - Product View [205]; Facebook - View Category [206]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] Facebook - product identifier (183)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: constant - product identifier - product id [141]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add to Cart [203]; Facebook - Product View [205]
  - Triggers: 
  - Variables: js - Facebook - Contents - Impressions [184]; js - Facebook - Contents - Thank You Page [187]; js - Facebook - Content_IDs - Thank You Page [188]; js - Facebook - Contents - Checkout Page [195]; js - Facebook - Contents - Product View [196]; js - Facebook - Content_IDs - Impressions [197]; js - Facebook - Content_IDs - Checkout Page [200]; js - Facebook - Contents - Add to Cart [202]; js - Facebook - Contents - Cart Contents [211]

## [variable] GA4 - product identifier (270)
- Folder: Elevar 2.0 - Product Identifier (137)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: constant - product identifier - sku [167]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: js - GA4 - remove from cart [272]; js - GA4 - begin checkout [273]; js - GA4 - select item [277]; js - GA4 - view item [281]; js - GA4 - view item list [289]; js - GA4 - view cart [291]; js - GA4 - purchase [301]; js - GA4 - add to cart [303]; js - GA4 - remove from cart_import_1 [509]

## [variable] GA4 - transaction identifier (287)
- Folder: Elevar 2.0 - GA4 (267)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - Order Name [209]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Purchase [302]
  - Triggers: 
  - Variables: 

## [variable] GA4 Config Settings (268)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gtcs
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - User ID [213]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Base Tag Configuration [286]
  - Triggers: 
  - Variables: 

## [variable] GA4 Event Settings (285)
- Folder: Elevar 2.0 - GA4 (267)
- Type: gtes
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Global - Visitor Type [41]; dlv - Thank You Page - Customer ID [125]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Base Tag Configuration [286]
  - Triggers: 
  - Variables: 

## [variable] GA4 ID (215)
- Folder: Elevar 2.0 - GA4 (267)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 Event - collection page - product lists click [221]; GA4 Event - home page - featured collection click [223]; GA4 Event - navigation - footer nav click [227]; GA4 Event - product page - add to cart click [229]; GA4 Event - recommended products click [231]; GA4 Event - home page - shop onesies click [233]; GA4 Event - home page - featured products click [237]; GA4 Event - cart drawer - upsell products click [239]; GA4 Event - global feature - quickshop atc button click [247]; GA4 Event - home page - deal of the week click [248]; GA4 Event - navigation - desktop main nav click [250]; GA4 Event - product page - hot seller products click [251]; GA4 Event - navigation - mobile main nav click [253]; GA4 Event - collection page - colletion filter click [255]; GA4 Event - home page - hero image button click [256]; GA4 Event - cart drawer - checkout click [259]; GA4 Event - product page - product variants click [260]; GA4 Event - home page - featured category click [261]; GA4 Event - global feature - quickshop variant option click [262]; GA4 Event - navigation - announcement header click [263]; GA4 Event - home page - instagram feed interaction click [264]; GA4 Event - home page - shop outfit section click [265]; GA4 - Search [269]; GA4 - Add Payment Info [274]; GA4 - Click Item From Collection Page [278]; GA4 - Login [280]; GA4 Base Tag Configuration [286]; GA4 - SMS Subscribe [288]; GA4 - Begin Checkout [290]; GA4 - View Cart [292]; GA4 - Collection View [293]; GA4 - Remove From Cart [295]; GA4 - Add Shipping Info [297]; GA4 - Email Subscribe [298]; GA4 - Item View [299]; GA4 - Purchase [302]; GA4 - Sign Up For Account [304]; GA4 - Add to Cart [305]; GA4 - event - A/B Test KPI [455]
  - Triggers: 
  - Variables: 

## [variable] js - Add To Cart - Pinterest line items (115)
- Folder: Elevar / Pinterest (85)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Add to Cart - Add Array [37]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Add to Cart [128]
  - Triggers: 
  - Variables: 

## [variable] js - Add To Cart Value (300)
- Folder: Elevar 2.0 - Global (27)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Add to Cart - Price [43]; dlv - Add to Cart - Quantity [116]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Add to Cart [305]
  - Triggers: Click - GA4 Event - cart drawer - upsell products click [238]
  - Variables: 

## [variable] js - Checkout Page - SKUs (94)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] js - Collection - Pinterest line items (102)
- Folder: Elevar / Pinterest (85)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Search [103]; Pinterest - View Category [105]
  - Triggers: 
  - Variables: 

## [variable] js - Customer Type (190)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - Customer Total Order Count [53]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_Category - Checkout Page (478)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add Payment Info [201]; Facebook - Initiate Checkout [204]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_Category - Thank You Page (477)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_IDs - Checkout Page (200)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add Payment Info [201]; Facebook - Initiate Checkout [204]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_IDs - Impressions (197)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Search [199]; Facebook - View Category [206]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_IDs - Thank You Page (188)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_Name - Checkout Page (479)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add Payment Info [201]; Facebook - Initiate Checkout [204]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Content_Name - Thank You Page (476)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Add to Cart (202)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Add to Cart - Add Array [37]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add to Cart [203]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Cart Contents (211)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: Facebook - product identifier [183]; dlv - ecommerce.cart_contents.products [208]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Checkout Page (195)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Add Payment Info [201]; Facebook - Initiate Checkout [204]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Impressions (184)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Search [199]; Facebook - View Category [206]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Product View (196)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Product View - Details Array [31]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Product View [205]
  - Triggers: 
  - Variables: 

## [variable] js - Facebook - Contents - Thank You Page (187)
- Folder: Elevar 2.0 - FB (175)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]; Facebook - product identifier [183]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: js - Reddit - Purchase Items [598]

## [variable] js - GA4 - add to cart (303)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Add to Cart - Add Array [37]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Add to Cart [305]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - begin checkout (273)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.checkout.products [91]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Add Payment Info [274]; GA4 - Begin Checkout [290]; GA4 - Add Shipping Info [297]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - purchase (301)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Purchase [302]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - remove from cart (272)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: GA4 - product identifier [270]; dlv - Remove From Cart - Array [271]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Remove From Cart [295]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - remove from cart_import_1 (509)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: GA4 - product identifier [270]; dlv - Remove From Cart - Array_import_1 [508]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - select item (277)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: GA4 - product identifier [270]; dlv - Select Item - Array [276]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Click Item From Collection Page [278]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - view cart (291)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - View Cart [292]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - view item (281)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Product View - Details Array [31]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Item View [299]
  - Triggers: 
  - Variables: 

## [variable] js - GA4 - view item list (289)
- Folder: Elevar 2.0 - GA4 (267)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]; GA4 - product identifier [270]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Collection View [293]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Add to Cart - Shopify ID (38)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Add to Cart - Add Array [37]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Add to Cart [44]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Cart Page - Shopify ID (47)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Cart Page [49]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Collection Page - Shopify ID (57)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - ecommerce.impressions [46]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Search Results [58]; Google Ads Remarketing - View Item List [68]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Product View - Shopify ID (33)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Product View - Details Array [31]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - View Item [71]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Purchase - Shopify ID (79)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Purchase [80]
  - Triggers: 
  - Variables: 

## [variable] js - Google Ads - Purchase Product Data (82)
- Folder: Elevar 2.0 - Google Ads (32)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]
  - Triggers: 
  - Variables: 

## [variable] js - Has Subscription Purchase (158)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: Event - subscription purchase [159]
  - Variables: 

## [variable] js - New Customer - True or False (66)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - Customer Total Order Count [53]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Conversion - Purchase [78]
  - Triggers: 
  - Variables: 

## [variable] js - Product View - Pinterest line items (119)
- Folder: Elevar / Pinterest (85)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Product View - Details Array [31]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Product Detail View [127]
  - Triggers: 
  - Variables: 

## [variable] js - Remove From Cart Value (284)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Remove From Cart - Quantity [282]; dlv - Remove From Cart - Price [283]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: GA4 - Remove From Cart [295]
  - Triggers: 
  - Variables: 

## [variable] js - Remove PII from GA Hit (194)
- Folder: Elevar 2.0 - Global (27)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] js - Thank You Page - BloomReach line items (421)
- Folder: Elevar / Pinterest (85)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: BloomReach - Purchase (Conversion Page) [409]
  - Triggers: 
  - Variables: 

## [variable] js - Thank You Page - Pinterest line items (106)
- Folder: Elevar / Pinterest (85)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Transaction [107]
  - Triggers: 
  - Variables: 

## [variable] js - Thank You Page - Product ID Array (122)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: 
  - Triggers: 
  - Variables: 

## [variable] js - Thank You Page - Total Product Quantity (93)
- Folder: Elevar 2.0 - Cart and Checkout (21)
- Type: jsm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: dlv - Thank You Page - ecommerce.purchase.products [54]
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Transaction [107]
  - Triggers: 
  - Variables: 

## [variable] Pinterest ID (86)
- Folder: Elevar / Pinterest (85)
- Type: c
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Pinterest - Account Sign Up [88]; Pinterest - Search [103]; Pinterest - View Category [105]; Pinterest - Transaction [107]; Pinterest - Lead [111]; Pinterest - Pageview [124]; Pinterest - Product Detail View [127]; Pinterest - Add to Cart [128]; Pinterest - Base Tag [131]
  - Triggers: 
  - Variables: 

## [variable] regex - Page Type (30)
- Folder: Elevar 2.0 - Global (27)
- Type: remm
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Pageview [81]
  - Triggers: 
  - Variables: 

## [variable] url - Search - Search Term (56)
- Folder: Elevar 2.0 - Collection and Search Page (34)
- Type: u
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Google Ads Remarketing - Search Results [58]; Pinterest - Search [103]; TikTok - Search [168]; Facebook - Search [199]; GA4 - Search [269]; BloomReach - Search Results Page [389]; BloomReach - Search Event [425]
  - Triggers: 
  - Variables: 

## [variable] var - Thank You Page - User Data Event ID (185)
- Folder: Elevar 2.0 - FB (175)
- Type: j
- Purpose: Provides transformed or extracted value used by tags/triggers.
- References:
  - Variables: 
  - Triggers: 
  - Templates: 
- Referenced by:
  - Tags: Facebook - Subscribe [193]; Facebook - Purchase [210]
  - Triggers: 
  - Variables: 

