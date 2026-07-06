import { readFileSync } from "node:fs";
import path from "node:path";

type LeanConfig = {
  productionBaseUrl: string;
  storefrontOrigins: string[];
  criticalRuntimeEvents: string[];
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

export function buildSampleEvent(eventName: string, origin: string): Record<string, unknown> {
  return {
    event_name: eventName,
    source: "theme",
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
  const baseUrl = (args.get("base_url") ?? config.productionBaseUrl).replace(/\/$/, "");
  const origin = args.get("origin") ?? config.storefrontOrigins[0] ?? "https://www.gerberchildrenswear.com";
  const token = args.get("token") ?? process.env.SYNAPSE_INGRESS_TOKEN ?? process.env.INGRESS_SHARED_TOKEN;

  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("health", async () => {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      return body;
    })
  );

  for (const eventName of config.criticalRuntimeEvents) {
    checks.push(
      await runCheck(`event:${eventName}`, async () => {
        const response = await fetch(`${baseUrl}/event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin
          },
          body: JSON.stringify(buildSampleEvent(eventName, origin))
        });
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return body;
      })
    );
  }

  if (token) {
    checks.push(
      await runCheck("launch_readiness", async () => {
        const response = await fetch(`${baseUrl}/launch/readiness`, {
          headers: {
            "X-Synapse-Token": token
          }
        });
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return body.slice(0, 240);
      })
    );
  }

  const failed = checks.filter((check) => !check.passed);

  console.log(`Lean verify — ${baseUrl}`);
  console.log(`Origin probe: ${origin}`);
  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.name}  ${check.detail}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("\nAll lean checks passed. Next: enable Shopify theme embed + import GTM runtime bridge (see docs/LEAN_GO_LIVE.md).");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Lean verify failed: ${message}`);
  process.exitCode = 1;
});
