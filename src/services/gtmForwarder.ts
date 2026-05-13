import axios from "axios";
import { env } from "../config/env";
import { logInfo, logWarn } from "../lib/logger";
import type { SynapseEventPayload } from "../types/shopify";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number | undefined): boolean {
  if (!status) {
    return true;
  }

  return status === 429 || status >= 500;
}

export async function forwardToGtmServer(payload: SynapseEventPayload): Promise<void> {
  const maxAttempts = env.GTM_FORWARD_MAX_RETRIES + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await axios.post(env.GTM_SERVER_URL, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: env.REQUEST_TIMEOUT_MS
      });

      logInfo("Forwarded payload to GTM", {
        transaction_id: payload.transaction_id,
        attempt
      });
      return;
    } catch (error) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      const status = axiosError.response?.status;

      if (attempt >= maxAttempts || !isRetryableStatus(status)) {
        throw error;
      }

      const delay = env.GTM_FORWARD_BACKOFF_MS * attempt;
      logWarn("Retrying GTM forward", {
        transaction_id: payload.transaction_id,
        attempt,
        delay_ms: delay,
        status,
        error: axiosError.message
      });
      await sleep(delay);
    }
  }
}
