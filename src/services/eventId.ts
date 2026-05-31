import { createHash } from "node:crypto";

export type EventIdInput = {
  incomingEventId?: string | undefined;
  webhookId?: string | undefined;
  shop?: string | undefined;
  topic?: string | undefined;
  orderNumber?: number | undefined;
  orderName?: string | undefined;
};

function normalizeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function buildDeterministicSource(input: EventIdInput): string {
  const parts = [
    normalizeValue(input.shop) ?? "unknown-shop",
    normalizeValue(input.topic) ?? "unknown-topic",
    input.orderNumber?.toString() ?? "unknown-order-number",
    normalizeValue(input.orderName) ?? "unknown-order-name"
  ];

  return parts.join("|");
}

export function resolveEventId(input: EventIdInput): string {
  const incomingEventId = normalizeValue(input.incomingEventId);
  if (incomingEventId) {
    return incomingEventId;
  }

  const webhookId = normalizeValue(input.webhookId);
  if (webhookId) {
    return webhookId;
  }

  const deterministicSource = buildDeterministicSource(input);
  return createHash("sha256").update(deterministicSource).digest("hex").slice(0, 32);
}
