import { Router } from "express";
import { prisma } from "../config/db.js";
import { requireRoles } from "../middleware/auth.js";
import { WORK_REQUEST_STATUSES } from "../services/state-machine.js";
import { createAuditLog } from "../services/audit.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import {
  managerApproveSchema,
  managerRejectSchema,
  managerResetSchema,
  managerShipSchema
} from "../utils/schemas.js";
import {
  notifyOnApprove,
  notifyOnReject,
  notifyOnShipped
} from "../services/notifications.js";

export const managerRouter = Router();

managerRouter.get("/staff", requireRoles(["SALES_MANAGER", "ADMIN"]), async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 50,
    maxPageSize: 200
  });
  const where = { role: "STAFF", isActive: true };
  const total = await prisma.user.count({ where });
  const items = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      displayName: true,
      staffType: true
    },
    orderBy: [{ staffType: "asc" }, { displayName: "asc" }],
    skip,
    take
  });
  return res.json({ items, pagination: paginationMeta(total, page, pageSize) });
});

managerRouter.post("/work-requests/:id/reject", requireRoles(["SALES_MANAGER", "ADMIN"]), async (req, res) => {
  const parsed = managerRejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const comment = parsed.data.comment.trim();

  const wr = await prisma.workRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status !== WORK_REQUEST_STATUSES.SUBMITTED) {
    return res.status(400).json({ error: "Only submitted requests can be rejected" });
  }

  const updated = await prisma.workRequest.update({
    where: { id: wr.id },
    data: { status: WORK_REQUEST_STATUSES.REJECTED }
  });

  await prisma.comment.create({
    data: {
      workRequestId: wr.id,
      authorUserId: req.session.user.id,
      commentType: "manager_decision",
      body: comment
    }
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "reject",
    before: { status: wr.status },
    after: { status: updated.status, comment }
  });

  await notifyOnReject(wr.id, comment);

  return res.json(updated);
});

managerRouter.post("/work-requests/:id/approve", requireRoles(["SALES_MANAGER", "ADMIN"]), async (req, res) => {
  const parsed = managerApproveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const assignees = parsed.data.assignees;
  const comment = parsed.data.comment ? String(parsed.data.comment) : null;

  const wr = await prisma.workRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status !== WORK_REQUEST_STATUSES.SUBMITTED) {
    return res.status(400).json({ error: "Only submitted requests can be approved" });
  }

  const users = assignees.length
    ? await prisma.user.findMany({ where: { id: { in: assignees }, role: "STAFF", isActive: true } })
    : [];

  if (assignees.length !== users.length) {
    return res.status(400).json({ error: "Invalid assignees" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.workRequest.update({
      where: { id: wr.id },
      data: { status: WORK_REQUEST_STATUSES.APPROVED }
    });

    if (comment) {
      await tx.comment.create({
        data: {
          workRequestId: wr.id,
          authorUserId: req.session.user.id,
          commentType: "manager_decision",
          body: comment
        }
      });
    }

    if (users.length) {
      await tx.workRequestAssignment.createMany({
        data: users.map((u) => ({
          workRequestId: wr.id,
          userId: u.id,
          assignedBy: req.session.user.id,
          assignedRole: u.staffType
        }))
      });

      await tx.task.createMany({
        data: users.map((u) => ({
          workRequestId: wr.id,
          assigneeUserId: u.id,
          taskRole: u.staffType,
          state: "active"
        }))
      });
    }

    return changed;
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "approve",
    before: { status: wr.status },
    after: { status: updated.status, assignees }
  });

  await notifyOnApprove(wr.id, req.session.user.email);

  return res.json(updated);
});

managerRouter.post("/work-requests/:id/reset-status", requireRoles(["SALES_MANAGER", "ADMIN"]), async (req, res) => {
  const parsed = managerResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const toStatus = parsed.data.toStatus;
  const reason = parsed.data.reason.trim();

  const wr = await prisma.workRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status === WORK_REQUEST_STATUSES.SHIPPED && req.session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only admin can reset shipped requests" });
  }

  const updated = await prisma.workRequest.update({
    where: { id: wr.id },
    data: { status: toStatus }
  });

  await prisma.comment.create({
    data: {
      workRequestId: wr.id,
      authorUserId: req.session.user.id,
      commentType: "status_reset",
      body: reason
    }
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "reset_status",
    before: { status: wr.status },
    after: { status: toStatus, reason }
  });

  return res.json(updated);
});

managerRouter.post("/work-requests/:id/ship", async (req, res) => {
  const parsed = managerShipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const dhlTrackingUrl = parsed.data.dhlTrackingUrl.trim();

  const wr = await prisma.workRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status !== WORK_REQUEST_STATUSES.READY_TO_SHIP) {
    return res.status(400).json({ error: "Request is not ready_to_ship" });
  }

  const actor = await prisma.user.findUnique({ where: { id: req.session.user.id } });
  const isAssignedLogistics = await prisma.workRequestAssignment.findFirst({
    where: {
      workRequestId: wr.id,
      userId: req.session.user.id,
      assignedRole: "LOGISTICS"
    }
  });
  const isAllowedShipper =
    req.session.user.role === "ADMIN" ||
    (req.session.user.role === "STAFF" && actor?.staffType === "LOGISTICS" && Boolean(isAssignedLogistics));
  if (!isAllowedShipper) {
    return res.status(403).json({ error: "Only logistics staff or admin can ship" });
  }

  const updated = await prisma.workRequest.update({
    where: { id: wr.id },
    data: {
      status: WORK_REQUEST_STATUSES.SHIPPED,
      dhlTrackingUrl
    }
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "ship",
    before: { status: wr.status },
    after: { status: updated.status, dhlTrackingUrl }
  });

  await notifyOnShipped(wr.id, dhlTrackingUrl, req.session.user.email);

  return res.json(updated);
});
