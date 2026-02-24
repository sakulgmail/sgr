import { prisma } from "../config/db.js";
import { sendEmail } from "./email.js";
import { getSystemSettings } from "./settings.js";

function productPath(nodesById, nodeId) {
  const names = [];
  let current = nodesById.get(nodeId);
  while (current) {
    names.push(current.name);
    current = current.parentId ? nodesById.get(current.parentId) : null;
  }
  return names.reverse().join(" > ");
}

async function loadSummary(workRequestId) {
  const item = await prisma.workRequest.findUnique({
    where: { id: workRequestId },
    include: {
      requestor: true,
      assignments: { include: { user: true, assignedByUser: true } }
    }
  });
  if (!item) return null;

  const allNodes = await prisma.productNode.findMany({
    select: { id: true, name: true, parentId: true }
  });
  const nodesById = new Map(allNodes.map((n) => [n.id, n]));
  const path = productPath(nodesById, item.productNodeId);

  return { item, path };
}

function managerEmails(item, extra = []) {
  const managers = item.assignments.map((a) => a.assignedByUser?.email).filter(Boolean);
  return Array.from(new Set([...extra.filter(Boolean), ...managers]));
}

function summaryText({ item, path }, appBaseUrl) {
  return [
    `Work Request: ${item.workRequestNo}`,
    `Status: ${item.status}`,
    `Product: ${path}`,
    `Purpose: ${item.purpose}`,
    `Volume (kg): ${item.volumeKg}`,
    `Unit: ${item.unitCount}`,
    `Target receiving by: ${new Date(item.targetReceivingBy).toISOString().slice(0, 10)}`,
    `Receiving address: ${item.receivingAddress}`,
    `Receiving person: ${item.receivingPersonFirstname} ${item.receivingPersonLastname} (${item.receivingPersonEmail}, ${item.receivingPersonPhone})`,
    `Link: ${appBaseUrl}/work-requests/${item.id}`
  ].join("\n");
}

export async function notifyOnSubmit(workRequestId) {
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  const text = summaryText(summary, settings.appBaseUrl);
  await sendEmail({
    to: summary.item.requestor.email,
    subject: `Submitted: ${summary.item.workRequestNo}`,
    text
  });
  if (settings.manufacturingGroupEmail) {
    await sendEmail({
      to: settings.manufacturingGroupEmail,
      subject: `New GSR submitted: ${summary.item.workRequestNo}`,
      text
    });
  }
}

export async function notifyOnReject(workRequestId, comment) {
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  await sendEmail({
    to: summary.item.requestor.email,
    subject: `Rejected: ${summary.item.workRequestNo}`,
    text: `${summaryText(summary, settings.appBaseUrl)}\n\nRejection comment:\n${comment}`
  });
}

export async function notifyOnApprove(workRequestId, managerEmail) {
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  const text = summaryText(summary, settings.appBaseUrl);
  await sendEmail({
    to: summary.item.requestor.email,
    subject: `Approved: ${summary.item.workRequestNo}`,
    text
  });

  for (const a of summary.item.assignments) {
    await sendEmail({
      to: a.user.email,
      cc: managerEmails(summary.item, [managerEmail]).join(","),
      subject: `Assigned: ${summary.item.workRequestNo}`,
      text
    });
  }
}

export async function notifyGroupUpdate(workRequestId, subjectPrefix) {
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  const to = summary.item.assignments.map((a) => a.user.email);
  if (!to.length) return;
  await sendEmail({
    to: to.join(","),
    cc: managerEmails(summary.item).join(","),
    subject: `${subjectPrefix}: ${summary.item.workRequestNo}`,
    text: summaryText(summary, settings.appBaseUrl)
  });
}

export async function notifyHandoff(workRequestId, fromUserId, toUserIds, note, managerEmail) {
  if (!toUserIds.length) return;
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  const fromUser = await prisma.user.findUnique({ where: { id: fromUserId } });
  const targetUsers = await prisma.user.findMany({ where: { id: { in: toUserIds } } });
  for (const user of targetUsers) {
    await sendEmail({
      to: user.email,
      cc: managerEmails(summary.item, [managerEmail]).join(","),
      subject: `Handoff: ${summary.item.workRequestNo}`,
      text: `${summaryText(summary, settings.appBaseUrl)}\n\nHandoff from: ${fromUser?.displayName || fromUser?.email || fromUserId}\nTo: ${user.displayName || user.email}\nNote: ${note || "-"}`
    });
  }
}

export async function notifyOnShipped(workRequestId, dhlTrackingUrl, managerEmail) {
  const summary = await loadSummary(workRequestId);
  if (!summary) return;
  const settings = await getSystemSettings();
  const cc = [...managerEmails(summary.item, [managerEmail]), ...summary.item.assignments.map((a) => a.user.email)]
    .filter(Boolean)
    .join(",");
  await sendEmail({
    to: summary.item.requestor.email,
    cc,
    subject: `Shipped: ${summary.item.workRequestNo}`,
    text: `${summaryText(summary, settings.appBaseUrl)}\n\nDHL tracking URL: ${dhlTrackingUrl}`
  });
}
