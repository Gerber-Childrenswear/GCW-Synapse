/**
 * Simulate gcw-dev dual-run browse funnel (#1 from cutover checklist).
 *
 * Posts Synapse + Elevar-mirror beacons for the core funnel, then prints
 * /compare/browser and /launch/readiness. Does not replace real storefront
 * browsing + GTM Preview — use this as a wiring smoke test.
 *
 *   npm run simulate:dual-run:dev
 *   npm run simulate:dual-run:dev -- --seed-platforms
 */

import { resolveAdminToken } from "./leanVerify";

type Args = {
  baseUrl: string;
  shop: string;
  origin: string;
  token: string;
  rounds: number;
  seedPlatforms: boolean;
};

const CORE_FUNNEL = [
  "dl_user_data",
  "dl_view_item",
  "dl_add_to_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_purchase"
] as const;

function parseArgs(argv: string[]): Args {
  const get = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    if (idx < 0) return undefined;
    const value = argv[idx + 1];
    return value && !value.startsWith("--") ? value : undefined;
  };

  return {
    baseUrl: (get("base_url") ?? "https://gcw-synapse-super.gcwsynapse.workers.dev").replace(/\/$/, ""),
    shop: get("shop") ?? "gcw-dev.myshopify.com",
    origin: get("origin") ?? "https://gcw-dev.myshopify.com",
    token: resolveAdminToken(get("token")),
    rounds: Math.max(1, Number.parseInt(get("rounds") ?? "5", 10) || 5),
    seedPlatforms: argv.includes("--seed-platforms")
  };
}

function authHeaders(token: string, origin: string, contentType = true): HeadersInit {
  const headers: Record<string, string> = {
    Origin: origin,
    "X-Synapse-Token": token
  };
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}

function beaconBody(
  source: "synapse" | "elevar-datalayer",
  event: string,
  shop: string,
  round: number
): Record<string, unknown> {
  const needsCart = event !== "dl_view_item" && event !== "dl_user_data";
  return {
    source,
    shop,
    event,
    event_id: `sim_${source === "synapse" ? "syn" : "elv"}_${event}_${round}_${Date.now()}`,
    currency: "USD",
    cart_total: needsCart ? "42.50" : undefined,
    ecommerce: {
      currencyCode: "USD",
      currency: "USD",
      detail:
        event === "dl_view_item"
          ? {
              products: [
                {
                  id: "sim-sku-1",
                  name: "Sim Onesie",
                  product_id: "9001",
                  variant_id: "9001-1",
                  price: "29.99",
                  quantity: "1"
                }
              ]
            }
          : undefined,
      add:
        event === "dl_add_to_cart"
          ? {
              products: [
                {
                  id: "sim-sku-1",
                  product_id: "9001",
                  variant_id: "9001-1",
                  price: "29.99",
                  quantity: "1"
                }
              ]
            }
          : undefined,
      purchase:
        event === "dl_purchase"
          ? {
              actionField: { id: `SIM-${1000 + round}`, revenue: "42.50" },
              products: [
                {
                  id: "sim-sku-1",
                  product_id: "9001",
                  variant_id: "9001-1",
                  price: "29.99",
                  quantity: "1"
                }
              ]
            }
          : undefined
    },
    marketing: {
      session_id: `sim_sess_${round}`,
      landing_site: "https://gcw-dev.myshopify.com/?utm_source=sim",
      utm_source: "sim"
    },
    observed_at: new Date().toISOString()
  };
}

async function postBeacon(
  baseUrl: string,
  origin: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; detail: string }> {
  const response = await fetch(`${baseUrl}/browser/beacon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return { ok: response.ok || response.status === 202, status: response.status, detail: text.slice(0, 160) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const headers = authHeaders(args.token, args.origin);

  console.log(`Simulate gcw-dev dual-run — ${args.baseUrl}`);
  console.log(`Shop: ${args.shop}`);
  console.log(`Origin: ${args.origin}`);
  console.log(`Rounds: ${args.rounds} × ${CORE_FUNNEL.length} events × 2 sources`);
  console.log("");

  if (args.seedPlatforms) {
    const seed = await fetch(`${args.baseUrl}/compare/demo-seed?scenario=healthy&browser=0`, {
      method: "POST",
      headers
    });
    const seedBody = await seed.text();
    console.log(`${seed.ok || seed.status === 202 ? "PASS" : "FAIL"}  demo-seed(platforms)  ${seedBody.slice(0, 140)}`);
  }

  let accepted = 0;
  let failed = 0;

  for (let round = 1; round <= args.rounds; round += 1) {
    for (const event of CORE_FUNNEL) {
      for (const source of ["synapse", "elevar-datalayer"] as const) {
        const result = await postBeacon(
          args.baseUrl,
          args.origin,
          beaconBody(source, event, args.shop, round)
        );
        if (result.ok) {
          accepted += 1;
          console.log(`PASS  beacon ${source} ${event} r${round}  HTTP ${result.status}`);
        } else {
          failed += 1;
          console.log(`FAIL  beacon ${source} ${event} r${round}  HTTP ${result.status} ${result.detail}`);
        }
      }
    }
  }

  console.log("");
  console.log(`Beacons accepted=${accepted} failed=${failed}`);

  const browser = await fetch(`${args.baseUrl}/compare/browser`, { headers });
  const browserJson = (await browser.json()) as {
    ok?: boolean;
    parity?: {
      synapse_events?: number;
      elevar_events?: number;
      volume_match_pct?: number;
      matched_rate_pct?: number;
      fuzzy_paired?: number;
      by_event?: Array<{ event: string; synapse: number; elevar: number }>;
    };
  };
  const parity = browserJson.parity ?? {};
  console.log(
    `${browser.ok ? "PASS" : "FAIL"}  compare/browser  syn=${parity.synapse_events ?? 0} elv=${parity.elevar_events ?? 0} volume=${parity.volume_match_pct ?? parity.matched_rate_pct ?? "?"} fuzzy=${parity.fuzzy_paired ?? 0}`
  );
  for (const row of parity.by_event ?? []) {
    if (CORE_FUNNEL.includes(row.event as (typeof CORE_FUNNEL)[number])) {
      console.log(`       ${row.event}: synapse=${row.synapse} elevar=${row.elevar}`);
    }
  }

  const launch = await fetch(`${args.baseUrl}/launch/readiness`, { headers });
  const launchJson = (await launch.json()) as {
    ok?: boolean;
    report?: { status?: string; checks?: Array<{ id: string; status: string; detail: string }> };
  };
  const report = launchJson.report ?? {};
  console.log(`${launch.ok ? "PASS" : "FAIL"}  launch/readiness  status=${report.status ?? "?"}`);
  for (const check of report.checks ?? []) {
    console.log(`       ${check.id}: ${check.status} — ${check.detail}`);
  }

  console.log("");
  if (failed > 0) {
    console.log("Simulation incomplete — beacon posts failed.");
    process.exitCode = 1;
    return;
  }
  if ((parity.synapse_events ?? 0) < args.rounds || (parity.elevar_events ?? 0) < args.rounds) {
    console.log("Simulation weak — expected both sides to grow. Check CORS / dual-run flags.");
    process.exitCode = 1;
    return;
  }

  console.log("Dual-run simulation OK (wiring smoke).");
  console.log("Still required for real #1 sign-off: password-unlocked gcw-dev browse + GTM Preview.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
