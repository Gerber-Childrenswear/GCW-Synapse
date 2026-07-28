# Gallagher Cyber Policy — Data Processing Answers (Gerber Childrenswear)

Prepared from live privacy policy (updated 04/07/2026), storefront CMP (Pandectes + OneTrust), and Shopify → Synapse → GTM/sGTM → ad platforms stack.

**Scope:** Website / Shopify storefront (`www.gerberchildrenswear.com`). No official Gerber Childrenswear mobile app in this stack.

---

## State-Specific Data Processing

**1. Do you collect biometric information on residents from Illinois, Texas, or the State of Washington?**

**No.**

No biometric collection (faceprints, fingerprints, voiceprints, or similar) in the Shopify/Synapse/GTM stack or privacy policy.

*Note:* Parents may voluntarily upload a child photo for the “My First Trading Card” program. That is a photo for product fulfillment, not biometric identification technology, unless face geometry is extracted elsewhere outside this stack.

---

**2. Do you collect health data from residents of the State of Washington?**

**No.**

No medical, health, or genetic data fields in analytics schemas or GA4/ad payloads.

*Note for counsel:* Trading-card fields can include age, weight, and height provided by parents. Flag for Washington My Health My Data review if needed; usual answer for this questionnaire is **No** unless counsel treats that as consumer health data.

---

**3. Do you collect personal data from either (a) more than 35,000 Maryland residents annually; or (b) more than 10,000 Maryland residents and derive more than 20% of your revenue from selling personal data? If yes, do you collect data used to identify a Maryland resident’s physical or mental health status (including genetic, biometric, precise geolocation, data concerning children, race, ethnicity, religion, sexual orientation, sex life, transgender or nonbinary status, immigration status)?**

**Volume thresholds: Cannot confirm from systems alone** — needs business metrics (MD resident counts / revenue %).

Privacy policy already lists **Maryland** among states treated as in scope.

**Sensitive data sub-question:**
- **No** for genetic, biometric, precise geolocation, race, ethnicity, religion, sexual orientation, sex life, transgender/nonbinary status, or immigration status.
- **Yes** for some **data concerning children** (parent-provided photo / age / weight / height; loyalty may include birthday / gender / age).

---

## Website and Mobile App Data

**1. Do you engage in targeted advertising using data collected through your website or mobile app?**

**Yes.**

Meta, Google Ads (remarketing + conversions), TikTok, Pinterest, Reddit, StackAdapt, Bloomreach; GA4 (`G-YMJ9F7HY6P`). Confirmed in privacy policy §3 and GTM/ad stack.

---

**2. If yes, do you provide consumers with notice and a method for opting out?**

**Yes.**

- Pandectes cookie consent banner
- Privacy policy disclosures
- Phone: **1-877-313-2114** / email: **customercare@gerberchildrenswear.com**
- Footer link: **Do Not Sell or Share My Information** → OneTrust privacy request form

---

**3. If yes, have you confirmed that targeted advertising is disabled for consumers who have opted out?**

**Partially — confirm with ops/privacy.**

GTM tags use Consent Mode (`consentStatus: NEEDED`). Synapse gates marketing events on `ad_storage` / `ad_personalization`. Global Privacy Control (GPC) is described as “working towards,” not fully live. End-to-end honor across all ad vendors should be verified operationally.

---

**4. Do you engage in the sale of consumer data collected through your website or mobile app?**

**Yes under CCPA “sale/share” (ad-tech sharing). No sale/rent to data brokers for pure profit.**

Privacy policy: personal information is shared for personalized services and cross-context behavioral advertising. Site maintains a **Do Not Sell or Share** link. Shopify web pixel registers `sale_of_data = enabled` for consent purposes.

---

**5. If yes, do you provide consumers with notice and a method for opting out?**

**Yes.**

Same mechanisms as #2 (OneTrust “Do Not Sell My Information,” phone, email, CMP banner).

---

**6. If yes, have you confirmed that sale of consumer data is disabled for consumers who have opted out?**

**Confirm with ops/privacy.**

Opt-out mechanisms exist; not independently verified across every downstream ad partner from the analytics repo alone.

---

**7. Do you engage in profiling and/or automated decision-making using data collected through your website or mobile app?**

**Marketing profiling: Yes. Automated decisions with legal or similarly significant effects: No evidence.**

Present: ad audiences, purchase-based personalization, inferences, Bloomreach segments. Bot/visitor filtering is for analytics integrity, not consumer eligibility scoring. Privacy policy offers a profiling opt-out for Maryland / Nebraska / Texas residents for profiling in furtherance of decisions with legal or similarly significant effects.

---

**8. If yes, do you provide consumers with notice and a method for opting out?**

**Yes (via privacy rights requests).**

Phone / email and state privacy rights section. OneTrust form options observed: Access / Delete / Do Not Sell (no separate “profiling” checkbox on the form).

---

**9. If yes, have you confirmed that profiling and/or automated decision-making is disabled for consumers who have opted out?**

**Confirm with ops/legal.**

Process is claimed in the privacy policy; not fully proven in code for every use case.

---

**10. Do you engage in the collection of data from or about individuals under the age of 18 through your website or mobile app?**

**Nuanced — disclose carefully.**

- Site is intended for individuals **18+**.
- COPPA: do not knowingly collect from anyone under **13** without verifiable parental consent.
- **Yes**, data **about children** may be collected from parents (My First Trading Card photo/details; cookies may store child’s name / DOB).
- California under-18 public-post removal rights are described in the privacy policy.
- Children’s apparel is sold; Shopify accounts are adult purchasers.

---

**11. Do you maintain records or logs of consumer opt-ins?**

**Yes for key channels; not inside Synapse itself.**

- SMS affirmative opt-in (per privacy policy)
- “Do Not Mail” file for mailing opt-outs
- OneTrust privacy request portal
- Pandectes CMP consent records
- Synapse analytics relay has **no durable consent ledger** — records live in CMP / OneTrust / Shopify / messaging vendors (e.g. Yotpo)

---

## Open items before signing

1. Maryland resident volume / revenue thresholds (Q3)
2. Ops confirmation that opt-outs fully disable targeted ads, sale/share, and profiling across all vendors (Q3, Q6, Q9)

---

## Sources

- Privacy policy: https://www.gerberchildrenswear.com/pages/privacy-policy
- Do Not Sell / Share form: OneTrust (footer link on site)
- Stack: Shopify storefront + GCW Synapse + web GTM (`GTM-TKW58K8`) + sGTM (`GTM-N45F3JCC`) + Meta / Google / TikTok / Pinterest / Reddit / etc.
