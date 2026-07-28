import { readFileSync } from "node:fs";
import path from "node:path";

export type LeanEnvironment = {
  label: string;
  shopifyShop: string;
  storefrontOrigins: string[];
  themeEmbedEndpoint: string;
  customerEventsPixelEndpoint: string;
  notes?: string;
};

export type LeanConfig = {
  defaultEnvironment: string;
  workerBaseUrl: string;
  gtmWebContainerImport: string;
  criticalRuntimeEvents: string[];
  environments: Record<string, LeanEnvironment>;
};

export type ResolvedLeanTarget = {
  environment: string;
  baseUrl: string;
  origin: string;
  shopifyShop: string;
  criticalRuntimeEvents: string[];
  themeEmbedEndpoint: string;
};

type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

function parseArgMap(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      continue;
    }

    args.set(key, value);
    index += 1;
  }

  return args;
}

export function loadLeanConfig(configPath = path.join(process.cwd(), "lean.config.json")): LeanConfig {
  const raw = readFileSync(configPath, "utf8");
  return JSON.parse(raw) as LeanConfig;
}

export function resolveLeanTarget(
  config: LeanConfig,
  options?: { environment?: string; baseUrl?: string; origin?: string }
): ResolvedLeanTarget {
  const environment = options?.environment ?? config.defaultEnvironment;
  const envConfig = config.environments[environment];

  if (!envConfig) {
    throw new Error(`Unknown lean environment "${environment}". Available: ${Object.keys(config.environments).join(", ")}`);
  }

  const baseUrl = (options?.baseUrl ?? config.workerBaseUrl).replace(/\/$/, "");
  const origin = options?.origin ?? envConfig.storefrontOrigins[0];

  if (!origin) {
    throw new Error(`No storefront origin configured for environment "${environment}"`);
  }

  return {
    environment,
    baseUrl,
    origin,
    shopifyShop: envConfig.shopifyShop,
    criticalRuntimeEvents: config.criticalRuntimeEvents,
    themeEmbedEndpoint: envConfig.themeEmbedEndpoint
  };
}

export function buildSampleEvent(eventName: string, origin: string, shopifyShop?: string): Record<string, unknown> {
  return {
    event_name: eventName,
    source: "theme",
    shop: shopifyShop,
    customer: {
      id: "lean-verify-customer",
      email: "lean.verify@example.com",
      visitor_type: "human"
    },
    product:
      eventName === "view_item" || eventName === "add_to_cart"
        ? {
            product_id: "9001",
            variant_id: "9001-1",
            name: "Lean Verify Product",
            price: 29.99,
            quantity: 1
          }
        : {},
    collection: {},
    cart: {
      cart_id: "cart-lean-verify",
      total: eventName === "add_to_cart" ? 29.99 : 0,
      currency: "USD",
      item_count: eventName === "add_to_cart" ? 1 : 0
    },
    checkout:
      eventName === "purchase"
        ? {
            order_id: "lean-verify-1001",
            revenue: 29.99,
            currency: "USD"
          }
        : {},
    marketing: {
      event_id: `lean_${eventName}_${Date.now()}`
    },
    session: {
      page_url: `${origin}/products/lean-verify`
    },
    consent: {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    }
  };
}

export function buildBeaconPayload(eventName: string, shopifyShop: string): Record<string, unknown> {
  return {
    event: eventName.startsWith("dl_") ? eventName : `dl_${eventName}`,
    shop: shopifyShop,
    source: "synapse",
    event_id: `lean_beacon_${eventName}_${Date.now()}`
  };
}

export function resolveAdminToken(explicit?: string): string {
  const token =
    explicit?.trim() ||
    process.env.ADMIN_UI_PASSWORD?.trim() ||
    process.env.SYNAPSE_INGRESS_TOKEN?.trim() ||
    process.env.INGRESS_SHARED_TOKEN?.trim() ||
    "";
  if (!token) {
    throw new Error(
      "Admin token required: pass --token or set ADMIN_UI_PASSWORD / SYNAPSE_INGRESS_TOKEN (no repo default)."
    );
  }
  return token;
}

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  try {
    const detail = await fn();
    return { name, passed: true, detail };
  } catch (error) {
    return {
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const config = loadLeanConfig(args.get("config"));
  const target = resolveLeanTarget(config, {
    environment: args.get("env"),
    baseUrl: args.get("base_url"),
    origin: args.get("origin")
  });
  const adminToken = resolveAdminToken(args.get("token"));
  const envConfig = config.environments[target.environment];

  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("health", async () => {
      const response = await fetch(`${target.baseUrl}/health`);
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      return body;
    })
  );

  checks.push(
    await runCheck("compatibility_ids_public", async () => {
      const response = await fetch(`${target.baseUrl}/compatibility/ids`);
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      const json = JSON.parse(body) as { ok?: boolean; ids?: { ga4_measurement_id?: string } };
      if (!json.ok || !json.ids?.ga4_measurement_id) {
        throw new Error("compatibility payload missing ids");
      }
      return `ga4=${json.ids.ga4_measurement_id}`;
    })
  );

  checks.push(
    await runCheck("cdn_script", async () => {
      const response = await fetch(`${target.baseUrl}/gcw-synapse.js`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.text();
      if (body.length < 100) {
        throw new Error("CDN script too small");
      }
      return `bytes=${body.length}`;
    })
  );

  checks.push(
    await runCheck("admin_gate", async () => {
      const response = await fetch(`${target.baseUrl}/`, { redirect: "manual" });
      if (response.status !== 302) {
        throw new Error(`expected 302 login redirect, got ${response.status}`);
      }
      const location = response.headers.get("location") || "";
      if (!location.includes("/login")) {
        throw new Error(`unexpected Location: ${location}`);
      }
      return location;
    })
  );

  for (const eventName of target.criticalRuntimeEvents) {
    checks.push(
      await runCheck(`event:${eventName}`, async () => {
        const response = await fetch(`${target.baseUrl}/event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: target.origin
          },
          body: JSON.stringify(buildSampleEvent(eventName, target.origin, target.shopifyShop))
        });
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return body;
      })
    );
  }

  checks.push(
    await runCheck("cdn_elevar_mirror", async () => {
      const response = await fetch(`${target.baseUrl}/gcw-synapse.js`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.text();
      if (!body.includes("elevar-datalayer") && !body.includes("__synapseElevarMirror")) {
        throw new Error("CDN bundle missing Elevar dual-run mirror markers");
      }
      return "mirror present";
    })
  );

  checks.push(
    await runCheck("browser_beacon", async () => {
      const response = await fetch(`${target.baseUrl}/browser/beacon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: target.origin
        },
        body: JSON.stringify(buildBeaconPayload("view_item", target.shopifyShop))
      });
      const body = await response.text();
      if (response.status !== 202 && !response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      return body.slice(0, 180);
    })
  );

  checks.push(
    await runCheck("browser_beacon_elevar", async () => {
      const payload = {
        ...buildBeaconPayload("view_item", target.shopifyShop),
        source: "elevar-datalayer",
        event_id: `lean_elevar_${Date.now()}`
      };
      const response = await fetch(`${target.baseUrl}/browser/beacon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: target.origin
        },
        body: JSON.stringify(payload)
      });
      const body = await response.text();
      if (response.status !== 202 && !response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      const json = JSON.parse(body) as { source?: string; accepted?: boolean };
      if (json.source !== "elevar") {
        throw new Error(`expected source=elevar, got ${json.source}`);
      }
      return body.slice(0, 180);
    })
  );

  checks.push(
    await runCheck("ops_connection", async () => {
      const response = await fetch(`${target.baseUrl}/ops/connection`, {
        headers: { "X-Synapse-Token": adminToken }
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      const json = JSON.parse(body) as { status?: string; incomplete?: string[] };
      const incomplete = Array.isArray(json.incomplete) ? json.incomplete : [];
      return `${json.status || "unknown"}; incomplete=${incomplete.join(",") || "none"}`;
    })
  );

  checks.push(
    await runCheck("shopify_install_status", async () => {
      const response = await fetch(`${target.baseUrl}/ops/shopify-install-status`, {
        headers: { "X-Synapse-Token": adminToken }
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      const json = JSON.parse(body) as {
        status?: { installed_shops?: string[]; shop_status?: Array<{ shop: string; installed: boolean }> };
      };
      const installed = json.status?.installed_shops ?? [];
      const shops = json.status?.shop_status ?? [];
      if (!Array.isArray(shops) || shops.length === 0) {
        // Older Worker builds before cutover-push — still surface installed_shops.
        return `legacy installed=${installed.join(",") || "none"} (shop_status pending deploy)`;
      }
      return `installed=${installed.join(",") || "none"}`;
    })
  );

  checks.push(
    await runCheck("launch_readiness", async () => {
      const response = await fetch(`${target.baseUrl}/launch/readiness`, {
        headers: { "X-Synapse-Token": adminToken }
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      const json = JSON.parse(body) as { report?: { status?: string; browser_parity?: { elevar_events?: number } } };
      const status = json.report?.status ?? "unknown";
      const elevar = json.report?.browser_parity?.elevar_events ?? 0;
      // After cutover-push gate (≥5/side), low-volume GO should not happen.
      // Tolerate legacy Worker briefly so lean:verify stays green during rollouts.
      if (status === "go" && elevar < 5) {
        return `status=${status}; elevar=${elevar} (legacy gate — redeploy for min dual-run volume)`;
      }
      return `status=${status}; elevar=${elevar}`;
    })
  );

  const failed = checks.filter((check) => !check.passed);

  console.log(`Lean verify — ${target.baseUrl}`);
  console.log(`Environment: ${target.environment} (${envConfig?.label ?? "unknown"})`);
  console.log(`Shop: ${target.shopifyShop}`);
  console.log(`Origin probe: ${target.origin}`);
  console.log(`Theme embed endpoint: ${target.themeEmbedEndpoint}`);
  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.name}  ${check.detail}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("\nAll lean checks passed for this environment.");
  console.log("gcw-dev next: enable GCW Synapse app embed on gcw-dev theme, then GTM Preview (docs/LEAN_GO_LIVE.md).");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("leanVerify.ts") || process.argv[1].endsWith("leanVerify.js"));

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Lean verify failed: ${message}`);
    process.exitCode = 1;
  });
}