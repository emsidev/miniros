import { z } from "zod";
import {
  v2IdSchema as id,
  v2DigestSchema,
  v2SnapshotSchema,
  v2OperationSchema,
} from "@miniros/domain/v2";

export const nativeScopeSchema = z.object({ businessId: id, shiftId: id });
export const nativeSnapshotRequestSchema = z
  .object({ snapshot: v2SnapshotSchema, cashierInstallationId: id })
  .strict();
export const nativeGrantRequestSchema = nativeScopeSchema
  .extend({
    userId: id,
    installationId: id,
    role: z.enum(["cashier", "prep"]),
    grantSpki: z.string().min(60).max(1000),
    ttlSeconds: z.number().int().min(60).max(86_400),
  })
  .strict();
export const nativeRevokeRequestSchema = nativeScopeSchema
  .extend({
    grantId: id,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const nativeRecoveryRequestSchema = nativeScopeSchema
  .extend({
    packageId: id,
    packageDigest: v2DigestSchema,
    reason: z.string().trim().min(1).max(2000),
    operations: z.array(v2OperationSchema).min(1).max(100),
  })
  .strict();
