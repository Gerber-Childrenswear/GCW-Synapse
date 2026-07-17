import test from "node:test";
import assert from "node:assert/strict";
import { resolvePageTitle } from "./pageTitle";

test("resolvePageTitle prefers title", () => {
  assert.equal(
    resolvePageTitle({
      title: " Product Page ",
      documentTitle: "Document",
      fallback: "Fallback"
    }),
    "Product Page"
  );
});

test("resolvePageTitle falls back to documentTitle then fallback", () => {
  assert.equal(resolvePageTitle({ documentTitle: " Doc Title " }), "Doc Title");
  assert.equal(resolvePageTitle({ fallback: " Home " }), "Home");
  assert.equal(resolvePageTitle({}), "");
});
