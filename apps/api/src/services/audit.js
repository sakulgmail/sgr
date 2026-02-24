import { prisma } from "../config/db.js";

export async function createAuditLog({ actorUserId = null, entityType, entityId, action, before = null, after = null }) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      entityType,
      entityId,
      action,
      before,
      after
    }
  });
}
