import session from "express-session";
import { env } from "../config/env.js";

export const sessionMiddleware = session({
  name: "gsr.sid",
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
});
