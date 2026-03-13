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

describe("workflow integration", () => {
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

  it("runs submit -> approve -> acknowledge/finish -> ship", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const requestor = await prisma.user.create({
      data: { email: `${uid("requestor")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const manager = await prisma.user.create({
      data: { email: `${uid("manager")}@test.local`, displayName: "Mgr", role: "SALES_MANAGER", passwordHash: hash, isActive: true }
    });
    const production = await prisma.user.create({
      data: {
        email: `${uid("prod")}@test.local`,
        displayName: "Prod",
        role: "STAFF",
        staffType: "PRODUCTION_ENGINEER",
        passwordHash: hash,
        isActive: true
      }
    });
    const logistics = await prisma.user.create({
      data: {
        email: `${uid("logi")}@test.local`,
        displayName: "Logi",
        role: "STAFF",
        staffType: "LOGISTICS",
        passwordHash: hash,
        isActive: true
      }
    });
    created.userIds.push(requestor.id, manager.id, production.id, logistics.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    const requestorAgent = request.agent(app);
    const managerAgent = request.agent(app);
    const productionAgent = request.agent(app);
    const logisticsAgent = request.agent(app);

    const reqCsrf = await loginAs(requestorAgent, requestor.email, password);
    const managerCsrf = await loginAs(managerAgent, manager.email, password);
    const prodCsrf = await loginAs(productionAgent, production.email, password);
    const logiCsrf = await loginAs(logisticsAgent, logistics.email, password);

    const createRes = await requestorAgent
      .post("/api/work-requests")
      .set("x-csrf-token", reqCsrf)
      .send({
        productNodeId: product.id,
        purpose: "Workflow test",
        volumeKg: 1.5,
        unitCount: 2,
        receivingAddress: "Test street",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: "2026-03-01"
      });
    expect(createRes.status).toBe(201);
    const wrId = createRes.body.id;
    created.workRequestIds.push(wrId);

    const approveRes = await managerAgent
      .post(`/api/manager/work-requests/${wrId}/approve`)
      .set("x-csrf-token", managerCsrf)
      .send({
        assignees: [production.id, logistics.id],
        comment: "approved"
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("approved");

    const prodTasksRes = await productionAgent.get("/api/tasks/my");
    expect(prodTasksRes.status).toBe(200);
    const prodTask = prodTasksRes.body.items.find((t) => t.workRequestId === wrId);
    expect(prodTask).toBeTruthy();

    const logiTasksRes = await logisticsAgent.get("/api/tasks/my");
    expect(logiTasksRes.status).toBe(200);
    const logiTask = logiTasksRes.body.items.find((t) => t.workRequestId === wrId);
    expect(logiTask).toBeTruthy();

    const ackProd = await productionAgent
      .post(`/api/tasks/${prodTask.id}/acknowledge`)
      .set("x-csrf-token", prodCsrf)
      .send({ comment: "ack prod" });
    expect(ackProd.status).toBe(200);

    const ackLogi = await logisticsAgent
      .post(`/api/tasks/${logiTask.id}/acknowledge`)
      .set("x-csrf-token", logiCsrf)
      .send({ comment: "ack logi" });
    expect(ackLogi.status).toBe(200);

    const finishProd = await productionAgent
      .post(`/api/tasks/${prodTask.id}/finish`)
      .set("x-csrf-token", prodCsrf)
      .send({
        comment: "finish prod",
        handoff_comment: "handoff to logistics",
        handoff_to_user_ids: [logistics.id]
      });
    expect(finishProd.status).toBe(200);

    const finishLogi = await logisticsAgent
      .post(`/api/tasks/${logiTask.id}/finish`)
      .set("x-csrf-token", logiCsrf)
      .send({ comment: "finish logi" });
    expect(finishLogi.status).toBe(200);

    const detailsBeforeShip = await managerAgent.get(`/api/work-requests/${wrId}`);
    expect(detailsBeforeShip.status).toBe(200);
    expect(detailsBeforeShip.body.status).toBe("ready_to_ship");

    const shipRes = await logisticsAgent
      .post(`/api/manager/work-requests/${wrId}/ship`)
      .set("x-csrf-token", logiCsrf)
      .send({ dhlTrackingUrl: "https://www.dhl.com/test-tracking" });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.status).toBe("shipped");
  });

  it("rejects finishing a task before acknowledgement", async () => {
    const password = "TestPass123!";
    const hash = await bcrypt.hash(password, 12);

    const requestor = await prisma.user.create({
      data: { email: `${uid("requestor")}@test.local`, displayName: "Req", role: "REQUESTOR", passwordHash: hash, isActive: true }
    });
    const manager = await prisma.user.create({
      data: { email: `${uid("manager")}@test.local`, displayName: "Mgr", role: "SALES_MANAGER", passwordHash: hash, isActive: true }
    });
    const production = await prisma.user.create({
      data: {
        email: `${uid("prod")}@test.local`,
        displayName: "Prod",
        role: "STAFF",
        staffType: "PRODUCTION_ENGINEER",
        passwordHash: hash,
        isActive: true
      }
    });
    created.userIds.push(requestor.id, manager.id, production.id);

    const category = await prisma.productNode.create({
      data: { name: uid("cat"), nodeType: "CATEGORY", sortOrder: 1, isActive: true }
    });
    const product = await prisma.productNode.create({
      data: { name: uid("product"), nodeType: "PRODUCT", parentId: category.id, sortOrder: 1, isActive: true }
    });
    created.nodeIds.push(category.id, product.id);

    const requestorAgent = request.agent(app);
    const managerAgent = request.agent(app);
    const productionAgent = request.agent(app);

    const reqCsrf = await loginAs(requestorAgent, requestor.email, password);
    const managerCsrf = await loginAs(managerAgent, manager.email, password);
    const prodCsrf = await loginAs(productionAgent, production.email, password);

    const createRes = await requestorAgent
      .post("/api/work-requests")
      .set("x-csrf-token", reqCsrf)
      .send({
        productNodeId: product.id,
        purpose: "Finish without ack test",
        volumeKg: 1.5,
        unitCount: 2,
        receivingAddress: "Test street",
        receivingPersonFirstname: "A",
        receivingPersonLastname: "B",
        receivingPersonEmail: "ab@test.local",
        receivingPersonPhone: "123",
        targetReceivingBy: "2026-03-01"
      });
    expect(createRes.status).toBe(201);
    const wrId = createRes.body.id;
    created.workRequestIds.push(wrId);

    const approveRes = await managerAgent
      .post(`/api/manager/work-requests/${wrId}/approve`)
      .set("x-csrf-token", managerCsrf)
      .send({
        assignees: [production.id],
        comment: "approved"
      });
    expect(approveRes.status).toBe(200);

    const prodTasksRes = await productionAgent.get("/api/tasks/my");
    expect(prodTasksRes.status).toBe(200);
    const prodTask = prodTasksRes.body.items.find((t) => t.workRequestId === wrId);
    expect(prodTask).toBeTruthy();
    expect(prodTask.state).toBe("active");

    const finishRes = await productionAgent
      .post(`/api/tasks/${prodTask.id}/finish`)
      .set("x-csrf-token", prodCsrf)
      .send({ comment: "finish prod" });
    expect(finishRes.status).toBe(400);
    expect(finishRes.body.error).toBe("Task must be acknowledged before finishing");
  });
});
