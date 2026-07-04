import test from "node:test";
import assert from "node:assert/strict";
import {
  getCompatibilityUsageByEndpoint,
  getCompatibilityUsageSummary,
  getCompatibilityUsageTrend,
  recordCompatibilityUsage,
  resetCompatibilityUsageForTests
} from "./compatibilityUsage";

test("compatibility usage summary records hits by endpoint and status", () => {
  resetCompatibilityUsageForTests();

  recordCompatibilityUsage("/compatibility/add-to-cart", "ok");
  recordCompatibilityUsage("/compatibility/add-to-cart", "ok");
  recordCompatibilityUsage("/compatibility/customer-email", "error");

  const summary = getCompatibilityUsageSummary();
  const addToCart = summary.find(
    (entry) => entry.endpointPath === "/compatibility/add-to-cart" && entry.status === "ok"
  );
  const customerEmail = summary.find(
    (entry) => entry.endpointPath === "/compatibility/customer-email" && entry.status === "error"
  );

  assert.ok(addToCart);
  assert.equal(addToCart?.hits, 2);
  assert.ok(customerEmail);
  assert.equal(customerEmail?.hits, 1);
});

test("compatibility usage endpoint summary aggregates ok/error and exposes trend buckets", () => {
  resetCompatibilityUsageForTests();

  recordCompatibilityUsage("/compatibility/add-to-cart", "ok");
  recordCompatibilityUsage("/compatibility/add-to-cart", "error");
  recordCompatibilityUsage("/compatibility/add-to-cart", "ok");

  const byEndpoint = getCompatibilityUsageByEndpoint();
  const addToCart = byEndpoint.find((entry) => entry.endpointPath === "/compatibility/add-to-cart");

  assert.ok(addToCart);
  assert.equal(addToCart?.okHits, 2);
  assert.equal(addToCart?.errorHits, 1);
  assert.equal(addToCart?.totalHits, 3);
  assert.equal(addToCart?.failureRatePct, 33.33);

  const trend = getCompatibilityUsageTrend(24).filter((entry) => entry.endpointPath === "/compatibility/add-to-cart");
  assert.equal(trend.length > 0, true);
  assert.equal(trend[0]?.totalHits, 3);
});