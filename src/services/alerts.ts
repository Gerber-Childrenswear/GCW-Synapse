import axios from "axios";
import { logInfo, logWarn } from "../lib/logger";

export type AlertPayload = {
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  meta?: Record<string, string | number | boolean | undefined>;
};

export type AlertConfig = {
  slackWebhookUrl?: string | undefined;
  emailTo?: string | undefined;
  emailFrom?: string | undefined;
  /** Optional HTTP email relay (e.g. transactional provider webhook). */
  emailWebhookUrl?: string | undefined;
};

let lastSentKey = "";
let lastSentAt = 0;
const MIN_INTERVAL_MS = 15 * 60 * 1000;

export async function sendAlert(config: AlertConfig, alert: AlertPayload): Promise<{
  slack: boolean;
  email: boolean;
  skipped: boolean;
}> {
  const dedupeKey = `${alert.title}:${alert.severity}`;
  const now = Date.now();
  if (dedupeKey === lastSentKey && now - lastSentAt < MIN_INTERVAL_MS) {
    return { slack: false, email: false, skipped: true };
  }

  let slack = false;
  let email = false;

  if (config.slackWebhookUrl) {
    try {
      await axios.post(
        config.slackWebhookUrl,
        {
          text: `*${alert.title}*\n${alert.body}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${alert.title}*\n${alert.body}`
              }
            }
          ]
        },
        { timeout: 8000 }
      );
      slack = true;
    } catch (error) {
      logWarn("Slack alert failed", { error: (error as Error).message });
    }
  }

  if (config.emailWebhookUrl && config.emailTo) {
    try {
      await axios.post(
        config.emailWebhookUrl,
        {
          to: config.emailTo,
          from: config.emailFrom || "synapse-alerts@gerberchildrenswear.com",
          subject: `[Synapse ${alert.severity}] ${alert.title}`,
          text: `${alert.body}\n\n${JSON.stringify(alert.meta || {}, null, 2)}`
        },
        { timeout: 8000 }
      );
      email = true;
    } catch (error) {
      logWarn("Email alert failed", { error: (error as Error).message });
    }
  }

  if (slack || email) {
    lastSentKey = dedupeKey;
    lastSentAt = now;
    logInfo("Alert dispatched", { title: alert.title, slack, email });
  }

  return { slack, email, skipped: false };
}

export async function maybeAlertOnParity(options: {
  config: AlertConfig;
  label: string;
  mismatchRatePct: number;
  thresholdPct: number;
  alertTriggered: boolean;
  pairedEvents: number;
}): Promise<void> {
  if (!options.alertTriggered) return;

  await sendAlert(options.config, {
    title: `${options.label} accuracy below threshold`,
    body: `Mismatch rate ${options.mismatchRatePct.toFixed(2)}% exceeds ${options.thresholdPct}% (paired=${options.pairedEvents}).`,
    severity: "warning",
    meta: {
      mismatch_rate_pct: options.mismatchRatePct,
      threshold_pct: options.thresholdPct,
      paired_events: options.pairedEvents
    }
  });
}
