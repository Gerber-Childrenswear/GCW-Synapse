import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

for (const [key, value] of Object.entries(env)) {
  if (typeof value === "string" && value.length > 0) {
    process.env[key] = value;
  }
}

process.env.CF_WORKER = "1";
process.env.PORT = process.env.PORT || "8080";

const { app } = await import("../../src/server");
const port = Number(process.env.PORT || 8080);
app.listen(port);

export default httpServerHandler({ port });
