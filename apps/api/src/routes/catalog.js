import { Router } from "express";
import { prisma } from "../config/db.js";

export const catalogRouter = Router();

catalogRouter.get("/tree", async (_req, res) => {
  const nodes = await prisma.productNode.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return res.json({ items: nodes });
});
