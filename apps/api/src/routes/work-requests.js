import { Router } from "express";
import { prisma } from "../config/db.js";
import { createWorkRequestSchema } from "../utils/schemas.js";
import { WORK_REQUEST_STATUSES } from "../services/state-machine.js";
import { createAuditLog } from "../services/audit.js";
import {
  notifyOnRequestDeleted,
  notifyOnRequestUpdated,
  notifyOnSubmit
} from "../services/notifications.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

export const workRequestsRouter = Router();

function dateStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function nextWorkRequestNo() {
  const stamp = dateStamp();
  const prefix = `GSR-${stamp}-`;
  const count = await prisma.workRequest.count({
    where: { workRequestNo: { startsWith: prefix } }
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

workRequestsRouter.post("/", async (req, res) => {
  if (req.session.user.role !== "REQUESTOR") {
    return res.status(403).json({ error: "Only requestors can create requests" });
  }

  const parsed = createWorkRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const product = await prisma.productNode.findUnique({ where: { id: parsed.data.productNodeId } });
  if (!product || !product.isActive || product.nodeType !== "PRODUCT") {
    return res.status(400).json({ error: "productNodeId must be an active PRODUCT node" });
  }

  const workRequestNo = await nextWorkRequestNo();
  const userId = req.session.user.id;

  const item = await prisma.workRequest.create({
    data: {
      workRequestNo,
      requestorUserId: userId,
      productNodeId: parsed.data.productNodeId,
      status: WORK_REQUEST_STATUSES.SUBMITTED,
      purpose: parsed.data.purpose,
      volumeKg: parsed.data.volumeKg,
      unitCount: parsed.data.unitCount,
      receivingAddress: parsed.data.receivingAddress,
      receivingPersonFirstname: parsed.data.receivingPersonFirstname,
      receivingPersonLastname: parsed.data.receivingPersonLastname,
      receivingPersonEmail: parsed.data.receivingPersonEmail,
      receivingPersonPhone: parsed.data.receivingPersonPhone,
      targetReceivingBy: new Date(parsed.data.targetReceivingBy),
      extraFields: parsed.data.extraFields || undefined
    }
  });

  await createAuditLog({
    actorUserId: userId,
    entityType: "work_request",
    entityId: item.id,
    action: "create_work_request",
    after: { status: WORK_REQUEST_STATUSES.SUBMITTED, workRequestNo }
  });

  await notifyOnSubmit(item.id);

  return res.status(201).json(item);
});

workRequestsRouter.get("/", async (req, res) => {
  const user = req.session.user;
  const searchNo = String(req.query?.searchNo || "").trim();
  const status = String(req.query?.status || "").trim();
  let where = {};

  if (user.role === "REQUESTOR") {
    where = { requestorUserId: user.id };
  }

  if (user.role === "STAFF") {
    where = {
      assignments: {
        some: { userId: user.id }
      }
    };
  }

  if (searchNo) {
    where = { ...where, workRequestNo: { contains: searchNo } };
  }
  if (status) {
    where = { ...where, status };
  }

  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100
  });
  const total = await prisma.workRequest.count({ where });

  const items = await prisma.workRequest.findMany({
    where,
    include: {
      productNode: {
        select: { id: true, name: true }
      },
      requestor: {
        select: { id: true, email: true }
      }
    },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });

  return res.json({ items, pagination: paginationMeta(total, page, pageSize) });
});

workRequestsRouter.get("/:id", async (req, res) => {
  const item = await prisma.workRequest.findUnique({
    where: { id: req.params.id },
    include: {
      productNode: {
        select: { id: true, name: true, parentId: true, nodeType: true }
      },
      comments: {
        include: {
          author: {
            select: { id: true, email: true, displayName: true }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      assignments: {
        include: {
          user: {
            select: { id: true, email: true, displayName: true, staffType: true }
          }
        }
      },
      tasks: true,
      handoffs: true
    }
  });

  if (!item) return res.status(404).json({ error: "Not found" });

  const user = req.session.user;
  if (user.role === "REQUESTOR" && item.requestorUserId !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (user.role === "STAFF") {
    const assigned = item.assignments.some((a) => a.userId === user.id);
    if (!assigned) return res.status(403).json({ error: "Forbidden" });
  }

  let category = "-";
  let subCategory = "-";
  let product = "-";

  if (item.productNode) {
    const names = [item.productNode.name];
    let cursorParentId = item.productNode.parentId;
    while (cursorParentId) {
      const parent = await prisma.productNode.findUnique({
        where: { id: cursorParentId },
        select: { id: true, name: true, parentId: true }
      });
      if (!parent) break;
      names.push(parent.name);
      cursorParentId = parent.parentId;
    }
    const path = names.reverse();
    category = path[0] || "-";
    product = path[path.length - 1] || "-";
    subCategory = path.length > 2 ? path.slice(1, -1).join(" > ") : "-";
  }

  return res.json({
    ...item,
    productSummary: {
      category,
      subCategory,
      product
    }
  });
});

workRequestsRouter.patch("/:id", async (req, res) => {
  if (req.session.user.role !== "REQUESTOR") {
    return res.status(403).json({ error: "Only requestors can edit requests" });
  }

  const wr = await prisma.workRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.requestorUserId !== req.session.user.id) return res.status(403).json({ error: "Forbidden" });
  if (wr.status !== WORK_REQUEST_STATUSES.SUBMITTED) {
    return res.status(400).json({ error: "Only submitted requests can be edited" });
  }

  const parsed = createWorkRequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const product = await prisma.productNode.findUnique({ where: { id: parsed.data.productNodeId } });
  if (!product || !product.isActive || product.nodeType !== "PRODUCT") {
    return res.status(400).json({ error: "productNodeId must be an active PRODUCT node" });
  }

  const updated = await prisma.workRequest.update({
    where: { id: wr.id },
    data: {
      productNodeId: parsed.data.productNodeId,
      purpose: parsed.data.purpose,
      volumeKg: parsed.data.volumeKg,
      unitCount: parsed.data.unitCount,
      receivingAddress: parsed.data.receivingAddress,
      receivingPersonFirstname: parsed.data.receivingPersonFirstname,
      receivingPersonLastname: parsed.data.receivingPersonLastname,
      receivingPersonEmail: parsed.data.receivingPersonEmail,
      receivingPersonPhone: parsed.data.receivingPersonPhone,
      targetReceivingBy: new Date(parsed.data.targetReceivingBy),
      extraFields: parsed.data.extraFields || undefined
    }
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "edit_work_request",
    before: {
      productNodeId: wr.productNodeId,
      purpose: wr.purpose,
      volumeKg: wr.volumeKg,
      unitCount: wr.unitCount,
      receivingAddress: wr.receivingAddress,
      receivingPersonFirstname: wr.receivingPersonFirstname,
      receivingPersonLastname: wr.receivingPersonLastname,
      receivingPersonEmail: wr.receivingPersonEmail,
      receivingPersonPhone: wr.receivingPersonPhone,
      targetReceivingBy: wr.targetReceivingBy
    },
    after: {
      productNodeId: updated.productNodeId,
      purpose: updated.purpose,
      volumeKg: updated.volumeKg,
      unitCount: updated.unitCount,
      receivingAddress: updated.receivingAddress,
      receivingPersonFirstname: updated.receivingPersonFirstname,
      receivingPersonLastname: updated.receivingPersonLastname,
      receivingPersonEmail: updated.receivingPersonEmail,
      receivingPersonPhone: updated.receivingPersonPhone,
      targetReceivingBy: updated.targetReceivingBy
    }
  });

  await notifyOnRequestUpdated(wr.id);

  return res.json(updated);
});

workRequestsRouter.delete("/:id", async (req, res) => {
  if (req.session.user.role !== "REQUESTOR") {
    return res.status(403).json({ error: "Only requestors can delete requests" });
  }

  const wr = await prisma.workRequest.findUnique({
    where: { id: req.params.id },
    include: {
      requestor: true,
      assignments: { include: { user: true, assignedByUser: true } }
    }
  });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.requestorUserId !== req.session.user.id) return res.status(403).json({ error: "Forbidden" });
  if (wr.status !== WORK_REQUEST_STATUSES.SUBMITTED) {
    return res.status(400).json({ error: "Only submitted requests can be deleted" });
  }

  const allNodes = await prisma.productNode.findMany({
    select: { id: true, name: true, parentId: true }
  });
  const nodesById = new Map(allNodes.map((n) => [n.id, n]));
  const names = [];
  let current = nodesById.get(wr.productNodeId);
  while (current) {
    names.push(current.name);
    current = current.parentId ? nodesById.get(current.parentId) : null;
  }
  const snapshot = {
    item: wr,
    path: names.reverse().join(" > ")
  };

  await prisma.$transaction(async (tx) => {
    await tx.taskHandoff.deleteMany({ where: { workRequestId: wr.id } });
    await tx.comment.deleteMany({ where: { workRequestId: wr.id } });
    await tx.task.deleteMany({ where: { workRequestId: wr.id } });
    await tx.workRequestAssignment.deleteMany({ where: { workRequestId: wr.id } });
    await tx.workRequest.delete({ where: { id: wr.id } });
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "work_request",
    entityId: wr.id,
    action: "delete_work_request_by_requestor",
    before: { workRequestNo: wr.workRequestNo, status: wr.status }
  });

  await notifyOnRequestDeleted(snapshot);

  return res.json({ ok: true });
});
