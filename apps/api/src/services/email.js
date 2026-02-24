import nodemailer from "nodemailer";
import { getSystemSettings } from "./settings.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({ to, cc, subject, text }) {
  const cfg = await getSystemSettings();
  if (!cfg.smtpHost || !cfg.smtpFrom) {
    return { skipped: true, reason: "SMTP not configured" };
  }

  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpTls && cfg.smtpPort === 465,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
    requireTLS: cfg.smtpTls
  });

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to,
        cc,
        subject,
        text
      });
      return { sent: true };
    } catch (error) {
      console.error("email_send_failed", { attempt, to, subject, error: error?.message || String(error) });
      if (attempt < maxAttempts) {
        await delay(300 * attempt);
      }
    }
  }
  return { sent: false };
}
