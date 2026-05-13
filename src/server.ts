import express from "express";
import { env } from "./config/env";
import { createIngressTokenMiddleware } from "./lib/ingressAuth";
import { webhooksRouter } from "./routes/webhooks";
import { getMetricsSnapshot } from "./services/metrics";

const app = express();
const requireIngressToken = createIngressTokenMiddleware(env.INGRESS_SHARED_TOKEN);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "gcw-synapse" });
});

app.get("/diagnostics", requireIngressToken, (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "gcw-synapse",
    metrics: getMetricsSnapshot()
  });
});

app.use(express.json());
app.post("/event", requireIngressToken, (req, res) => {
  res.status(501).json({
    message: "Use Shopify order webhooks endpoints instead",
    received: !!req.body
  });
});

// Shopify webhook routes use raw body so signature verification remains valid.
app.use(
  env.WEBHOOK_PATH_PREFIX,
  express.raw({ type: "application/json", limit: "1mb" }),
  webhooksRouter
);

app.listen(env.PORT, () => {
  console.log(`GCW-Synapse listening on port ${env.PORT}`);
});
