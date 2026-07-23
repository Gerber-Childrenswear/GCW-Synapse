import {
  emitAddToCart,
  emitBeginCheckout,
  emitLogin,
  emitRemoveFromCart,
  emitSelectItem,
  emitSignUp,
  emitSubscribe,
  emitUserData,
  emitViewCart
} from "./events";
import { toSynapseProduct } from "./product";
import type { SynapseConfig, SynapseProduct } from "./types";

function parseCartLine(line: Record<string, unknown>): SynapseProduct {
  const product = (line.product as Record<string, unknown> | undefined) || {};
  return toSynapseProduct({
    sku: typeof line.sku === "string" ? line.sku : undefined,
    name: String(line.product_title || product.title || line.title || ""),
    brand: typeof line.vendor === "string" ? line.vendor : undefined,
    category: typeof product.type === "string" ? product.type : undefined,
    variant: typeof line.variant_title === "string" ? line.variant_title : undefined,
    price: typeof line.final_price === "number" ? (line.final_price / 100).toFixed(2) : String(line.price ?? "0"),
    quantity: typeof line.quantity === "number" ? line.quantity : 1,
    productId: line.product_id as string | number | undefined,
    variantId: line.variant_id as string | number | undefined,
    compareAtPrice:
      typeof line.original_price === "number" ? (line.original_price / 100).toFixed(2) : "0.0",
    image: typeof line.image === "string" ? line.image : undefined,
    url: typeof line.url === "string" ? line.url : undefined
  });
}

function cartUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isCartMutateUrl(url: string): boolean {
  return /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/i.test(url);
}

/** Elevar-style cart_reconcile: refresh config.cart from /cart.js and re-push dl_user_data. */
async function reconcileCart(config: SynapseConfig): Promise<void> {
  try {
    const res = await fetch("/cart.js", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return;
    const body = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(body.items)
      ? (body.items as Array<Record<string, unknown>>).map(parseCartLine)
      : [];
    const total =
      typeof body.total_price === "number"
        ? (body.total_price / 100).toFixed(2)
        : String(body.total_price ?? config.cart?.total ?? "0.0");
    config.cart = {
      total,
      itemCount: typeof body.item_count === "number" ? body.item_count : items.length,
      items
    };
    emitUserData(config);
  } catch {
    // Cart API may be unavailable.
  }
}

export function attachObservers(config: SynapseConfig): void {
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = cartUrl(input);
      const watch = isCartMutateUrl(url);
      const response = await originalFetch(input, init);
      if (!watch || !response.ok) return response;

      try {
        if (/\/cart\/add(\.js)?/i.test(url)) {
          const body = (await response.clone().json()) as Record<string, unknown>;
          const items = Array.isArray(body.items)
            ? (body.items as Array<Record<string, unknown>>).map(parseCartLine)
            : [parseCartLine(body)];
          emitAddToCart(config, items);
          void reconcileCart(config);
          return response;
        }

        if (/\/cart\/(change|update|clear)(\.js)?/i.test(url)) {
          const body = (await response.clone().json()) as Record<string, unknown>;
          let requestQuantity: number | undefined;
          if (typeof init?.body === "string") {
            try {
              const parsed = JSON.parse(init.body) as { quantity?: number };
              if (typeof parsed.quantity === "number") requestQuantity = parsed.quantity;
            } catch {
              // ignore
            }
          } else if (/quantity=0/i.test(url)) {
            requestQuantity = 0;
          }

          let removed: SynapseProduct[] = [];
          if (Array.isArray(body.items_removed)) {
            removed = (body.items_removed as Array<Record<string, unknown>>).map(parseCartLine);
          } else if (requestQuantity === 0) {
            const prev = config.cart?.items ?? [];
            const nextIds = new Set(
              (Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : []).map(
                (line) => String(line.variant_id || line.key || line.id || "")
              )
            );
            removed = prev.filter((item) => {
              const id = String(item.variant_id || item.id || "");
              return Boolean(id) && !nextIds.has(id);
            });
            if (!removed.length && prev[0]) removed = [prev[0]];
          }

          if (removed.length) emitRemoveFromCart(config, removed);
          void reconcileCart(config);
        }
      } catch {
        // ignore parse errors
      }
      return response;
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    const proto = XMLHttpRequest.prototype;
    const open = proto.open;
    const send = proto.send;
    proto.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      (this as XMLHttpRequest & { __synapseCartUrl?: string }).__synapseCartUrl = String(url);
      return open.apply(this, [method, url, ...rest] as Parameters<typeof open>);
    };
    proto.send = function (...args: unknown[]) {
      const xhr = this as XMLHttpRequest & { __synapseCartUrl?: string };
      const url = xhr.__synapseCartUrl || "";
      if (isCartMutateUrl(url)) {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) void reconcileCart(config);
        });
      }
      return send.apply(this, args as Parameters<typeof send>);
    };
  }

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const action = (form.getAttribute("action") || "").toLowerCase();
      if (action.includes("/cart/add") && config.product) {
        const v = config.product.selectedVariant;
        emitAddToCart(config, [
          toSynapseProduct({
            sku: v.sku,
            name: config.product.title,
            brand: config.product.vendor,
            category: config.product.type,
            variant: v.title,
            price: v.price,
            quantity: 1,
            productId: config.product.id,
            variantId: v.id,
            compareAtPrice: v.compareAtPrice,
            image: v.image,
            url: config.product.url
          })
        ]);
        void reconcileCart(config);
      }

      if (action.includes("/account") || form.id?.toLowerCase().includes("create_customer")) {
        const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
        if (form.querySelector('[name="customer[password]"]') && emailInput) {
          if (action.includes("register") || form.innerHTML.includes("create_customer")) {
            emitSignUp(config);
          }
        }
      }

      if (action.includes("/account/login")) {
        emitLogin(config);
      }

      const email = form.querySelector<HTMLInputElement>(
        'input[type="email"][name*="email" i], input[name="contact[email]"]'
      );
      const phone = form.querySelector<HTMLInputElement>('input[type="tel"], input[name*="phone" i]');
      if (email && (action.includes("contact") || form.getAttribute("id")?.includes("newsletter"))) {
        emitSubscribe(config, "email", { email: email.value });
      }
      if (phone && form.getAttribute("id")?.toLowerCase().includes("sms")) {
        emitSubscribe(config, "phone", { phone: phone.value });
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (config.collection || config.search) {
        const link = target.closest("a[href*='/products/']") as HTMLAnchorElement | null;
        if (link) {
          const href = link.getAttribute("href") || "";
          const name = (link.getAttribute("aria-label") || link.textContent || "").trim() || href;
          const handleMatch = href.match(/\/products\/([^/?#]+)/);
          const fromList = [...(config.collection?.products || []), ...(config.search?.products || [])].find(
            (p) =>
              (handleMatch && (p.url || "").includes(handleMatch[1] || "")) ||
              (name && p.name && p.name.toLowerCase() === name.toLowerCase())
          );
          emitSelectItem(
            config,
            fromList ||
              toSynapseProduct({
                name,
                price: "0.0",
                productId: undefined,
                variantId: undefined,
                list: config.collection?.path || "search results"
              }),
            config.collection?.path || "search results"
          );
        }
      }

      if (target.closest('a[href*="/cart"], [href="/cart"]')) {
        emitViewCart(config);
      }

      if (target.closest('button[name="checkout"], [name="checkout"], form[action*="/checkout"]')) {
        emitBeginCheckout(config);
      }

      const remove = target.closest(
        'a[href*="/cart/change"][href*="quantity=0"], button[data-cart-remove], [data-remove]'
      );
      if (remove && config.cart?.items?.[0]) {
        emitRemoveFromCart(config, [config.cart.items[0]]);
        void reconcileCart(config);
      }
    },
    true
  );

  window.addEventListener("synapse:subscribe", ((event: CustomEvent) => {
    const detail = event.detail || {};
    if (detail.email) emitSubscribe(config, "email", { email: detail.email });
    if (detail.phone) emitSubscribe(config, "phone", { phone: detail.phone });
  }) as EventListener);
}
