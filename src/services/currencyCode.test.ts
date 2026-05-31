import test from "node:test";
import assert from "node:assert/strict";
import { resolveCurrencyCode } from "./currencyCode";

test("resolveCurrencyCode prefers ecommerce currency", () => {
  const resolved = resolveCurrencyCode(
    {
      ecommerceCurrency: "usd",
      checkoutCurrencyCode: "cad",
      shopCurrency: "eur"
    },
    "gbp"
  );

  assert.equal(resolved, "USD");
});

test("resolveCurrencyCode falls back in expected order", () => {
  const fromCheckout = resolveCurrencyCode(
    {
      ecommerceCurrency: "",
      checkoutCurrencyCode: "cad",
      shopCurrency: "eur"
    },
    "gbp"
  );
  assert.equal(fromCheckout, "CAD");

  const fromShop = resolveCurrencyCode(
    {
      ecommerceCurrency: "invalid",
      checkoutCurrencyCode: "",
      shopCurrency: "eur"
    },
    "gbp"
  );
  assert.equal(fromShop, "EUR");

  const fromFallback = resolveCurrencyCode(
    {
      ecommerceCurrency: "invalid",
      checkoutCurrencyCode: "",
      shopCurrency: ""
    },
    "gbp"
  );
  assert.equal(fromFallback, "GBP");
});
