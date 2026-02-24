import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

const KEYS = {
  appBaseUrl: "app_base_url",
  manufacturingGroupEmail: "manufacturing_group_email",
  smtpHost: "smtp_host",
  smtpPort: "smtp_port",
  smtpUser: "smtp_user",
  smtpPass: "smtp_pass",
  smtpFrom: "smtp_from",
  smtpTls: "smtp_tls"
};

function boolLike(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

function numLike(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getSystemSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(KEYS) } }
  });
  const m = new Map(rows.map((r) => [r.key, r.value]));

  return {
    appBaseUrl: String(m.get(KEYS.appBaseUrl) ?? env.appBaseUrl),
    manufacturingGroupEmail: String(m.get(KEYS.manufacturingGroupEmail) ?? env.manufacturingGroupEmail),
    smtpHost: String(m.get(KEYS.smtpHost) ?? env.smtpHost),
    smtpPort: numLike(m.get(KEYS.smtpPort), env.smtpPort),
    smtpUser: String(m.get(KEYS.smtpUser) ?? env.smtpUser),
    smtpPass: String(m.get(KEYS.smtpPass) ?? env.smtpPass),
    smtpFrom: String(m.get(KEYS.smtpFrom) ?? env.smtpFrom),
    smtpTls: boolLike(m.get(KEYS.smtpTls), env.smtpTls)
  };
}

export async function upsertSettings(patch) {
  const updates = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    updates.push(
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    );
  }
  if (!updates.length) return;
  await prisma.$transaction(updates);
}

export const SettingKeys = KEYS;
