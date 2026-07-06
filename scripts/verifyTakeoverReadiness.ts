import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type GateResponse = {
  ok: boolean;
  generated_at: string;
  report: {
    status: "go" | "hold";
    readinessScorePct: number;
    summary: {
      checksPassed: number;
      checksFailed: number;
    };
  };
};

type VerificationCheck = {
  name: string;
  status: "pass" | "fail";
  details: string;
};

type VerificationReport = {
  generated_at: string;
  base_url: string;
  gate: {
    status: "go" | "hold";
    readinessScorePct: number;
    checksPassed: number;
    checksFailed: number;
  };
  summary: {
    checksPassed: number;
    checksFailed: number;
    status: "pass" | "fail";
  };
  checks: VerificationCheck[];
};

function parseArgMap(argv: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      map[key] = "true";
      continue;
    }

    map[key] = value;
    index += 1;
  }

  return map;
}

function stamp(date = new Date()): string {
  return date.toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "");
}

function assertCondition(condition: boolean, message: string): { ok: true } {
  if (!condition) {
    throw new Error(message);
  }

  return { ok: true };
}

async function fetchJson(endpoint: string, token: string): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Synapse-Token": token
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}) for ${endpoint}: ${body}`);
  }

  return response.json();
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.base_url ?? process.env.SYNAPSE_BASE_URL ?? "http://127.0.0.1:3000");
  const ingressToken = args.token ?? process.env.SYNAPSE_INGRESS_TOKEN ?? process.env.INGRESS_SHARED_TOKEN;

  if (!ingressToken) {
    throw new Error(
      "Missing ingress token. Set SYNAPSE_INGRESS_TOKEN (or INGRESS_SHARED_TOKEN), or pass --token <value>."
    );
  }

  const failOnHold = args.fail_on_hold === "true";
  const failOnContractDrift = args.fail_on_contract_drift === "true";
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");

  const checks: VerificationCheck[] = [];

  const pushCheck = async (name: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
      checks.push({ name, status: "pass", details: "ok" });
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown failure";
      checks.push({ name, status: "fail", details });
    }
  };

  const gatePayload = (await fetchJson(`${baseUrl}/api/gtm/go-live-gate`, ingressToken)) as GateResponse;
  if (!gatePayload.ok) {
    throw new Error("go-live gate endpoint returned ok=false");
  }

  const lineItems = encodeURIComponent(
    JSON.stringify([
      {
        sku: "SKU-123",
        product_id: 101,
        variant_id: 202,
        variant_title: "Blue / M",
        product_type: "Onesies",
        title: "Footie",
        price: "25.00",
        quantity: 2
      }
    ])
  );

  await pushCheck("compatibility:add-to-cart contract", async () => {
    const payload = (await fetchJson(`${baseUrl}/compatibility/add-to-cart?line_items_json=${lineItems}`, ingressToken)) as {
      ok?: boolean;
      resolved?: Record<string, unknown>;
    };

    assertCondition(payload.ok === true, "add-to-cart returned ok=false");
    const resolved = payload.resolved ?? {};
    assertCondition(Array.isArray(resolved.add_array), "missing add_array");
    assertCondition(typeof resolved.value === "number", "missing numeric value");
    assertCondition(Array.isArray(resolved.facebook_contents), "missing facebook_contents");
    assertCondition(Array.isArray(resolved.ga4_items), "missing ga4_items");
    assertCondition(Array.isArray(resolved.tiktok_contents), "missing tiktok_contents");
  });

  await pushCheck("compatibility:purchase-products contract", async () => {
    const payload = (await fetchJson(
      `${baseUrl}/compatibility/purchase-products?line_items_json=${lineItems}`,
      ingressToken
    )) as {
      ok?: boolean;
      count?: unknown;
      resolved_purchase_products?: unknown;
    };

    assertCondition(payload.ok === true, "purchase-products returned ok=false");
    assertCondition(typeof payload.count === "number" && payload.count >= 1, "purchase-products count missing/invalid");
    assertCondition(Array.isArray(payload.resolved_purchase_products), "missing resolved_purchase_products");
  });

  await pushCheck("compatibility:product-group contract", async () => {
    const payload = (await fetchJson(`${baseUrl}/compatibility/product-group?line_items_json=${lineItems}`, ingressToken)) as {
      ok?: boolean;
      resolved_product_group?: unknown;
    };

    assertCondition(payload.ok === true, "product-group returned ok=false");
    assertCondition(typeof payload.resolved_product_group === "string", "missing resolved_product_group");
  });

  await pushCheck("compatibility:page-title contract", async () => {
    const payload = (await fetchJson(
      `${baseUrl}/compatibility/page-title?page_url=${encodeURIComponent("https://example.com/products/footie")}`,
      ingressToken
    )) as {
      ok?: boolean;
      resolved_page_title?: unknown;
    };

    assertCondition(payload.ok === true, "page-title returned ok=false");
    assertCondition(typeof payload.resolved_page_title === "string", "missing resolved_page_title");
  });

  await pushCheck("compatibility:drilldown availability", async () => {
    const payload = (await fetchJson(`${baseUrl}/api/gtm/compatibility-drilldown?limit=5`, ingressToken)) as {
      ok?: boolean;
      helpers?: unknown;
    };

    assertCondition(payload.ok === true, "drilldown returned ok=false");
    assertCondition(Array.isArray(payload.helpers), "drilldown helpers missing");
  });

  const checksPassed = checks.filter((check) => check.status === "pass").length;
  const checksFailed = checks.length - checksPassed;

  const report: VerificationReport = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    gate: {
      status: gatePayload.report.status,
      readinessScorePct: gatePayload.report.readinessScorePct,
      checksPassed: gatePayload.report.summary.checksPassed,
      checksFailed: gatePayload.report.summary.checksFailed
    },
    summary: {
      checksPassed,
      checksFailed,
      status: checksFailed === 0 ? "pass" : "fail"
    },
    checks
  };

  await mkdir(outDir, { recursive: true });
  const ts = stamp();
  const reportPath = path.resolve(outDir, `takeover-verify-${ts}.json`);
  const latestPath = path.resolve(outDir, "takeover-verify-latest.json");

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(latestPath, JSON.stringify(report, null, 2), "utf8");

  console.log("Takeover verification report generated:");
  console.log(`- Report: ${reportPath}`);
  console.log(`- Latest: ${latestPath}`);
  console.log(`- Gate Status: ${report.gate.status.toUpperCase()}`);
  console.log(`- Contract Checks: ${report.summary.checksPassed} pass / ${report.summary.checksFailed} fail`);

  if (failOnHold && report.gate.status === "hold") {
    throw new Error("Takeover verification failed because go-live gate status is HOLD.");
  }

  if (failOnContractDrift && report.summary.status === "fail") {
    throw new Error("Takeover verification failed because one or more endpoint contract checks failed.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to verify takeover readiness: ${message}`);
  process.exitCode = 1;
});
