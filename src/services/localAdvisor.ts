type AdvisorRole = "user" | "assistant";

type AdvisorHistoryMessage = {
  role: AdvisorRole;
  content: string;
};

type AdvisorToolName =
  | "ops_alerts"
  | "runtime_summary"
  | "channel_health"
  | "launch_readiness"
  | "parity_report"
  | "recent_runtime_events";

type AdvisorContext = {
  ops: {
    status: "ok" | "warning" | "critical";
    alerts: Array<{
      severity: "warning" | "critical";
      code: string;
      message: string;
      recommendation: string;
    }>;
  };
  runtime: {
    total: number;
    forwarded: number;
    suppressed: number;
  };
  channels: {
    totals: {
      tracked_integrations: number;
      healthy: number;
      warning: number;
      critical: number;
    };
    channels: Array<{
      key: string;
      channel: string;
      surface: string;
      destination: string;
      status: "healthy" | "warning" | "critical";
      failure_rate_pct: number;
      minutes_since_last_event: number;
      total_events: number;
      error_events: number;
      last_error_message?: string;
    }>;
  };
  parity: {
    status: "ok" | "alert";
    mismatch_rate_pct: number;
    threshold_pct: number;
    paired_events: number;
  };
  launch: {
    status: "go" | "hold";
    phase: "validation" | "cutover";
    blockers: string[];
    recommendations: string[];
  };
  recentRuntimeEvents: Array<{
    at: string;
    event_name: string;
    status: "forwarded" | "suppressed" | "duplicate";
    reason?: string;
    source?: string;
  }>;
};

type LocalAdvisorConfig = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export type AdvisorAlertItem = {
  severity: "warning" | "critical";
  title: string;
  message: string;
  action: string;
};

export type AdvisorChatResult = {
  answer: string;
  model: string;
  fallbackUsed: boolean;
  usedTools: AdvisorToolName[];
};

function summarizeTool(name: AdvisorToolName): string {
  if (name === "ops_alerts") {
    return "Current ops status and active critical/warning alerts.";
  }
  if (name === "runtime_summary") {
    return "Runtime forwarded/suppressed telemetry and trend quality.";
  }
  if (name === "channel_health") {
    return "Destination health by channel/surface with failure rates and staleness.";
  }
  if (name === "launch_readiness") {
    return "Launch go/hold status with blockers and recommendations.";
  }
  if (name === "parity_report") {
    return "Shadow parity mismatch status against Elevar baseline.";
  }
  return "Recent runtime events and suppression reasons.";
}

function selectToolsForPrompt(prompt: string): AdvisorToolName[] {
  const text = prompt.toLowerCase();
  const tools = new Set<AdvisorToolName>();

  tools.add("ops_alerts");

  if (text.includes("runtime") || text.includes("suppress") || text.includes("event")) {
    tools.add("runtime_summary");
    tools.add("recent_runtime_events");
  }

  if (text.includes("meta") || text.includes("reddit") || text.includes("channel") || text.includes("destination")) {
    tools.add("channel_health");
  }

  if (text.includes("launch") || text.includes("ready") || text.includes("cutover")) {
    tools.add("launch_readiness");
  }

  if (text.includes("parity") || text.includes("mismatch") || text.includes("elevar")) {
    tools.add("parity_report");
  }

  return [...tools];
}

function buildFocusedContext(context: AdvisorContext, tools: AdvisorToolName[]): Record<string, unknown> {
  const focused: Record<string, unknown> = {};

  for (const tool of tools) {
    if (tool === "ops_alerts") {
      focused.ops = context.ops;
    } else if (tool === "runtime_summary") {
      focused.runtime = context.runtime;
    } else if (tool === "channel_health") {
      focused.channels = context.channels;
    } else if (tool === "launch_readiness") {
      focused.launch = context.launch;
    } else if (tool === "parity_report") {
      focused.parity = context.parity;
    } else if (tool === "recent_runtime_events") {
      focused.recentRuntimeEvents = context.recentRuntimeEvents;
    }
  }

  return focused;
}

function buildSystemPrompt(): string {
  return [
    "You are GCW Synapse Advisor, a Shopify analytics expert embedded in the Gerber Childrenswear Synapse app.",
    "Your mission: help teams replace Elevar safely and run durable analytics across Shopify themes (Expanse on dev, Hyper on production), GTM server-side and client-side pipelines, and ad destinations.",
    "You are deeply knowledgeable in Shopify events, checkout events, GA4, Meta CAPI, Reddit CAPI, Shopify themes, and business impact.",
    "Prioritize production-safe recommendations.",
    "Always answer with:",
    "1) What is happening now",
    "2) Why it matters for revenue/measurement",
    "3) Exact next actions",
    "4) A short risk level: low/medium/high",
    "Never invent metrics. Use only provided context.",
    "If context is missing, say what is missing and the exact endpoint to check.",
    "Be concise and operational."
  ].join("\n");
}

function fallbackAnswer(prompt: string, context: AdvisorContext, tools: AdvisorToolName[]): string {
  const lines: string[] = [];
  lines.push("Local model unavailable. Returning deterministic Synapse advisor guidance.");
  lines.push("");
  lines.push("Current state:");
  lines.push(`- Ops status: ${context.ops.status}`);
  lines.push(`- Runtime forwarded/suppressed: ${context.runtime.forwarded}/${context.runtime.suppressed}`);
  lines.push(`- Channel health (critical/warning): ${context.channels.totals.critical}/${context.channels.totals.warning}`);
  lines.push(`- Parity mismatch: ${context.parity.mismatch_rate_pct}% (threshold ${context.parity.threshold_pct}%)`);
  lines.push(`- Launch readiness: ${context.launch.status}`);

  if (context.ops.alerts.length > 0) {
    lines.push("");
    lines.push("Top alerts:");
    for (const alert of context.ops.alerts.slice(0, 3)) {
      lines.push(`- [${alert.severity}] ${alert.message} -> ${alert.recommendation}`);
    }
  }

  lines.push("");
  lines.push("Recommended next actions:");
  lines.push("- Review /ops/alerts and /compare/channels for destination-specific issues.");
  lines.push("- If parity mismatch exceeds threshold, remain in shadow_compare and inspect /compare/parity.");
  lines.push("- Validate runtime suppression reasons via /runtime/recent before changing consent or bot policy.");
  lines.push("");
  lines.push(`Prompt received: ${prompt}`);
  lines.push(`Tools used: ${tools.join(", ")}`);

  return lines.join("\n");
}

export function buildAdvisorAlerts(context: AdvisorContext): AdvisorAlertItem[] {
  const alerts: AdvisorAlertItem[] = [];

  for (const alert of context.ops.alerts) {
    alerts.push({
      severity: alert.severity,
      title: alert.code,
      message: alert.message,
      action: alert.recommendation
    });
  }

  for (const channel of context.channels.channels) {
    if (channel.status === "healthy") {
      continue;
    }

    alerts.push({
      severity: channel.status === "critical" ? "critical" : "warning",
      title: `${channel.channel} ${channel.surface} ${channel.destination}`,
      message: `Failure ${channel.failure_rate_pct}% | Last event ${channel.minutes_since_last_event}m ago`,
      action: "Check destination credentials, event mapping, and compare/channel-event callbacks."
    });
  }

  if (context.launch.status === "hold") {
    alerts.push({
      severity: "critical",
      title: "launch_readiness_hold",
      message: "Launch readiness reports HOLD.",
      action: context.launch.recommendations[0] ?? "Resolve blockers in /launch/readiness before cutover."
    });
  }

  return alerts.slice(0, 15);
}

export async function getAdvisorAnswer(input: {
  message: string;
  history: AdvisorHistoryMessage[];
  context: AdvisorContext;
  config: LocalAdvisorConfig;
}): Promise<AdvisorChatResult> {
  const message = input.message.trim();
  const tools = selectToolsForPrompt(message);
  const focusedContext = buildFocusedContext(input.context, tools);

  if (!input.config.enabled) {
    return {
      answer: fallbackAnswer(message, input.context, tools),
      model: "fallback-disabled",
      fallbackUsed: true,
      usedTools: tools
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.config.timeoutMs);

  const toolSummary = tools.map((tool) => `${tool}: ${summarizeTool(tool)}`).join("\n");

  const userMessage = [
    `Question: ${message}`,
    "",
    "MCP-like tools available for this question:",
    toolSummary,
    "",
    "Context snapshot:",
    JSON.stringify(focusedContext, null, 2)
  ].join("\n");

  try {
    const response = await fetch(`${input.config.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: input.config.model,
        stream: false,
        options: {
          temperature: 0.2
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          ...input.history.slice(-6),
          {
            role: "user",
            content: userMessage
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Local model request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { message?: { content?: string } };
    const content = body.message?.content?.trim();

    if (!content) {
      throw new Error("Local model response was empty");
    }

    return {
      answer: content,
      model: input.config.model,
      fallbackUsed: false,
      usedTools: tools
    };
  } catch {
    return {
      answer: fallbackAnswer(message, input.context, tools),
      model: "fallback-error",
      fallbackUsed: true,
      usedTools: tools
    };
  } finally {
    clearTimeout(timer);
  }
}
