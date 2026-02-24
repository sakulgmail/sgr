-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REQUESTOR', 'SALES_MANAGER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('PRODUCTION_ENGINEER', 'PURCHASING', 'LOGISTICS');

-- CreateEnum
CREATE TYPE "ProductNodeType" AS ENUM ('CATEGORY', 'SUBCATEGORY', 'PRODUCT');

-- CreateEnum
CREATE TYPE "WorkRequestStatus" AS ENUM ('submitted', 'rejected', 'approved', 'preparing_goods_sampling', 'ready_to_ship', 'shipped');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('active', 'acknowledged', 'finished');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('requestor_note', 'manager_decision', 'staff_ack', 'staff_finish', 'handoff', 'system', 'status_reset');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "staffType" "StaffType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "nodeType" "ProductNodeType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "workRequestNo" TEXT NOT NULL,
    "requestorUserId" TEXT NOT NULL,
    "productNodeId" TEXT NOT NULL,
    "status" "WorkRequestStatus" NOT NULL,
    "purpose" TEXT NOT NULL,
    "volumeKg" DECIMAL(12,3) NOT NULL,
    "unitCount" INTEGER NOT NULL,
    "receivingAddress" TEXT NOT NULL,
    "receivingPersonFirstname" TEXT NOT NULL,
    "receivingPersonLastname" TEXT NOT NULL,
    "receivingPersonEmail" TEXT NOT NULL,
    "receivingPersonPhone" TEXT NOT NULL,
    "targetReceivingBy" DATE NOT NULL,
    "dhlTrackingUrl" TEXT,
    "extraFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRequestAssignment" (
    "id" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedRole" "StaffType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkRequestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "taskRole" "StaffType" NOT NULL,
    "state" "TaskState" NOT NULL DEFAULT 'active',
    "acknowledgedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskHandoff" (
    "id" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "commentType" "CommentType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ProductNode_parentId_idx" ON "ProductNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkRequest_workRequestNo_key" ON "WorkRequest"("workRequestNo");

-- CreateIndex
CREATE INDEX "WorkRequest_status_createdAt_idx" ON "WorkRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkRequest_requestorUserId_createdAt_idx" ON "WorkRequest"("requestorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkRequestAssignment_workRequestId_idx" ON "WorkRequestAssignment"("workRequestId");

-- CreateIndex
CREATE INDEX "WorkRequestAssignment_userId_idx" ON "WorkRequestAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkRequestAssignment_workRequestId_userId_key" ON "WorkRequestAssignment"("workRequestId", "userId");

-- CreateIndex
CREATE INDEX "Task_assigneeUserId_state_idx" ON "Task"("assigneeUserId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workRequestId_assigneeUserId_key" ON "Task"("workRequestId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "TaskHandoff_workRequestId_idx" ON "TaskHandoff"("workRequestId");

-- CreateIndex
CREATE INDEX "Comment_workRequestId_createdAt_idx" ON "Comment"("workRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "ProductNode" ADD CONSTRAINT "ProductNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_requestorUserId_fkey" FOREIGN KEY ("requestorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_productNodeId_fkey" FOREIGN KEY ("productNodeId") REFERENCES "ProductNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequestAssignment" ADD CONSTRAINT "WorkRequestAssignment_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "WorkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequestAssignment" ADD CONSTRAINT "WorkRequestAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequestAssignment" ADD CONSTRAINT "WorkRequestAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "WorkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHandoff" ADD CONSTRAINT "TaskHandoff_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "WorkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHandoff" ADD CONSTRAINT "TaskHandoff_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHandoff" ADD CONSTRAINT "TaskHandoff_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "WorkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
