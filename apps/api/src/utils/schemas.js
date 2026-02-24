import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createWorkRequestSchema = z.object({
  productNodeId: z.string().uuid(),
  purpose: z.string().min(1),
  volumeKg: z.number().positive(),
  unitCount: z.number().int().positive(),
  receivingAddress: z.string().min(1),
  receivingPersonFirstname: z.string().min(1),
  receivingPersonLastname: z.string().min(1),
  receivingPersonEmail: z.string().email(),
  receivingPersonPhone: z.string().min(1),
  targetReceivingBy: z.string().date(),
  extraFields: z.record(z.any()).optional()
});

export const managerRejectSchema = z.object({
  comment: z.string().min(1)
});

export const managerApproveSchema = z.object({
  assignees: z.array(z.string().uuid()).default([]),
  comment: z.string().optional().nullable()
});

export const managerResetSchema = z.object({
  toStatus: z.enum(["submitted", "rejected", "approved", "preparing_goods_sampling", "ready_to_ship", "shipped"]),
  reason: z.string().min(1)
});

export const managerShipSchema = z.object({
  dhlTrackingUrl: z.string().url()
});

export const taskAcknowledgeSchema = z.object({
  comment: z.string().optional()
});

export const taskFinishSchema = z.object({
  comment: z.string().optional(),
  handoff_comment: z.string().optional(),
  handoff_to_user_ids: z.array(z.string().uuid()).default([])
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(["REQUESTOR", "SALES_MANAGER", "STAFF", "ADMIN"]),
  staffType: z.enum(["PRODUCTION_ENGINEER", "PURCHASING", "LOGISTICS"]).nullable().optional(),
  password: z.string().min(8)
});

export const adminPatchUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["REQUESTOR", "SALES_MANAGER", "STAFF", "ADMIN"]).optional(),
  staffType: z.enum(["PRODUCTION_ENGINEER", "PURCHASING", "LOGISTICS"]).nullable().optional(),
  newPassword: z.string().min(8).optional()
});

export const adminCreateCatalogNodeSchema = z.object({
  name: z.string().min(1),
  nodeType: z.enum(["CATEGORY", "SUBCATEGORY", "PRODUCT"]),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional()
});

export const adminPatchCatalogNodeSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
});

export const adminPatchSettingsSchema = z.object({
  appBaseUrl: z.string().url().optional(),
  manufacturingGroupEmail: z.string().email().or(z.literal("")).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpUser: z.string().optional(),
  smtpFrom: z.string().email().or(z.literal("")).optional(),
  smtpTls: z.boolean().optional(),
  smtpPass: z.string().optional()
});

export const adminTestEmailSchema = z.object({
  to: z.string().email()
});
