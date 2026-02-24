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

describe("permission and guardrail integration", () => {
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

  it("prevents requestor from viewing another requestor's request", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const req1 = await prisma.user.create({
      data: { email: `${uid("req1")}@test.local`, displayName: "Req1", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const req2 = await prisma.user.create({
      data: { email: `${uid("req2")}@test.local`, displayName: "Req2", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    created.userIds.push(req1.id, req2.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    const req1Agent = request.agent(app);
    const req2Agent = request.agent(app);
    const req1Csrf = await loginAs(req1Agent, req1.email, password);
    await loginAs(req2Agent, req2.email, password);

    const createRes = await req1Agent
      .post("/api/work-requests")
      .set("x-csrf-token", req1Csrf)
      .send({
        productNodeId: product.id,
        purpose: "Permission test",
        volumeKg: 1.2,
        unitCount: 1,
        receivingAddress: "Address",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: "2026-03-01"
      });
    expect(createRes.status).toBe(201);
    created.workRequestIds.push(createRes.body.id);

    const forbiddenRes = await req2Agent.get(`/api/work-requests/${createRes.body.id}`);
    expect(forbiddenRes.status).toBe(403);
  });

  it("prevents staff from acknowledging another staff's task", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const requestor = await prisma.user.create({
      data: { email: `${uid("req")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const manager = await prisma.user.create({
      data: { email: `${uid("mgr")}@test.local`, displayName: "Mgr", role: "SALES_MANAGER", passwordHash: hash, isActive: true }
    });
    const prod = await prisma.user.create({
      data: { email: `${uid("prod")}@test.local`, displayName: "Prod", role: "STAFF", staffType: "PRODUCTION_ENGINEER", passwordHash: hash, isActive: true }
    });
    const purch = await prisma.user.create({
      data: { email: `${uid("purch")}@test.local`, displayName: "Purch", role: "STAFF", staffType: "PURCHASING", passwordHash: hash, isActive: true }
    });
    created.userIds.push(requestor.id, manager.id, prod.id, purch.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    const reqAgent = request.agent(app);
    const mgrAgent = request.agent(app);
    const prodAgent = request.agent(app);
    const purchAgent = request.agent(app);
    const reqCsrf = await loginAs(reqAgent, requestor.email, password);
    const mgrCsrf = await loginAs(mgrAgent, manager.email, password);
    await loginAs(prodAgent, prod.email, password);
    const purchCsrf = await loginAs(purchAgent, purch.email, password);

    const createRes = await reqAgent
      .post("/api/work-requests")
      .set("x-csrf-token", reqCsrf)
      .send({
        productNodeId: product.id,
        purpose: "Permission test",
        volumeKg: 1.1,
        unitCount: 2,
        receivingAddress: "Address",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: "2026-03-01"
      });
    expect(createRes.status).toBe(201);
    created.workRequestIds.push(createRes.body.id);

    const approveRes = await mgrAgent
      .post(`/api/manager/work-requests/${createRes.body.id}/approve`)
      .set("x-csrf-token", mgrCsrf)
      .send({ assignees: [prod.id], comment: "assign prod" });
    expect(approveRes.status).toBe(200);

    const prodTasksRes = await prodAgent.get("/api/tasks/my");
    const prodTask = prodTasksRes.body.items.find((t) => t.workRequestId === createRes.body.id);
    expect(prodTask).toBeTruthy();

    const forbiddenAck = await purchAgent
      .post(`/api/tasks/${prodTask.id}/acknowledge`)
      .set("x-csrf-token", purchCsrf)
      .send({ comment: "not mine" });
    expect(forbiddenAck.status).toBe(403);
  });

  it("prevents non-admin manager from resetting shipped request status", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const manager = await prisma.user.create({
      data: { email: `${uid("mgr")}@test.local`, displayName: "Mgr", role: "SALES_MANAGER", passwordHash: hash, isActive: true }
    });
    const requestor = await prisma.user.create({
      data: { email: `${uid("req")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("prodNode"), nodeType: "PRODUCT", isActive: true, sortOrder: 1 }
    });
    created.userIds.push(manager.id, requestor.id);
    created.nodeIds.push(product.id);

    const wr = await prisma.workRequest.create({
      data: {
        workRequestNo: `GSR-TEST-${Date.now()}`,
        requestorUserId: requestor.id,
        productNodeId: product.id,
        status: "shipped",
        purpose: "Guardrail test",
        volumeKg: 1.0,
        unitCount: 1,
        receivingAddress: "Address",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: new Date("2026-03-01"),
        dhlTrackingUrl: "https://www.dhl.com/test"
      }
    });
    created.workRequestIds.push(wr.id);

    const mgrAgent = request.agent(app);
    const mgrCsrf = await loginAs(mgrAgent, manager.email, password);
    const resetRes = await mgrAgent
      .post(`/api/manager/work-requests/${wr.id}/reset-status`)
      .set("x-csrf-token", mgrCsrf)
      .send({ toStatus: "approved", reason: "try reset shipped" });

    expect(resetRes.status).toBe(403);
  });
});
