import crypto from "crypto";

/** Normalize webhook body to bytes. Returns null when body was already parsed as JSON. */
export function toRawBodyBuffer(body: unknown): Buffer | null {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }

  return null;
}

export function verifyShopifyWebhookHmac(
  rawBody: unknown,
  hmacHeader: string | undefined,
  sharedSecret: string
): boolean {
  if (!hmacHeader) {
    return false;
  }

  const bodyBuffer = toRawBodyBuffer(rawBody);
  if (!bodyBuffer) {
    return false;
  }

  const digest = crypto.createHmac("sha256", sharedSecret).update(bodyBuffer).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
