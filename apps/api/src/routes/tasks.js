import { Router } from "express";
import { prisma } from "../config/db.js";
import { WORK_REQUEST_STATUSES } from "../services/state-machine.js";
import { createAuditLog } from "../services/audit.js";
import { notifyGroupUpdate, notifyHandoff } from "../services/notifications.js";
import { taskAcknowledgeSchema, taskFinishSchema } from "../utils/schemas.js";
import { paginationMeta, parsePagination } from "../utils/pagination.js";

export const tasksRouter = Router();

tasksRouter.get("/my", async (req, res) => {
  const state = String(req.query?.state || "").trim();
  const requestStatus = String(req.query?.requestStatus || "").trim();
  const where = { assigneeUserId: req.session.user.id };
  if (state) where.state = state;
  if (requestStatus) where.workRequest = { is: { status: requestStatus } };
  const { page, pageSize, skip, take } = parsePagination(req.query, {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 100
  });
  const total = await prisma.task.count({ where });
  const items = await prisma.task.findMany({
    where,
    include: {
      workRequest: {
        select: {
          id: true,
          workRequestNo: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });

  const workRequestIds = Array.from(new Set(items.map((t) => t.workRequestId)));
  const handoffs = workRequestIds.length === 0 ? [] : await prisma.taskHandoff.findMany({
    where: {
      toUserId: req.session.user.id,
      workRequestId: { in: workRequestIds }
    },
    include: {
      fromUser: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const handoffsByRequestId = new Map();
  for (const handoff of handoffs) {
    const list = handoffsByRequestId.get(handoff.workRequestId) || [];
    list.push({
      id: handoff.id,
      note: handoff.note || "",
      createdAt: handoff.createdAt,
      fromUser: handoff.fromUser
    });
    handoffsByRequestId.set(handoff.workRequestId, list);
  }
  const enrichedItems = items.map((task) => ({
    ...task,
    handoffNotes: handoffsByRequestId.get(task.workRequestId) || []
  }));

  return res.json({ items: enrichedItems, pagination: paginationMeta(total, page, pageSize) });
});

tasksRouter.post("/:id/acknowledge", async (req, res) => {
  const parsed = taskAcknowledgeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (task.assigneeUserId !== req.session.user.id) return res.status(403).json({ error: "Forbidden" });
  if (task.state === "finished") return res.status(400).json({ error: "Task already finished" });

  await prisma.task.update({
    where: { id: task.id },
    data: { state: "acknowledged", acknowledgedAt: new Date() }
  });

  await prisma.comment.create({
    data: {
      workRequestId: task.workRequestId,
      authorUserId: req.session.user.id,
      commentType: "staff_ack",
      body: String(parsed.data.comment || "").trim() || "Acknowledged"
    }
  });

  const all = await prisma.task.findMany({ where: { workRequestId: task.workRequestId } });
  if (all.length > 0 && all.every((t) => t.state === "acknowledged" || t.state === "finished")) {
    await prisma.workRequest.updateMany({
      where: {
        id: task.workRequestId,
        status: { in: [WORK_REQUEST_STATUSES.APPROVED, WORK_REQUEST_STATUSES.PREPARING] }
      },
      data: { status: WORK_REQUEST_STATUSES.PREPARING }
    });
    await notifyGroupUpdate(task.workRequestId, "Preparing goods sampling");
  }

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "task",
    entityId: task.id,
    action: "acknowledge_task",
    after: { state: "acknowledged" }
  });

  return res.json({ ok: true });
});

tasksRouter.post("/:id/finish", async (req, res) => {
  const parsed = taskFinishSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const handoffToUserIds = parsed.data.handoff_to_user_ids;
  const handoffComment = parsed.data.handoff_comment || null;

  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (task.assigneeUserId !== req.session.user.id) return res.status(403).json({ error: "Forbidden" });

  const assignments = await prisma.workRequestAssignment.findMany({ where: { workRequestId: task.workRequestId } });
  const assignedIds = new Set(assignments.map((a) => a.userId));
  const invalidTarget = handoffToUserIds.find((id) => !assignedIds.has(id));
  if (invalidTarget) {
    return res.status(400).json({ error: "Handoff target must already be assigned" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { state: "finished", finishedAt: new Date() }
    });

    if (handoffToUserIds.length > 0) {
      await tx.taskHandoff.createMany({
        data: handoffToUserIds.map((toUserId) => ({
          workRequestId: task.workRequestId,
          fromUserId: req.session.user.id,
          toUserId,
          note: handoffComment
        }))
      });
      await tx.comment.create({
        data: {
          workRequestId: task.workRequestId,
          authorUserId: req.session.user.id,
          commentType: "handoff",
          body: handoffComment || `Handoff to ${handoffToUserIds.length} assignee(s)`
        }
      });
    }

    await tx.comment.create({
      data: {
        workRequestId: task.workRequestId,
        authorUserId: req.session.user.id,
        commentType: "staff_finish",
        body: String(parsed.data.comment || "").trim() || "Finished"
      }
    });

    const all = await tx.task.findMany({ where: { workRequestId: task.workRequestId } });
    if (all.length > 0 && all.every((t) => t.state === "finished")) {
      await tx.workRequest.updateMany({
        where: {
          id: task.workRequestId,
          status: { in: [WORK_REQUEST_STATUSES.PREPARING, WORK_REQUEST_STATUSES.APPROVED] }
        },
        data: { status: WORK_REQUEST_STATUSES.READY_TO_SHIP }
      });
    }
  });

  await createAuditLog({
    actorUserId: req.session.user.id,
    entityType: "task",
    entityId: task.id,
    action: "finish_task",
    after: { state: "finished", handoffToUserIds }
  });

  if (handoffToUserIds.length > 0) {
    await notifyHandoff(
      task.workRequestId,
      req.session.user.id,
      handoffToUserIds,
      handoffComment,
      null
    );
  }

  const allAfter = await prisma.task.findMany({ where: { workRequestId: task.workRequestId } });
  if (allAfter.length > 0 && allAfter.every((t) => t.state === "finished")) {
    await notifyGroupUpdate(task.workRequestId, "Ready to ship");
  }

  return res.json({ ok: true });
});
