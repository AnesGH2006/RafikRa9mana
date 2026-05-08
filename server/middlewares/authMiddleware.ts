import { type Request, type Response, type NextFunction } from "express";
import { getSession, getSessionId } from "../lib/auth.js";
import type { AuthUser } from "../../shared/types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
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

  req.user = session.user;
  req.isAuthenticated = () => true;
  next();
}
