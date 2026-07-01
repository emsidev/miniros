import { serve } from "@hono/node-server";
import {
  healthResponseSchema,
  workflowPreviewRequestSchema,
  workflowPreviewResponseSchema,
} from "@miniros/contracts";
import { workflowCatalog } from "@miniros/domain";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (context) => {
  const payload = healthResponseSchema.parse({
    service: "@miniros/api",
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });

  return context.json(payload);
});

app.post("/workflows/preview", async (context) => {
  const input = workflowPreviewRequestSchema.parse(await context.req.json());
  const workflow = workflowCatalog.find(
    (candidate) => candidate.id === input.workflowId,
  );

  if (!workflow) {
    return context.json({ error: "Unknown workflow." }, 404);
  }

  const payload = workflowPreviewResponseSchema.parse({
    workflowId: workflow.id,
    workflowLabel: workflow.label,
    owner: workflow.owner,
    ruleModules: workflow.ruleModules,
    nextSurface: workflow.nextSurface,
    notes: [
      `Client source: ${input.client}`,
      "Business rules live in @miniros/domain.",
      "Typed request and response contracts live in @miniros/contracts.",
    ],
  });

  return context.json(payload);
});

const port = Number(process.env.PORT ?? 4000);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`@miniros/api listening on http://localhost:${info.port}`);
  },
);
