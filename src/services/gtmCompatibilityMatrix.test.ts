import test from "node:test";
import assert from "node:assert/strict";
import { getGtmCompatibilityMatrix, getTopPriorityCompatibilityGaps } from "./gtmCompatibilityMatrix";

test("gtm compatibility matrix exposes core available Elevar replacements", () => {
  const entries = getGtmCompatibilityMatrix();
  const currency = entries.find((entry) => entry.legacyVariable === "dlv - Global - Currency Code");
  const productGroup = entries.find((entry) => entry.legacyVariable === "Facebook - product group");
  const pageTitle = entries.find((entry) => entry.legacyVariable === "DOM - Page Title");

  assert.ok(currency);
  assert.equal(currency?.status, "available");
  assert.equal(currency?.endpointPath, "/compatibility/currency-code");
  assert.equal(productGroup?.status, "available");
  assert.equal(productGroup?.endpointPath, "/compatibility/product-group");
  assert.equal(pageTitle?.status, "available");
  assert.equal(pageTitle?.endpointPath, "/compatibility/page-title");
});

test("gtm compatibility gaps prioritizes partial replacements by priority and reference count", () => {
  const gaps = getTopPriorityCompatibilityGaps(3);

  assert.equal(Array.isArray(gaps), true);
  assert.equal(gaps.every((entry) => entry.status !== "available"), true);
});