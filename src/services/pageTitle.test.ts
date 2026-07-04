import test from "node:test";
import assert from "node:assert/strict";
import { resolvePageTitle } from "./pageTitle";

test("page title resolver uses direct page title when present", () => {
  const result = resolvePageTitle({ pageTitle: "Product Detail" });

  assert.equal(result.pageTitle, "Product Detail");
  assert.equal(result.source, "page_title");
});

test("page title resolver derives title from page URL path", () => {
  const result = resolvePageTitle({ pageUrl: "https://gcw.com/collections/sale-items" });

  assert.equal(result.pageTitle, "Collections Sale Items");
  assert.equal(result.source, "page_url");
});

test("page title resolver returns fallback for empty input", () => {
  const result = resolvePageTitle({});

  assert.equal(result.pageTitle, "Untitled Page");
  assert.equal(result.source, "fallback");
});
