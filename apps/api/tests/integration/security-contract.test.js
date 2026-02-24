import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function loginAs(agent, email, password) {
  const csrfRes = await agent.get("/api/auth/csrf-token");
  const csrfToken = csrfRes.body.csrfToken;
  const res = await agent
    .post("/api/auth/login")
    .set("x-csrf-token", csrfToken)
    .send({ email, password });
  expect(res.status).toBe(200);
  return csrfToken;
}

describe("security and contract integration", () => {
  const created = {
    userIds: [],
    nodeIds: [],
    workRequestIds: []
  };

  afterEach(async () => {
    if (created.workRequestIds.length) {
      await prisma.taskHandoff.deleteMany({ where: { workRequestId: { in: created.workRequestIds } } });
      await prisma.comment.deleteMany({ where: { workRequestId: { in: created.workRequestIds } } });
      await prisma.task.deleteMany({ where: { workRequestId: { in: created.workRequestIds } } });
      await prisma.workRequestAssignment.deleteMany({ where: { workRequestId: { in: created.workRequestIds } } });
      await prisma.workRequest.deleteMany({ where: { id: { in: created.workRequestIds } } });
      created.workRequestIds = [];
    }

    if (created.userIds.length) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: { in: created.userIds } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: created.userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
      created.userIds = [];
    }

    if (created.nodeIds.length) {
      await prisma.productNode.deleteMany({ where: { id: { in: created.nodeIds } } });
      created.nodeIds = [];
    }
  });

  it("rejects state-changing requests without CSRF token", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: `${uid("req")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    created.userIds.push(user.id);

    const agent = request.agent(app);
    const loginWithoutCsrf = await agent
      .post("/api/auth/login")
      .send({ email: user.email, password });
    expect(loginWithoutCsrf.status).toBe(403);
    expect(loginWithoutCsrf.body.error).toMatch(/CSRF/i);
  });

  it("returns standardized pagination metadata on list endpoints", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: `${uid("req")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    created.userIds.push(user.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    // Seed 3 requests for pagination contract.
    for (let i = 0; i < 3; i += 1) {
      const wr = await prisma.workRequest.create({
        data: {
          workRequestNo: `GSR-PAGE-${Date.now()}-${i}`,
          requestorUserId: user.id,
          productNodeId: product.id,
          status: "submitted",
          purpose: "Pagination test",
          volumeKg: 1.0,
          unitCount: 1,
          receivingAddress: "Address",
          receivingPersonFirstname: "A",
          receivingPersonLastname: "B",
          receivingPersonEmail: "ab@test.local",
          receivingPersonPhone: "123",
          targetReceivingBy: new Date("2026-03-01")
        }
      });
      created.workRequestIds.push(wr.id);
    }

    const agent = request.agent(app);
    await loginAs(agent, user.email, password);
    const res = await agent.get("/api/work-requests?page=1&pageSize=2");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toBeTruthy();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  it("writes audit logs for create and approve workflow actions", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const requestor = await prisma.user.create({
      data: { email: `${uid("req")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const manager = await prisma.user.create({
      data: { email: `${uid("mgr")}@test.local`, displayName: "Mgr", role: "SALES_MANAGER", passwordHash: hash, isActive: true }
    });
    const staff = await prisma.user.create({
      data: {
        email: `${uid("staff")}@test.local`,
        displayName: "Staff",
        role: "STAFF",
        staffType: "PRODUCTION_ENGINEER",
        passwordHash: hash,
        isActive: true
      }
    });
    created.userIds.push(requestor.id, manager.id, staff.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    const reqAgent = request.agent(app);
    const mgrAgent = request.agent(app);
    const reqCsrf = await loginAs(reqAgent, requestor.email, password);
    const mgrCsrf = await loginAs(mgrAgent, manager.email, password);

    const createRes = await reqAgent
      .post("/api/work-requests")
      .set("x-csrf-token", reqCsrf)
      .send({
        productNodeId: product.id,
        purpose: "Audit test",
        volumeKg: 1.0,
        unitCount: 1,
        receivingAddress: "Address",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: "2026-03-01"
      });
    expect(createRes.status).toBe(201);
    const wrId = createRes.body.id;
    created.workRequestIds.push(wrId);

    const approveRes = await mgrAgent
      .post(`/api/manager/work-requests/${wrId}/approve`)
      .set("x-csrf-token", mgrCsrf)
      .send({
        assignees: [staff.id],
        comment: "approve for audit"
      });
    expect(approveRes.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "work_request",
        entityId: wrId
      }
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("create_work_request");
    expect(actions).toContain("approve");
  });
});
