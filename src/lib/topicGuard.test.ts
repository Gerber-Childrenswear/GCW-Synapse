import test from "node:test";
import assert from "node:assert/strict";
import { isTopicAccepted, parseAllowedTopics } from "./topicGuard";

test("isTopicAccepted allows only expected topic from allowlist", () => {
  const allow = parseAllowedTopics("orders/create,orders/paid");

  assert.equal(isTopicAccepted("orders/create", "orders/create", allow), true);
  assert.equal(isTopicAccepted("orders/paid", "orders/create", allow), false);
  assert.equal(isTopicAccepted("orders/cancelled", "orders/create", allow), false);
});
