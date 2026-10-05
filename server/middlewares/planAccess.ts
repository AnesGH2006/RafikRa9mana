import type { Request, Response, NextFunction } from "express";

const FREE_TIER_PATHS = [
  /^\/school(?:\/|$)/,
  /^\/students(?:\/|$)/,
  /^\/stats$/,
  /^\/results(?:\/|$)/,
  /^\/grades(?:\/|$)/,
  /^\/health$/,
];

export function requirePaidPlan(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || !req.isAuthenticated() || user.role === "admin" || req.memberContext?.role === "parent") {
    next();
    return;
  }
  const plan = req.memberContext?.role === "teacher"
    ? req.memberContext.schoolSubscriptionPlan
    : user.subscriptionPlan;
  const status = req.memberContext?.role === "teacher"
    ? req.memberContext.schoolSubscriptionStatus
    : user.subscriptionStatus;
  if (plan === "basic" || plan === "pro") {
    next();
    return;
  }
  if (plan === "free" && status === "active" && FREE_TIER_PATHS.some(path => path.test(req.path))) {
    next();
    return;
  }
  res.status(403).json({ error: "This feature requires a paid subscription", requiredPlan: "basic" });
}
