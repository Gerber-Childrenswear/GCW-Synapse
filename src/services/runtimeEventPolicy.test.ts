import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRuntimeEventPolicy } from "./runtimeEventPolicy";
import type { SynapseRuntimeEvent } from "../types/synapse";

function buildEvent(): SynapseRuntimeEvent {
  return {
    event_name: "add_to_cart",
    source: "theme",
    customer: {
      id: "123",
      email: "shopper@example.com",
      visitor_type: "human"
    },
    product: {},
    collection: {},
    cart: {},
    checkout: {},
    marketing: {},
    session: {},
    consent: {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    }
  };
}

describe("evaluateRuntimeEventPolicy", () => {
  it("allows human event when all required consents are granted", () => {
    const decision = evaluateRuntimeEventPolicy(buildEvent());
    assert.deepEqual(decision, { allowed: true });
  });

  it("suppresses confirmed bots", () => {
    const event = buildEvent();
    event.customer.visitor_type = "confirmed_bot";

    const decision = evaluateRuntimeEventPolicy(event);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "suppressed_confirmed_bot");
  });

  it("suppresses marketing events when ad consent is denied", () => {
    const event = buildEvent();
    event.consent.ad_storage = "denied";

    const decision = evaluateRuntimeEventPolicy(event);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "suppressed_marketing_consent");
  });
});
