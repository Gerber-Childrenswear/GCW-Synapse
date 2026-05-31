import crypto from "crypto";

export function verifyShopifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined, sharedSecret: string): boolean {
  if (!hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac("sha256", sharedSecret).update(rawBody).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
