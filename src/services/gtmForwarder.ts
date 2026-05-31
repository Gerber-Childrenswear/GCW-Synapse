import crypto from "crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { env } from "../config/env";
import { logInfo, logWarn } from "../lib/logger";
import { incrementCounter } from "./metrics";
type ForwardPayload = Record<string, unknown> & {
  event_name?: string | undefined;
  event_id?: string | undefined;
  transaction_id?: string | undefined;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number | undefined): boolean {
  if (!status) {
    return true;
  }

  return status === 429 || status >= 500;
}

async function appendDeadLetter(
  payloadJson: string,
  payload: ForwardPayload,
  errorMessage: string,
  status: number | undefined,
  attempt: number
): Promise<void> {
  if (!env.GTM_DEAD_LETTER_PATH) {
    return;
  }

  const absolutePath = path.resolve(env.GTM_DEAD_LETTER_PATH);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  const record = {
    at: new Date().toISOString(),
    status,
    attempt,
    error: errorMessage,
    event_name: payload.event_name,
    event_id: payload.event_id,
    transaction_id: payload.transaction_id,
    payload: JSON.parse(payloadJson)
  };

  await appendFile(absolutePath, `${JSON.stringify(record)}\n`, "utf8");
  incrementCounter("gtm_dead_letter_written");
}

export function createForwardHeaders(
  payloadJson: string,
  payload: ForwardPayload,
  sharedSecret?: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (payload.event_name) {
    headers["X-Synapse-Event-Name"] = String(payload.event_name);
  }
  if (payload.event_id) {
    headers["X-Synapse-Event-Id"] = String(payload.event_id);
  }
  if (payload.transaction_id) {
    headers["X-Synapse-Transaction-Id"] = String(payload.transaction_id);
  }

  if (!sharedSecret) {
    return headers;
  }

  const timestamp = String(nowEpochSeconds);
  const signature = crypto
    .createHmac("sha256", sharedSecret)
    .update(`${timestamp}.${payloadJson}`)
    .digest("hex");

  headers["X-Synapse-Timestamp"] = timestamp;
  headers["X-Synapse-Signature"] = `v1=${signature}`;

  return headers;
}

export async function forwardToGtmServer(payload: ForwardPayload): Promise<void> {
  const maxAttempts = env.GTM_FORWARD_MAX_RETRIES + 1;
  const payloadJson = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await axios.post(env.GTM_SERVER_URL, payloadJson, {
        headers: createForwardHeaders(payloadJson, payload, env.GTM_FORWARD_SHARED_SECRET),
        timeout: env.REQUEST_TIMEOUT_MS
      });

      logInfo("Forwarded payload to GTM", {
        event_name: payload.event_name,
        event_id: payload.event_id,
        transaction_id: payload.transaction_id,
        attempt
      });
      return;
    } catch (error) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      const status = axiosError.response?.status;

      if (attempt >= maxAttempts || !isRetryableStatus(status)) {
        await appendDeadLetter(payloadJson, payload, axiosError.message ?? "forward_failed", status, attempt);
        throw error;
      }

      const delay = env.GTM_FORWARD_BACKOFF_MS * attempt;
      logWarn("Retrying GTM forward", {
        event_name: payload.event_name,
        event_id: payload.event_id,
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
