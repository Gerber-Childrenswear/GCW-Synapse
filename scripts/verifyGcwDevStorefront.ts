/**
 * Unlock password-protected gcw-dev and verify Synapse + Elevar embeds on a PDP.
 * Does not execute browser JS (no Playwright) — confirms HTML wiring after unlock.
 *
 *   GCW_DEV_STOREFRONT_PASSWORD='…' npm run verify:storefront:dev
 *   npm run verify:storefront:dev -- --password '…'
 */

type Args = {
  shopOrigin: string;
  password: string;
  productHandle?: string;
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
    password,
    productHandle: get("product")
  };
}

function parseSetCookie(header: string | null): string[] {
  if (!header) return [];
  // undici may join multiple Set-Cookie with comma — prefer getSetCookie when available.
  return header.split(/,(?=\s*[^;]+=)/).map((part) => part.split(";")[0]?.trim() ?? "").filter(Boolean);
}

async function unlockStorefront(origin: string, password: string): Promise<string> {
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
    headers: { Cookie: cookieHeader() },
    redirect: "manual"
  });
  remember(passwordPage);

  const unlock = await fetch(`${origin}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Referer: `${origin}/password`,
      Cookie: cookieHeader()
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
    headers: { Cookie: cookieHeader() },
    redirect: "manual"
  });
  remember(home);
  if (home.status === 302 && (home.headers.get("location") || "").includes("/password")) {
    throw new Error("Still gated after unlock — cookie not accepted");
  }
  if (!home.ok) {
    throw new Error(`Home after unlock HTTP ${home.status}`);
  }
  return cookieHeader();
}

async function resolveProductHandle(origin: string, cookie: string, preferred?: string): Promise<string> {
  if (preferred) return preferred;
  const response = await fetch(`${origin}/products.json?limit=5`, {
    headers: { Cookie: cookie, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`products.json HTTP ${response.status}`);
  const json = (await response.json()) as { products?: Array<{ handle?: string }> };
  const handle = json.products?.find((p) => p.handle)?.handle;
  if (!handle) throw new Error("No products found on storefront");
  return handle;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Verify gcw-dev storefront — ${args.shopOrigin}`);

  const cookie = await unlockStorefront(args.shopOrigin, args.password);
  console.log("PASS  unlock  storefront password accepted");

  const handle = await resolveProductHandle(args.shopOrigin, cookie, args.productHandle);
  const pdpUrl = `${args.shopOrigin}/products/${handle}`;
  const pdp = await fetch(pdpUrl, { headers: { Cookie: cookie } });
  if (!pdp.ok) throw new Error(`PDP HTTP ${pdp.status}`);
  const html = await pdp.text();

  const hasSynapseConfig = html.includes("window.SynapseConfig") || html.includes("SynapseConfig");
  const hasBeacon =
    html.includes("browser/beacon") ||
    html.includes("browser\\/beacon") ||
    html.includes("gcw-synapse-super.gcwsynapse.workers.dev");
  const hasCdn =
    html.includes("gcw-synapse.js") || html.includes("gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse");
  const hasElevar =
    html.toLowerCase().includes("elevar") || html.includes("shopify-gtm-suite.getelevar.com");
  const hasWebPixel =
    html.includes("1947992257") ||
    html.includes("beaconUrl") && html.includes("gcw-synapse-super");

  console.log(`${hasSynapseConfig ? "PASS" : "FAIL"}  synapse_config  on ${handle}`);
  console.log(`${hasBeacon ? "PASS" : "FAIL"}  synapse_beacon_url`);
  console.log(`${hasCdn ? "PASS" : "FAIL"}  synapse_cdn_script`);
  console.log(`${hasElevar ? "PASS" : "FAIL"}  elevar_present  (needed for dual-run)`);
  console.log(`${hasWebPixel ? "PASS" : "FAIL"}  synapse_web_pixel_boot`);

  // Soft ATC via Ajax API (confirms session works beyond password page)
  const products = await fetch(`${args.shopOrigin}/products/${handle}.js`, {
    headers: { Cookie: cookie, Accept: "application/json" }
  });
  let atcOk = false;
  if (products.ok) {
    const product = (await products.json()) as { variants?: Array<{ id?: number }> };
    const variantId = product.variants?.[0]?.id;
    if (variantId) {
      const atc = await fetch(`${args.shopOrigin}/cart/add.js`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: new URLSearchParams({
          id: String(variantId),
          quantity: "1"
        })
      });
      atcOk = atc.ok;
      const atcBody = (await atc.text()).slice(0, 120);
      console.log(
        `${atcOk ? "PASS" : "FAIL"}  cart_add  variant=${variantId} HTTP ${atc.status}${atcOk ? "" : ` ${atcBody}`}`
      );    }
  } else {
    console.log(`FAIL  product_js  HTTP ${products.status}`);
  }

  const failed = [hasSynapseConfig, hasBeacon, hasCdn, hasElevar, atcOk].filter((v) => !v).length;
  console.log("");
  if (failed > 0) {
    console.log(`Storefront verify incomplete (${failed} failures).`);
    process.exitCode = 1;
    return;
  }
  console.log("Storefront unlock + embed wiring OK.");
  console.log("Note: curl cannot execute theme JS — dual-run beacons still need a real browser or simulate:dual-run:dev.");
  console.log(`PDP checked: ${pdpUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
