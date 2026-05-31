import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyShopifyWebhookHmac } from "./shopifyHmac";

test("verifyShopifyWebhookHmac returns true for valid signature", () => {
  const secret = "super-secret";
  const body = Buffer.from('{"hello":"world"}', "utf8");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");

  const valid = verifyShopifyWebhookHmac(body, signature, secret);
  assert.equal(valid, true);
});

test("verifyShopifyWebhookHmac returns false for invalid signature", () => {
  const secret = "super-secret";
  const body = Buffer.from('{"hello":"world"}', "utf8");

  const valid = verifyShopifyWebhookHmac(body, "bad-signature", secret);
  assert.equal(valid, false);
});
