import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser({ email, displayName, role, staffType = null, password = "ChangeMe123!" }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { displayName, role, staffType, passwordHash, isActive: true },
    create: { email, displayName, role, staffType, passwordHash, isActive: true }
  });
}

async function seedCatalog() {
  const category = await prisma.productNode.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: { name: "Food Ingredients", nodeType: "CATEGORY", isActive: true, sortOrder: 1 },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "Food Ingredients",
      nodeType: "CATEGORY",
      isActive: true,
      sortOrder: 1
    }
  });

  const sub1 = await prisma.productNode.upsert({
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {
      name: "Sweeteners",
      nodeType: "SUBCATEGORY",
      parentId: category.id,
      isActive: true,
      sortOrder: 1
    },
    create: {
      id: "00000000-0000-0000-0000-000000000102",
      name: "Sweeteners",
      nodeType: "SUBCATEGORY",
      parentId: category.id,
      isActive: true,
      sortOrder: 1
    }
  });

  await prisma.productNode.upsert({
    where: { id: "00000000-0000-0000-0000-000000000103" },
    update: {
      name: "Orange Syrup Base",
      nodeType: "PRODUCT",
      parentId: sub1.id,
      isActive: true,
      sortOrder: 1
    },
    create: {
      id: "00000000-0000-0000-0000-000000000103",
      name: "Orange Syrup Base",
      nodeType: "PRODUCT",
      parentId: sub1.id,
      isActive: true,
      sortOrder: 1
    }
  });
}

async function main() {
  await upsertUser({
    email: "admin@gsr.local",
    displayName: "Admin User",
    role: "ADMIN"
  });
  await upsertUser({
    email: "manager@gsr.local",
    displayName: "Sales Manager",
    role: "SALES_MANAGER"
  });
  await upsertUser({
    email: "requestor@gsr.local",
    displayName: "Requestor User",
    role: "REQUESTOR"
  });
  await upsertUser({
    email: "production@gsr.local",
    displayName: "Production Engineer",
    role: "STAFF",
    staffType: "PRODUCTION_ENGINEER"
  });
  await upsertUser({
    email: "purchasing@gsr.local",
    displayName: "Purchasing Staff",
    role: "STAFF",
    staffType: "PURCHASING"
  });
  await upsertUser({
    email: "logistics@gsr.local",
    displayName: "Logistics Staff",
    role: "STAFF",
    staffType: "LOGISTICS"
  });
  await seedCatalog();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
