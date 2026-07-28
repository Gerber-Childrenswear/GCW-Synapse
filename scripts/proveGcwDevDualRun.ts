/**
 * Prove gcw-dev dual-run with a real browser (Playwright).
 *
 * Unlocks the password storefront, drives PDP → ATC → cart, captures Synapse
 * (+ Elevar-mirror) beacon traffic, then polls /launch/readiness.
 * Does NOT use demo-seed / simulate synthetic event ids.
 *
 *   GCW_DEV_STOREFRONT_PASSWORD='…' ADMIN_UI_PASSWORD='…' npm run prove:dual-run:dev
 *   npm run prove:dual-run:dev -- --password '…' --token '…' --rounds 5
 */

import { chromium, type Page, type Response as PwResponse } from "playwright";
import { resolveAdminToken } from "./leanVerify";

type Args = {
  shopOrigin: string;
  workerBase: string;
  password: string;
  token: string;
  productHandle?: string;
  rounds: number;
  headless: boolean;
};

type BeaconHit = {
  source: string;
  event: string;
  event_id?: string;
  synthetic?: boolean;
  status: number;
};

function parseArgs(argv: string[]): Args {
  const get = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    if (idx < 0) return undefined;
    const value = argv[idx + 1];
    return value && !value.startsWith("--") ? value : undefined;
  };
  const password =
    get("password")?.trim() ||
    process.env.GCW_DEV_STOREFRONT_PASSWORD?.trim() ||
    process.env.STOREFRONT_PASSWORD?.trim() ||
    "";
  if (!password) {
    throw new Error(
      "Missing storefront password. Pass --password or set GCW_DEV_STOREFRONT_PASSWORD."
    );
  }
  return {
    shopOrigin: (get("origin") ?? "https://gcw-dev.myshopify.com").replace(/\/$/, ""),
    workerBase: (get("base_url") ?? "https://gcw-synapse-super.gcwsynapse.workers.dev").replace(
      /\/$/,
      ""
    ),
    password,
    token: resolveAdminToken(get("token")),
    productHandle: get("product"),
    rounds: Math.max(1, Number.parseInt(get("rounds") ?? "5", 10) || 5),
    headless: !argv.includes("--headed")
  };
}

function parseSetCookie(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(/,(?=\s*[^;]+=)/)
    .map((part) => part.split(";")[0]?.trim() ?? "")
    .filter(Boolean);
}

async function unlockCookies(origin: string, password: string): Promise<Array<{ name: string; value: string }>> {
  const jar: string[] = [];
  const remember = (response: Response) => {
    const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies =
      typeof anyHeaders.getSetCookie === "function"
        ? anyHeaders.getSetCookie().map((c) => c.split(";")[0] ?? "")
        : parseSetCookie(response.headers.get("set-cookie"));
    for (const cookie of cookies) {
      if (!cookie) continue;
      const key = cookie.split("=")[0];
      const idx = jar.findIndex((row) => row.startsWith(`${key}=`));
      if (idx >= 0) jar[idx] = cookie;
      else jar.push(cookie);
    }
  };
  const cookieHeader = () => jar.join("; ");

  const passwordPage = await fetch(`${origin}/password`, {
    headers: { Cookie: cookieHeader(), "User-Agent": "GCW-Synapse-Prove/1.0" },
    redirect: "manual"
  });
  remember(passwordPage);

  const unlock = await fetch(`${origin}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Referer: `${origin}/password`,
      Cookie: cookieHeader(),
      "User-Agent": "GCW-Synapse-Prove/1.0"
    },
    body: new URLSearchParams({
      form_type: "storefront_password",
      utf8: "✓",
      password
    }),
    redirect: "manual"
  });
  remember(unlock);

  if (unlock.status !== 302 && unlock.status !== 200) {
    throw new Error(`Unlock failed HTTP ${unlock.status}`);
  }
  const location = unlock.headers.get("location") || "";
  if (unlock.status === 302 && location.includes("/password")) {
    throw new Error("Unlock rejected — password incorrect or captcha required");
  }

  const home = await fetch(`${origin}/`, {
    headers: { Cookie: cookieHeader(), "User-Agent": "GCW-Synapse-Prove/1.0" },
    redirect: "manual"
  });
  remember(home);
  if (home.status === 302 && (home.headers.get("location") || "").includes("/password")) {
    throw new Error("Still gated after unlock — cookie not accepted");
  }

  return jar.map((row) => {
    const eq = row.indexOf("=");
    return { name: row.slice(0, eq), value: row.slice(eq + 1) };
  });
}

async function unlockViaBrowser(
  page: Page,
  origin: string,
  password: string
): Promise<void> {
  const cookies = await unlockCookies(origin, password);
  await page.context().addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: origin
    }))
  );
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (page.url().includes("/password")) {
    throw new Error("Storefront still password-gated after cookie unlock");
  }
}

async function resolveProductHandle(page: Page, origin: string, preferred?: string): Promise<string> {
  if (preferred) return preferred;

  // products.json is authoritative — theme HTML often links prod-store handles that 404 on gcw-dev.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const json = await page.evaluate(async (shopOrigin) => {
        const res = await fetch(`${shopOrigin}/products.json?limit=5`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        });
        if (!res.ok) throw new Error(`products.json HTTP ${res.status}`);
        return (await res.json()) as { products?: Array<{ handle?: string }> };
      }, origin);
      const handle = json.products?.find((p) => p.handle)?.handle;
      if (handle) return handle;
    } catch {
      if (attempt === 4) break;
      await page.waitForTimeout(2500 * (attempt + 1));
    }
  }

  const fromHtml = await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/products/']")].map(
      (a) => a.getAttribute("href") || ""
    );
    for (const href of hrefs) {
      const match = href.match(/\/products\/([a-z0-9\-]+)/i);
      if (match?.[1]) return match[1];
    }
    return "";
  });
  if (fromHtml) return fromHtml;
  throw new Error("No products found on storefront");
}

function attachBeaconSniffer(page: Page, hits: BeaconHit[]): void {
  page.on("response", async (response: PwResponse) => {
    try {
      const url = response.url();
      if (!url.includes("/browser/beacon")) return;
      const req = response.request();
      if (req.method() !== "POST") return;
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(req.postData() || "{}") as Record<string, unknown>;
      } catch {
        body = {};
      }
      hits.push({
        source: typeof body.source === "string" ? body.source : "unknown",
        event: typeof body.event === "string" ? body.event : "unknown",
        event_id: typeof body.event_id === "string" ? body.event_id : undefined,
        synthetic: body.synthetic === true,
        status: response.status()
      });
    } catch {
      // ignore sniff errors
    }
  });
}

async function driveFunnel(page: Page, origin: string, handle: string): Promise<void> {
  const pdp = `${origin}/products/${handle}`;
  await page.goto(pdp, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(
    () =>
      Boolean((window as unknown as { SynapseConfig?: unknown }).SynapseConfig) ||
      Boolean((window as unknown as { Synapse?: unknown }).Synapse),
    null,
    { timeout: 30_000 }
  ).catch(() => null);
  // Let boot events (dl_user_data / dl_view_item) flush.
  await page.waitForTimeout(2500);

  const addBtn = page
    .locator(
      'form[action*="/cart/add"] button[type="submit"], button[name="add"], [data-add-to-cart], button:has-text("Add to cart"), button:has-text("Add to Cart")'
    )
    .first();
  if (await addBtn.count()) {
    await addBtn.click({ timeout: 10_000 }).catch(() => null);
    await page.waitForTimeout(2000);
  } else {
    // Fallback Ajax ATC using product.js
    try {
      await page.evaluate(async (productHandle) => {
        const res = await fetch(`/products/${productHandle}.js`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        });
        if (!res.ok) throw new Error(`product.js ${res.status}`);
        const product = (await res.json()) as { variants?: Array<{ id?: number }> };
        const id = product.variants?.[0]?.id;
        if (!id) throw new Error("no variant");
        const atc = await fetch("/cart/add.js", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          },
          body: new URLSearchParams({ id: String(id), quantity: "1" })
        });
        if (!atc.ok) throw new Error(`cart/add.js ${atc.status}`);
      }, handle);
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log(
        `WARN  ATC fallback failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  await page.goto(`${origin}/cart`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000);

  const checkout = page
    .locator('button[name="checkout"], [name="checkout"], form[action*="/checkout"] button, button:has-text("Check out"), button:has-text("Checkout")')
    .first();
  if (await checkout.count()) {
    await checkout.click({ timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(2500);
  }
}

async function getJson(url: string, token: string, attempts = 8): Promise<Record<string, unknown>> {
  let lastError = "unknown";
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(url, {
      headers: {
        "X-Synapse-Token": token,
        Authorization: `Basic ${Buffer.from(`admin:${token}`).toString("base64")}`,
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 GCW-Synapse-Prove/1.0"
      }
    });
    const text = await response.text();
    if (response.ok) {
      return JSON.parse(text) as Record<string, unknown>;
    }
    lastError = `${url} HTTP ${response.status}: ${text.slice(0, 160)}`;
    // Deploy rollout can flap 401 across isolates until all have ADMIN_UI_PASSWORD.
    if (response.status === 401 || response.status === 403) {
      await new Promise((r) => setTimeout(r, 1500 + i * 500));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

function summarizeHits(hits: BeaconHit[]): {
  total: number;
  synapse: number;
  elevar: number;
  synthetic: number;
  byEvent: Record<string, number>;
} {
  const byEvent: Record<string, number> = {};
  let synapse = 0;
  let elevar = 0;
  let synthetic = 0;
  for (const hit of hits) {
    byEvent[hit.event] = (byEvent[hit.event] ?? 0) + 1;
    const src = hit.source.toLowerCase();
    if (src.includes("elevar")) elevar += 1;
    else synapse += 1;
    if (hit.synthetic || /^(demo_|sim_)/i.test(hit.event_id ?? "")) synthetic += 1;
  }
  return { total: hits.length, synapse, elevar, synthetic, byEvent };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Prove gcw-dev dual-run — ${args.shopOrigin} → ${args.workerBase}`);
  console.log(`rounds=${args.rounds} headless=${args.headless}`);

  const before = await getJson(`${args.workerBase}/launch/readiness`, args.token);
  const beforeReport = (before.report ?? {}) as Record<string, unknown>;
  console.log(`launch before: ${String(beforeReport.status)}`);

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 GCW-Synapse-Prove/1.0"
  });
  const page = await context.newPage();
  const hits: BeaconHit[] = [];
  attachBeaconSniffer(page, hits);

  try {
    await unlockViaBrowser(page, args.shopOrigin, args.password);
    console.log("PASS  unlock");

    const handle = await resolveProductHandle(page, args.shopOrigin, args.productHandle);
    console.log(`product  ${handle}`);

    for (let round = 1; round <= args.rounds; round += 1) {
      console.log(`— funnel round ${round}/${args.rounds}`);
      await driveFunnel(page, args.shopOrigin, handle);
    }
  } finally {
    await browser.close();
  }

  const summary = summarizeHits(hits);
  console.log(
    `beacons captured: total=${summary.total} synapse=${summary.synapse} elevar=${summary.elevar} synthetic=${summary.synthetic}`
  );
  console.log(`by_event ${JSON.stringify(summary.byEvent)}`);

  // Give Worker a moment to persist browser events to Cache/KV.
  await new Promise((r) => setTimeout(r, 2000));

  const browserParity = await getJson(`${args.workerBase}/compare/browser?limit=30`, args.token);
  const parity = (browserParity.parity ?? {}) as Record<string, unknown>;
  console.log(
    `compare/browser: synapse=${parity.synapse_events} elevar=${parity.elevar_events} status=${parity.status}`
  );

  const after = await getJson(`${args.workerBase}/launch/readiness`, args.token);
  const afterReport = (after.report ?? {}) as Record<string, unknown>;
  const checks = (afterReport.checks as Array<{ id: string; status: string; detail: string }> | undefined) ?? [];
  console.log(`launch after: ${String(afterReport.status)}`);
  for (const check of checks) {
    console.log(`  ${check.status.padEnd(7)} ${check.id}  ${check.detail}`);
  }

  const realBeacons = summary.total - summary.synthetic;
  if (realBeacons < 1) {
    console.error("FAIL  no real (non-synthetic) storefront beacons observed");
    process.exitCode = 1;
    return;
  }
  if (summary.synapse < 1) {
    console.error("FAIL  no Synapse beacons from storefront");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("PASS  real storefront Synapse beacons observed");
  if (summary.elevar < 1) {
    console.log(
      "WARN  no Elevar-mirror beacons in this run — confirm Elevar embed is ON and pushes dl_* events (Synapse mirrors them)."
    );
  } else {
    console.log("PASS  Elevar-mirror beacons observed (dual-run path)");
  }
  if (String(afterReport.status) === "go") {
    console.log("PASS  launch readiness GO (real volume)");
  } else {
    console.log(
      `INFO  launch is ${String(afterReport.status)} — need ≥5 real events/side; re-run with --rounds 5+ or browse more.`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
