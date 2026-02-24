import crypto from "crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getOrCreateCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

export function issueCsrfToken(req, res) {
  const token = getOrCreateCsrfToken(req);
  return res.json({ csrfToken: token });
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    getOrCreateCsrfToken(req);
    return next();
  }

  const token = req.header("x-csrf-token");
  const sessionToken = req.session?.csrfToken;
  if (!sessionToken || !token || token !== sessionToken) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }

  return next();
}
