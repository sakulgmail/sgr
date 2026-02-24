import dotenv from "dotenv";

dotenv.config();

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  apiPort: Number(process.env.API_PORT || 4000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET || "change_me",
  databaseUrl: process.env.DATABASE_URL || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "",
  smtpTls: toBool(process.env.SMTP_TLS, true),
  manufacturingGroupEmail: process.env.MANUFACTURING_GROUP_EMAIL || "",
  resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES || 30)
};
