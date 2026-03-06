import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { requireRoles } from "../middleware/auth.js";
import { sendEmail } from "../services/email.js";
import { getSystemSettings, SettingKeys, upsertSettings } from "../services/settings.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import {
  adminCreateCatalogNodeSchema,
  adminCreateUserSchema,
  adminPatchCatalogNodeSchema,
  adminPatchSettingsSchema,
  adminPatchUserSchema,
  adminTestEmailSchema
} from "../utils/schemas.js";

export const adminRouter = Router();

adminRouter.use(requireRoles(["ADMIN"]));

function duplicateNodeError(nodeType) {
  if (nodeType === "CATEGORY") return "Category name already exists";
  if (nodeType === "SUBCATEGORY") return "Sub-Category name already exists under this parent";
  if (nodeType === "PRODUCT") return "Product name already exists under this parent";
  return "Duplicate catalog node name";
}

adminRouter.get("/users", async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 200
  });
  const where = {};
  const total = await prisma.user.count({ where });
  const items = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      staffType: true,
      isActive: true
    },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });

  return res.json({ items, pagination: paginationMeta(total, page, pageSize) });
});

adminRouter.post("/users", async (req, res) => {
  const parsed = adminCreateUserSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const email = parsed.data.email.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  const role = parsed.data.role;
  const staffType = parsed.data.staffType ?? null;
  const password = parsed.data.password;

  if (role === "STAFF" && !staffType) {
    return res.status(400).json({ error: "Staff role requires valid staffType" });
  }
  if (role !== "STAFF" && staffType) {
    return res.status(400).json({ error: "staffType is only allowed for STAFF role" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already exists" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      role,
      staffType: role === "STAFF" ? staffType : null,
      passwordHash,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      staffType: true,
      isActive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.session.user.id,
      entityType: "user",
      entityId: user.id,
      action: "create_user",
      after: user
    }
  });

  return res.status(201).json(user);
});

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = adminPatchUserSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const id = req.params.id;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "User not found" });

  const patch = {};
  if (parsed.data.displayName !== undefined) {
    const displayName = String(parsed.data.displayName || "").trim();
    patch.displayName = displayName;
  }
  if (parsed.data.isActive !== undefined) {
    patch.isActive = Boolean(parsed.data.isActive);
  }
  if (parsed.data.role !== undefined) {
    patch.role = parsed.data.role;
  }
  if (parsed.data.staffType !== undefined) {
    const raw = parsed.data.staffType;
    const staffType = raw === null || raw === "" ? null : String(raw);
    patch.staffType = staffType;
  }
  if (parsed.data.newPassword !== undefined) {
    const newPassword = String(parsed.data.newPassword || "");
    patch.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const nextRole = patch.role ?? existing.role;
  const nextStaffType = patch.staffType !== undefined ? patch.staffType : existing.staffType;
  if (nextRole === "STAFF" && !nextStaffType) {
    return res.status(400).json({ error: "STAFF role requires staffType" });
  }
  if (nextRole !== "STAFF") {
    patch.staffType = null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: patch,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      staffType: true,
      isActive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.session.user.id,
      entityType: "user",
      entityId: id,
      action: "update_user",
      before: {
        displayName: existing.displayName,
        role: existing.role,
        staffType: existing.staffType,
        isActive: existing.isActive
      },
      after: updated
    }
  });

  return res.json(updated);
});

adminRouter.get("/catalog/nodes", async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 50,
    maxPageSize: 300
  });
  const where = {};
  const total = await prisma.productNode.count({ where });
  const items = await prisma.productNode.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    skip,
    take
  });
  return res.json({ items, pagination: paginationMeta(total, page, pageSize) });
});

adminRouter.post("/catalog/nodes", async (req, res) => {
  const parsed = adminCreateCatalogNodeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const name = parsed.data.name.trim();
  const nodeType = parsed.data.nodeType;
  const parentId = parsed.data.parentId ?? null;
  const sortOrder = Number(parsed.data.sortOrder ?? 0);

  let parent = null;
  if (parentId) {
    parent = await prisma.productNode.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(400).json({ error: "parent not found" });
    if (!parent.isActive) return res.status(400).json({ error: "parent must be active" });
    if (parent.nodeType === "PRODUCT") {
      return res.status(400).json({ error: "cannot add child under PRODUCT node" });
    }
  }

  if (!parentId && nodeType !== "CATEGORY") {
    return res.status(400).json({ error: "parentId is required for SUBCATEGORY and PRODUCT" });
  }

  const duplicate = await prisma.productNode.findFirst({
    where: {
      nodeType,
      parentId,
      name: { equals: name, mode: "insensitive" }
    },
    select: { id: true }
  });
  if (duplicate) return res.status(409).json({ error: duplicateNodeError(nodeType) });

  const item = await prisma.productNode.create({
    data: {
      name,
      nodeType,
      parentId,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.session.user.id,
      entityType: "product_node",
      entityId: item.id,
      action: "create_catalog_node",
      after: {
        name: item.name,
        nodeType: item.nodeType,
        parentId: item.parentId
      }
    }
  });

  return res.status(201).json(item);
});

adminRouter.patch("/catalog/nodes/:id", async (req, res) => {
  const parsed = adminPatchCatalogNodeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const id = req.params.id;
  const node = await prisma.productNode.findUnique({ where: { id } });
  if (!node) return res.status(404).json({ error: "Node not found" });

  const patch = {};
  if (parsed.data.name !== undefined) {
    const name = String(parsed.data.name || "").trim();
    patch.name = name;
  }
  if (parsed.data.sortOrder !== undefined) {
    const sortOrder = Number(parsed.data.sortOrder);
    if (!Number.isFinite(sortOrder)) return res.status(400).json({ error: "sortOrder must be a number" });
    patch.sortOrder = sortOrder;
  }
  if (parsed.data.isActive !== undefined) {
    patch.isActive = Boolean(parsed.data.isActive);
  }
  if (parsed.data.parentId !== undefined) {
    const parentId = parsed.data.parentId ? String(parsed.data.parentId) : null;
    if (parentId === id) return res.status(400).json({ error: "A node cannot be its own parent" });

    if (node.nodeType === "CATEGORY" && parentId) {
      return res.status(400).json({ error: "CATEGORY cannot have a parent" });
    }
    if (node.nodeType !== "CATEGORY" && !parentId) {
      return res.status(400).json({ error: `${node.nodeType} requires a parent` });
    }

    if (parentId) {
      const parent = await prisma.productNode.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(400).json({ error: "parent not found" });
      if (parent.nodeType === "PRODUCT") return res.status(400).json({ error: "cannot set parent to PRODUCT node" });

      const allowedParentForNode = {
        CATEGORY: [],
        SUBCATEGORY: ["CATEGORY", "SUBCATEGORY"],
        PRODUCT: ["CATEGORY", "SUBCATEGORY"]
      };
      if (!allowedParentForNode[node.nodeType].includes(parent.nodeType)) {
        return res.status(400).json({ error: `Invalid parent type ${parent.nodeType} for ${node.nodeType}` });
      }

      // Cycle check: walk up the new parent chain and reject if current node appears.
      let cursor = parent;
      while (cursor) {
        if (cursor.id === id) {
          return res.status(400).json({ error: "Re-parent would create a cycle" });
        }
        if (!cursor.parentId) break;
        cursor = await prisma.productNode.findUnique({ where: { id: cursor.parentId } });
      }
    }

    patch.parentId = parentId;
  }

  if (patch.isActive === false) {
    const activeChildren = await prisma.productNode.count({ where: { parentId: id, isActive: true } });
    if (activeChildren > 0) {
      return res.status(400).json({ error: "Cannot disable a node with active children. Disable children first." });
    }
  }

  const nextName = (patch.name !== undefined ? patch.name : node.name).trim();
  const nextParentId = patch.parentId !== undefined ? patch.parentId : node.parentId;
  const duplicate = await prisma.productNode.findFirst({
    where: {
      id: { not: id },
      nodeType: node.nodeType,
      parentId: nextParentId,
      name: { equals: nextName, mode: "insensitive" }
    },
    select: { id: true }
  });
  if (duplicate) return res.status(409).json({ error: duplicateNodeError(node.nodeType) });

  const updated = await prisma.productNode.update({
    where: { id },
    data: patch
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.session.user.id,
      entityType: "product_node",
      entityId: id,
      action: "update_catalog_node",
      before: {
        name: node.name,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        isActive: node.isActive
      },
      after: {
        name: updated.name,
        parentId: updated.parentId,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive
      }
    }
  });

  return res.json(updated);
});

adminRouter.get("/settings", async (_req, res) => {
  const settings = await getSystemSettings();
  return res.json({
    appBaseUrl: settings.appBaseUrl,
    manufacturingGroupEmail: settings.manufacturingGroupEmail,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    smtpTls: settings.smtpTls,
    smtpPassConfigured: Boolean(settings.smtpPass)
  });
});

adminRouter.patch("/settings", async (req, res) => {
  const parsed = adminPatchSettingsSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const patch = {};
  if (parsed.data.appBaseUrl !== undefined) patch[SettingKeys.appBaseUrl] = String(parsed.data.appBaseUrl || "").trim();
  if (parsed.data.manufacturingGroupEmail !== undefined) patch[SettingKeys.manufacturingGroupEmail] = String(parsed.data.manufacturingGroupEmail || "").trim();
  if (parsed.data.smtpHost !== undefined) patch[SettingKeys.smtpHost] = String(parsed.data.smtpHost || "").trim();
  if (parsed.data.smtpPort !== undefined) patch[SettingKeys.smtpPort] = Number(parsed.data.smtpPort || 0);
  if (parsed.data.smtpUser !== undefined) patch[SettingKeys.smtpUser] = String(parsed.data.smtpUser || "").trim();
  if (parsed.data.smtpFrom !== undefined) patch[SettingKeys.smtpFrom] = String(parsed.data.smtpFrom || "").trim();
  if (parsed.data.smtpTls !== undefined) patch[SettingKeys.smtpTls] = Boolean(parsed.data.smtpTls);
  if (parsed.data.smtpPass !== undefined && String(parsed.data.smtpPass).trim() !== "") {
    patch[SettingKeys.smtpPass] = String(parsed.data.smtpPass);
  }

  await upsertSettings(patch);
  await prisma.auditLog.create({
    data: {
      actorUserId: req.session.user.id,
      entityType: "settings",
      entityId: "system",
      action: "update_settings",
      after: Object.keys(patch)
    }
  });

  const settings = await getSystemSettings();
  return res.json({
    appBaseUrl: settings.appBaseUrl,
    manufacturingGroupEmail: settings.manufacturingGroupEmail,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    smtpTls: settings.smtpTls,
    smtpPassConfigured: Boolean(settings.smtpPass)
  });
});

adminRouter.post("/settings/test-email", async (req, res) => {
  const parsed = adminTestEmailSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const to = parsed.data.to.trim();
  const result = await sendEmail({
    to,
    subject: "GSR SMTP test",
    text: "This is a test email from GSR admin settings."
  });
  return res.json({ ok: true, result });
});

adminRouter.get("/audit-logs", async (req, res) => {
  const entityType = String(req.query?.entityType || "").trim();
  const action = String(req.query?.action || "").trim();
  const actorUserId = String(req.query?.actorUserId || "").trim();
  const from = String(req.query?.from || "").trim();
  const to = String(req.query?.to || "").trim();
  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 100,
    maxPageSize: 500
  });

  const where = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = { contains: action };
  if (actorUserId) where.actorUserId = actorUserId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const total = await prisma.auditLog.count({ where });
  const items = await prisma.auditLog.findMany({
    where,
    include: {
      actor: {
        select: { id: true, email: true, displayName: true }
      }
    },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });

  return res.json({ items, pagination: paginationMeta(total, page, pageSize) });
});
