import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function groupKey(node) {
  const parent = node.parentId || "ROOT";
  return `${node.nodeType}|${parent}|${normalizeName(node.name)}`;
}

function pickCanonical(nodes) {
  return [...nodes].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const byCreated = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  })[0];
}

async function run() {
  const nodes = await prisma.productNode.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      parentId: true,
      nodeType: true,
      isActive: true,
      createdAt: true
    }
  });

  const groups = new Map();
  for (const node of nodes) {
    const key = groupKey(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }

  const updates = [];
  for (const groupNodes of groups.values()) {
    if (groupNodes.length < 2) continue;
    const canonical = pickCanonical(groupNodes);
    const duplicates = groupNodes.filter((n) => n.id !== canonical.id);
    for (const dup of duplicates) {
      updates.push({
        id: dup.id,
        oldName: dup.name,
        nodeType: dup.nodeType,
        canonicalId: canonical.id,
        canonicalName: canonical.name
      });
    }
  }

  if (updates.length === 0) {
    console.log("No duplicate catalog nodes found.");
    return;
  }

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of updates) {
      const archivedName = `${item.oldName} [archived-${item.id.slice(0, 8)}]`;
      await tx.productNode.update({
        where: { id: item.id },
        data: {
          name: archivedName,
          isActive: false
        }
      });
      changed += 1;
    }
  });

  console.log(`Archived duplicate nodes: ${changed}`);
  for (const item of updates) {
    console.log(
      `- ${item.nodeType} | old="${item.oldName}" | canonical="${item.canonicalName}" | id=${item.id} -> canonicalId=${item.canonicalId}`
    );
  }
}

run()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
