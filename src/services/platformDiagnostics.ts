/**
 * Platform-specific diagnostics grounded in vendor developer docs.
 * Maps observed error strings + health signals → exact causes + fix steps + doc URLs.
 */

export type DiagnosedCause = {
  code: string;
  title: string;
  severity: "warning" | "critical";
  cause: string;
  fix: string;
  doc_url: string;
  doc_label: string;
  evidence?: string;
};

type CauseRule = {
  code: string;
  title: string;
  severity: "warning" | "critical";
  match: RegExp;
  cause: string;
  fix: string;
  doc_url: string;
  doc_label: string;
};

const META_RULES: CauseRule[] = [
  {
    code: "meta.oauth_190",
    title: "Invalid or expired CAPI access token",
    severity: "critical",
    match: /invalid\s*(oauth|access)?\s*token|error.?code.?190|oauthexception|expired.?token/i,
    cause: "Meta rejected the Conversions API request because the access token is missing, expired, or lacks ads_management / events permission.",
    fix: "Regenerate the Pixel access token in Events Manager → Settings → Generate access token, update the sGTM Meta CAPI tag, and republish.",
    doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/get-started",
    doc_label: "Meta CAPI get started"
  },
  {
    code: "meta.param_100",
    title: "Invalid CAPI parameters",
    severity: "critical",
    match: /invalid\s*parameter|error.?code.?100|(#100)|param/i,
    cause: "A required CAPI field is malformed (event_name, event_time, user_data, or custom_data). Meta returns Graph API error code 100.",
    fix: "Compare the outbound CAPI payload to Meta's Server Event parameters. Ensure event_time is Unix seconds and hashed PII uses SHA-256 lowercase.",
    doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event",
    doc_label: "Meta server event params"
  },
  {
    code: "meta.dedupe_partial",
    title: "Partial Pixel ↔ CAPI dedupe",
    severity: "warning",
    match: /partial|browser-only|orphan|unpaired/i,
    cause: "Some browser events have event_ids that never arrived on CAPI (or vice versa). Meta will not dedupe unpaired ids and conversion counts can inflate.",
    fix: "Ensure every Pixel eventID is also sent on CAPI with the same event_name within 48 hours. Drop orphan client-only test events or mirror them server-side.",
    doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events",
    doc_label: "Meta dedupe docs"
  },
  {
    code: "meta.dedupe_mismatch",
    title: "Pixel + CAPI not sharing event_id",
    severity: "warning",
    match: /dedupe|event_id|eventid|duplicate/i,
    cause: "Meta deduplicates only when browser eventID and CAPI event_id match AND event_name matches, within 48 hours.",
    fix: "Generate one event_id upstream (Synapse), pass it to both Pixel eventID and CAPI event_id. Never regenerate separately per surface.",
    doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events",
    doc_label: "Meta dedupe docs"
  },
  {
    code: "meta.emq",
    title: "Advanced Matching / EMQ quality drop",
    severity: "warning",
    match: /advanced\s*matching|emq|customer.?information|user_data/i,
    cause: "user_data (em/ph/fbp/fbc/external_id) is missing or inconsistently hashed, lowering Event Match Quality.",
    fix: "Send the same hashed email/phone and fbp/fbc cookies on CAPI that the Pixel would have. Hash as SHA-256 of normalized values.",
    doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters",
    doc_label: "Meta customer info params"
  }
];

const TIKTOK_RULES: CauseRule[] = [
  {
    code: "tiktok.token",
    title: "Invalid Events API access token",
    severity: "critical",
    match: /access[_\s-]?token|unauthorized|401|invalid.?token/i,
    cause: "TikTok Events API rejected the request — access token invalid, revoked, or not tied to this Pixel.",
    fix: "In TikTok Events Manager, regenerate the Events API access token for the correct Pixel ID and update the sGTM TikTok tag.",
    doc_url: "https://ads.tiktok.com/help/article/events-api",
    doc_label: "TikTok Events API"
  },
  {
    code: "tiktok.pixel_id",
    title: "Pixel ID mismatch",
    severity: "critical",
    match: /pixel[_\s-]?id|not.?found|unknown.?pixel/i,
    cause: "Browser Pixel ID and Events API pixel_code do not match the same TikTok pixel.",
    fix: "Align GTM browser TikTok Pixel ID with the server Events API pixel_code.",
    doc_url: "https://ads.tiktok.com/help/article/tiktok-pixel",
    doc_label: "TikTok Pixel"
  },
  {
    code: "tiktok.dedupe",
    title: "Missing event_id for Pixel + Events API dedupe",
    severity: "warning",
    match: /event_id|dedupe|duplicate/i,
    cause: "TikTok dedupes browser and server events via a shared event_id (and order id for CompletePayment).",
    fix: "Pass Synapse event_id into both the browser pixel and Events API payloads for the same conversion.",
    doc_url: "https://business-api.tiktok.com/portal/docs?id=1740858498630657",
    doc_label: "TikTok Events API docs"
  }
];

const GA4_RULES: CauseRule[] = [
  {
    code: "ga4.measurement_id",
    title: "Measurement ID / API secret mismatch",
    severity: "critical",
    match: /measurement[_\s-]?id|api[_\s-]?secret|firebase|401|403|forbidden/i,
    cause: "Measurement Protocol rejected the hit — wrong measurement_id or api_secret for this GA4 property.",
    fix: "In GA4 Admin → Data streams → Measurement Protocol API secrets, copy the secret into the sGTM GA4 tag and confirm the G- ID matches.",
    doc_url: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    doc_label: "GA4 Measurement Protocol"
  },
  {
    code: "ga4.transaction_id",
    title: "Purchase transaction_id not aligned",
    severity: "warning",
    match: /transaction_id|duplicate.?purchase|order.?id/i,
    cause: "Client and server purchase events must share the same transaction_id for accurate reporting and dedupe.",
    fix: "Map Synapse order id / transaction_id identically on browser GA4 and MP/sGTM purchase tags.",
    doc_url: "https://support.google.com/analytics/answer/11118835",
    doc_label: "GA4 purchase event"
  }
];

const GOOGLE_ADS_RULES: CauseRule[] = [
  {
    code: "gads.conversion_label",
    title: "Conversion ID / label misconfigured",
    severity: "critical",
    match: /conversion[_\s-]?(id|label)|aw-|invalid.?conversion/i,
    cause: "Google Ads conversion tag is pointing at the wrong conversion ID or label after the Synapse cutover.",
    fix: "Re-map the sGTM Google Ads Conversion tag to the live conversion action ID/label from Google Ads → Goals.",
    doc_url: "https://support.google.com/google-ads/answer/7548399",
    doc_label: "Google Ads conversions"
  },
  {
    code: "gads.enhanced",
    title: "Enhanced conversions hashing mismatch",
    severity: "warning",
    match: /enhanced.?conversion|hashed|user[_\s-]?data|em\b|ph\b/i,
    cause: "Enhanced conversions require consistently normalized + hashed user identifiers across browser and server.",
    fix: "Hash email/phone the same way on both surfaces (trim, lowercase, SHA-256) before sending.",
    doc_url: "https://support.google.com/google-ads/answer/13258081",
    doc_label: "Enhanced conversions"
  }
];

const REDDIT_RULES: CauseRule[] = [
  {
    code: "reddit.capi_auth",
    title: "Reddit CAPI auth / conversion token failure",
    severity: "critical",
    match: /unauthorized|401|403|token|conversion.?token/i,
    cause: "Reddit Conversions API rejected authentication for this pixel / conversion token.",
    fix: "Rotate the Reddit conversion access token in Ads Manager and update the sGTM Reddit CAPI tag. Confirm bot suppression is not blocking shoppers.",
    doc_url: "https://business.reddithelp.com/s/article/Conversions-API",
    doc_label: "Reddit CAPI"
  },
  {
    code: "reddit.dedupe",
    title: "Conversion ID mismatch for Pixel + CAPI",
    severity: "warning",
    match: /conversion.?id|event_id|dedupe|duplicate/i,
    cause: "Reddit expects a shared conversion ID strategy between Pixel and CAPI for the same action.",
    fix: "Pass the same conversion/event id from Synapse to both Reddit Pixel and CAPI tags.",
    doc_url: "https://business.reddithelp.com/s/article/Install-the-Reddit-Pixel-on-your-website",
    doc_label: "Reddit Pixel"
  }
];

const PINTEREST_RULES: CauseRule[] = [
  {
    code: "pin.tag",
    title: "Pinterest Tag / Conversions API auth failure",
    severity: "critical",
    match: /unauthorized|401|403|access.?token|tag.?id/i,
    cause: "Pinterest Tag ID or Conversions API access token does not match the ad account tag.",
    fix: "Verify Tag ID in the browser tag and the Conversions API token under Pinterest Ads → Conversions.",
    doc_url: "https://developers.pinterest.com/docs/conversions/conversion-api/",
    doc_label: "Pinterest Conversions API"
  },
  {
    code: "pin.dedupe",
    title: "event_id missing across Tag + CAPI",
    severity: "warning",
    match: /event_id|dedupe|duplicate/i,
    cause: "Pinterest dedupes Tag and Conversions API events when event_id aligns.",
    fix: "Send Synapse event_id on both the Pinterest Tag event and the Conversions API payload.",
    doc_url: "https://help.pinterest.com/en/business/article/pinterest-tag-event-parameters",
    doc_label: "Pinterest event parameters"
  }
];

const BLOOMREACH_RULES: CauseRule[] = [
  {
    code: "br.auth",
    title: "Bloomreach API project token / auth failure",
    severity: "critical",
    match: /unauthorized|401|403|project.?token|api.?key/i,
    cause: "Bloomreach Engagement tracking endpoint rejected the project token or API key.",
    fix: "Confirm project token + API credentials in the sGTM Bloomreach tag against Engagement project settings.",
    doc_url: "https://documentation.bloomreach.com/engagement/reference/track-event",
    doc_label: "Bloomreach track event"
  },
  {
    code: "br.schema",
    title: "Elevar-shaped dataLayer fields not remapped",
    severity: "warning",
    match: /undefined|missing.?property|catalog|customer.?id|dl_/i,
    cause: "Bloomreach GTM variables may still read Elevar field paths that Synapse does not populate the same way.",
    fix: "Remap Bloomreach GTM variables to Synapse companion dataLayer keys before cutting Elevar off.",
    doc_url: "https://documentation.bloomreach.com/engagement/docs/gtm-integration",
    doc_label: "Bloomreach GTM integration"
  }
];

const SGTM_RULES: CauseRule[] = [
  {
    code: "sgtm.preview",
    title: "sGTM tag not firing on Synapse events",
    severity: "warning",
    match: /not.?firing|no.?tag|preview|trigger/i,
    cause: "Server GTM triggers still listen for Elevar-only event names or clients.",
    fix: "Update triggers to Synapse dl_* / webhook clients and publish workspace GTM-N45F3JCC.",
    doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
    doc_label: "Server-side GTM"
  }
];

const GENERIC_RULES: CauseRule[] = [
  {
    code: "http.401",
    title: "Destination unauthorized (401)",
    severity: "critical",
    match: /\b401\b|unauthorized/i,
    cause: "The destination API returned HTTP 401 — credentials are wrong or revoked.",
    fix: "Rotate the destination credential in sGTM and confirm the account still has API access.",
    doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
    doc_label: "sGTM debugging"
  },
  {
    code: "http.403",
    title: "Destination forbidden (403)",
    severity: "critical",
    match: /\b403\b|forbidden/i,
    cause: "The destination API returned HTTP 403 — token scopes or IP allowlists are blocking the call.",
    fix: "Check token scopes / app permissions and any allowlist on the vendor side.",
    doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
    doc_label: "sGTM debugging"
  },
  {
    code: "http.429",
    title: "Rate limited by destination",
    severity: "warning",
    match: /\b429\b|rate.?limit|too.?many.?requests/i,
    cause: "The destination is throttling requests.",
    fix: "Enable batching/backoff on the sGTM tag and reduce duplicate fan-out during dual-run.",
    doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
    doc_label: "sGTM debugging"
  },
  {
    code: "http.5xx",
    title: "Destination server error",
    severity: "warning",
    match: /\b5\d\d\b|internal.?server|unavailable|timeout/i,
    cause: "The destination returned a transient 5xx / timeout.",
    fix: "Retry with backoff. If persistent, check vendor status and payload size.",
    doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
    doc_label: "sGTM debugging"
  }
];

const RULES_BY_PLATFORM: Record<string, CauseRule[]> = {
  meta: META_RULES,
  facebook: META_RULES,
  tiktok: TIKTOK_RULES,
  ga4: GA4_RULES,
  google_ads: GOOGLE_ADS_RULES,
  google: [...GA4_RULES, ...GOOGLE_ADS_RULES],
  reddit: REDDIT_RULES,
  pinterest: PINTEREST_RULES,
  bloomreach: BLOOMREACH_RULES,
  server_gtm: SGTM_RULES,
  sgtm: SGTM_RULES,
  gtm: SGTM_RULES
};

function platformKey(channel: string): string {
  return channel.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function diagnoseErrorMessage(
  channel: string,
  errorMessage: string | undefined,
  extras?: {
    missingDedupe?: boolean;
    partialDedupe?: boolean;
    surfaceSilent?: boolean;
    browserOnly?: boolean;
    serverOnly?: boolean;
  }
): DiagnosedCause[] {
  const causes: DiagnosedCause[] = [];
  const key = platformKey(channel);
  const rules = [...(RULES_BY_PLATFORM[key] ?? []), ...GENERIC_RULES];
  const msg = errorMessage?.trim() ?? "";

  if (msg) {
    for (const rule of rules) {
      if (rule.match.test(msg)) {
        causes.push({
          code: rule.code,
          title: rule.title,
          severity: rule.severity,
          cause: rule.cause,
          fix: rule.fix,
          doc_url: rule.doc_url,
          doc_label: rule.doc_label,
          evidence: msg
        });
      }
    }
  }

  if (extras?.partialDedupe) {
    const partial =
      rules.find((r) => r.code.includes("dedupe_partial")) ??
      rules.find((r) => r.code.includes("dedupe")) ??
      null;
    causes.push({
      code: partial?.code ?? `${key}.dedupe_partial`,
      title: partial?.title ?? "Partial browser ↔ server dedupe",
      severity: "warning",
      cause:
        partial?.cause ??
        "Some events share a dedupe key across surfaces, but unpaired browser-only or server-only keys remain.",
      fix:
        partial?.fix ??
        "Mirror every browser event_id/transaction_id on the server tag (and vice versa) within the vendor dedupe window.",
      doc_url:
        partial?.doc_url ??
        "https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events",
      doc_label: partial?.doc_label ?? "Dedupe reference"
    });
  } else if (extras?.missingDedupe) {
    const dedupeRule =
      rules.find((r) => r.code.includes("dedupe") && !r.code.includes("partial")) ??
      ({
        code: `${key}.dedupe_generic`,
        title: "Browser ↔ server dedupe keys missing",
        severity: "warning" as const,
        match: /.*/,
        cause: "No shared event_id / transaction_id was observed between browser and server for this platform.",
        fix: "Emit a stable event_id from Synapse and map it into both the browser tag and the server tag.",
        doc_url: "https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events",
        doc_label: "Dedupe reference (Meta pattern)"
      } satisfies CauseRule);
    if (!causes.some((c) => c.code === dedupeRule.code)) {
      causes.push({
        code: dedupeRule.code,
        title: dedupeRule.title,
        severity: "warning",
        cause: dedupeRule.cause,
        fix: dedupeRule.fix,
        doc_url: dedupeRule.doc_url,
        doc_label: dedupeRule.doc_label
      });
    }
  }

  if (extras?.browserOnly) {
    causes.push({
      code: `${key}.server_silent`,
      title: "Server surface silent while browser is firing",
      severity: "warning",
      cause: "Browser events are landing but no matching server/CAPI/webhook events were observed for this platform.",
      fix: "Confirm sGTM server tags for this destination are published and triggered by Synapse webhooks / server events.",
      doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
      doc_label: "Server-side GTM"
    });
  }

  if (extras?.serverOnly) {
    causes.push({
      code: `${key}.browser_silent`,
      title: "Browser surface silent while server is firing",
      severity: "warning",
      cause: "Server events are landing but the browser pixel/tag is idle — consent, adblock, or tag load failure are common causes.",
      fix: "In GTM Preview / network tab, confirm the browser tag loads and fires on Synapse dl_* events.",
      doc_url: "https://support.google.com/tagmanager/answer/6107056",
      doc_label: "GTM Preview"
    });
  }

  if (causes.length === 0 && msg) {
    causes.push({
      code: `${key}.unknown_error`,
      title: "Destination returned an error",
      severity: "critical",
      cause: "An error was recorded for this destination but it did not match a known vendor pattern.",
      fix: "Open the vendor docs and compare the raw error payload to required auth + event fields.",
      doc_url: "https://developers.google.com/tag-platform/tag-manager/server-side",
      doc_label: "sGTM debugging",
      evidence: msg
    });
  }

  const seen = new Set<string>();
  return causes.filter((c) => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });
}

export function dedupeKeyFieldForPlatform(platformId: string): "event_id" | "transaction_id" | "either" {
  if (platformId === "ga4" || platformId === "google_ads" || platformId === "cj") return "transaction_id";
  if (platformId === "synapse" || platformId === "server_gtm") return "either";
  return "event_id";
}
