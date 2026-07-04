import test from "node:test";
import assert from "node:assert/strict";
import { buildCompatibilityFailureDiagnostics } from "./compatibilityDiagnostics";

test("compatibility diagnostics prioritizes partial placeholders and erroring endpoints", () => {
  const diagnostics = buildCompatibilityFailureDiagnostics({
    matrix: [
      {
        priority: "P2",
        legacyVariable: "dlv - Add to Cart - Add Array",
        externalRefs: 6,
        suggestedSource: "resolver",
        endpointPath: "/compatibility/add-to-cart",
        status: "partial",
        eventFamilies: ["add_to_cart"],
        notes: "partial"
      },
      {
        priority: "P1",
        legacyVariable: "dlv - Customer Email",
        externalRefs: 13,
        suggestedSource: "resolver",
        endpointPath: "/compatibility/customer-email",
        status: "available",
        eventFamilies: ["purchase"],
        notes: "available"
      }
    ],
    usage: [
      {
        endpointPath: "/compatibility/add-to-cart",
        legacyVariable: "dlv - Add to Cart - Add Array",
        status: "ok",
        hits: 5,
        eventFamilies: ["add_to_cart"]
      },
      {
        endpointPath: "/compatibility/add-to-cart",
        legacyVariable: "dlv - Add to Cart - Add Array",
        status: "error",
        hits: 2,
        eventFamilies: ["add_to_cart"]
      },
      {
        endpointPath: "/compatibility/customer-email",
        legacyVariable: "dlv - Customer Email",
        status: "error",
        hits: 4,
        eventFamilies: ["purchase"]
      }
    ]
  });

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.legacyVariable, "dlv - Add to Cart - Add Array");
  assert.equal(diagnostics[0]?.status, "partial");
  assert.equal(diagnostics[1]?.legacyVariable, "dlv - Customer Email");
  assert.equal(diagnostics[1]?.errorHits, 4);
});
