import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getSession, getSessionId } from "../lib/auth.js";
import { db, schoolMembersTable, usersTable } from "../../shared/db.js";
import type { AuthUser, MemberContext } from "../../shared/types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      memberContext?: MemberContext;
      isAuthenticated(): boolean;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sid = getSessionId(req);

  if (!sid) {
    req.isAuthenticated = () => false;
    next();
    return;
  }

  const session = await getSession(sid);

  if (!session) {
    req.isAuthenticated = () => false;
    next();
    return;
  }

  // Keep authorization state current after asynchronous payment webhooks.
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);
  req.user = currentUser
    ? {
        ...session.user,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        profileImageUrl: currentUser.profileImageUrl,
        role: currentUser.role,
        subscriptionStatus: currentUser.subscriptionStatus,
        subscriptionPlan: currentUser.subscriptionPlan as AuthUser["subscriptionPlan"],
        subscriptionExpiresAt: currentUser.subscriptionExpiresAt?.toISOString() ?? null,
      }
    : session.user;
  req.isAuthenticated = () => true;

  // Enrich with member context if this user is a teacher/parent sub-account
  try {
    const [member] = await db
      .select()
      .from(schoolMembersTable)
      .where(eq(schoolMembersTable.memberUserId, session.user.id))
      .limit(1);

    if (member) {
      req.memberContext = {
        memberId: member.id,
        schoolUserId: member.schoolUserId,
        role: member.role as "teacher" | "parent",
        assignedClasses: (member.assignedClasses as string[]) ?? [],
        linkedStudentId: member.linkedStudentId ?? null,
        name: member.name,
      };
      if (member.role === "teacher") {
        const [schoolOwner] = await db.select({
          subscriptionPlan: usersTable.subscriptionPlan,
          subscriptionStatus: usersTable.subscriptionStatus,
        })
          .from(usersTable)
          .where(eq(usersTable.id, member.schoolUserId))
          .limit(1);
        if (schoolOwner) {
          req.memberContext.schoolSubscriptionPlan = schoolOwner.subscriptionPlan as AuthUser["subscriptionPlan"];
          req.memberContext.schoolSubscriptionStatus = schoolOwner.subscriptionStatus;
        }
      }
    }
  } catch {
    // Non-fatal — if DB is unavailable, proceed without member context
  }

  next();
}
