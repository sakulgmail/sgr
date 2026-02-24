import { Router } from "express";
import { prisma } from "../config/db.js";
import { createWorkRequestSchema } from "../utils/schemas.js";
import { WORK_REQUEST_STATUSES } from "../services/state-machine.js";
import { createAuditLog } from "../services/audit.js";
import { notifyOnSubmit } from "../services/notifications.js";
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

  return res.json(item);
});
