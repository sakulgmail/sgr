import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../config/db.js";
import { loginSchema } from "../utils/schemas.js";
import { generateResetToken } from "../services/tokens.js";
import { sendEmail } from "../services/email.js";
import { env } from "../config/env.js";
import { issueCsrfToken } from "../middleware/csrf.js";

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
authRouter.use(authLimiter);

authRouter.get("/csrf-token", issueCsrfToken);

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const email = parsed.data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      staffType: user.staffType
    };

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error("Login failed", err);
    return res.status(500).json({ error: "Login failed, please try again" });
  }
});

authRouter.get("/me", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ user: req.session.user });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.isActive) {
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + env.resetTokenTtlMinutes * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    const link = `${env.appBaseUrl}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "GSR password reset",
      text: `Use this link to reset your password: ${link}`
    });
  }

  return res.json({ ok: true });
});

authRouter.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!token || newPassword.length < 8) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const reset = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } }),
    prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } })
  ]);

  return res.json({ ok: true });
});
