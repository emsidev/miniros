import { workflowIds } from "@miniros/domain";
import { z } from "zod";

export const workflowIdSchema = z.enum(workflowIds);

export const workflowPreviewRequestSchema = z.object({
  workflowId: workflowIdSchema,
  client: z.enum(["web", "mobile", "agent"]).default("web"),
});

export const workflowPreviewResponseSchema = z.object({
  workflowId: workflowIdSchema,
  workflowLabel: z.string(),
  owner: z.string(),
  ruleModules: z.array(z.string()),
  nextSurface: z.enum(["api", "web", "mobile"]),
  notes: z.array(z.string()),
});

export type WorkflowPreviewRequest = z.infer<
  typeof workflowPreviewRequestSchema
>;
export type WorkflowPreviewResponse = z.infer<
  typeof workflowPreviewResponseSchema
>;
