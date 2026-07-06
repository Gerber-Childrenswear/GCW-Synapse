import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaceholderMatrixReport } from "./gtmPlaceholderMatrix";
import { validateRuntimeEventAgainstCatalog } from "./runtimeCatalogValidation";
import { getMappingRegistry, replaceMappingRegistry } from "./mappingRegistry";

test("buildPlaceholderMatrixReport parses checklist families", () => {
  const report = buildPlaceholderMatrixReport();

  assert.ok(report.tagsScanned > 0);
  assert.ok(report.families.length > 0);
  assert.equal(report.families.some((family) => family.eventName === "purchase"), true);
});

test("validateRuntimeEventAgainstCatalog maps user_data to dl_user_data", () => {
  const result = validateRuntimeEventAgainstCatalog({
    event_name: "user_data",
    source: "theme",
    customer: {
      visitor_type: "human",
      id: "123"
    },
    product: {},
    collection: {},
    cart: {
      total: 10,
      currency: "USD"
    },
    checkout: {},
    marketing: {},
    session: {},
    consent: {
      analytics_storage: "granted"
    }
  });

  assert.equal(result.catalogEventName, "dl_user_data");
});

test("mapping registry supports optimistic revision updates", async () => {
  const initial = await getMappingRegistry();
  const updated = await replaceMappingRegistry(
    {
      ...initial.mappings,
      purchase: "dl_purchase"
    },
    { expectedRevision: initial.revision }
  );

  assert.ok(updated.revision > initial.revision);
  assert.equal(updated.mappings.purchase, "dl_purchase");
});
