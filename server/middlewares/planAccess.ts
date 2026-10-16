import type { Request, Response, NextFunction } from "express";

const FREE_TIER_PATHS = [
  /^\/school(?:\/|$)/,
  /^\/students(?:\/|$)/,
  /^\/stats$/,
  /^\/results(?:\/|$)/,
  /^\/grades(?:\/|$)/,
  /^\/health$/,
];

// Routes that must work for people who have no plan of their own:
//  - public lookups (no login, e.g. the school join-code lookup)
//  - auth endpoints
//  - parent self-registration (the parent is a normal logged-in user until this succeeds,
//    so without this exemption they would be judged like a school owner and blocked)
const ALWAYS_ALLOWED_PATHS = [
  /^\/public(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/parent-register$/,
];

export function requirePaidPlan(req: Request, res: Response, next: NextFunction): void {
  if (ALWAYS_ALLOWED_PATHS.some(path => path.test(req.path))) {
    next();
    return;
  }

  const user = req.user;
  if (!user || !req.isAuthenticated() || user.role === "admin" || req.memberContext?.role === "parent") {
    next();
    return;
  }
    const member = req.memberContext;
  const isSchoolStaff = !!member && member.role !== "parent";
  const plan = isSchoolStaff
    ? member?.schoolSubscriptionPlan
    : user.subscriptionPlan;
  const status = isSchoolStaff
    ? member?.schoolSubscriptionStatus
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