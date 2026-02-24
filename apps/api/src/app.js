import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { sessionMiddleware } from "./middleware/session.js";
import { requireAuth } from "./middleware/auth.js";
import { csrfProtection } from "./middleware/csrf.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { workRequestsRouter } from "./routes/work-requests.js";
import { tasksRouter } from "./routes/tasks.js";
import { managerRouter } from "./routes/manager.js";
import { adminRouter } from "./routes/admin.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.appBaseUrl, credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);
app.use(csrfProtection);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/catalog", requireAuth, catalogRouter);
app.use("/api/work-requests", requireAuth, workRequestsRouter);
app.use("/api/tasks", requireAuth, tasksRouter);
app.use("/api/manager", requireAuth, managerRouter);
app.use("/api/admin", requireAuth, adminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
