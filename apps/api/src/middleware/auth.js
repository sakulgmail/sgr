export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

export function requireRoles(allowedRoles) {
  return function roleGuard(req, res, next) {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: "Unauthorized" });
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
