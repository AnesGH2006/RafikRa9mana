import { Router, type Request, type Response, type NextFunction } from "express";
import { existsSync } from "fs";
import { resolve } from "path";
import * as ctrl from "../controllers/agentController.js";
import { agentAuthMiddleware } from "../middlewares/agentAuth.js";

const router = Router();

// ── CORS for agent endpoints (Electron app uses Bearer token, not cookies) ────
// Allow any origin so the desktop agent (file:// origin) can reach these routes.
function agentCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
}

// ── Installer download ────────────────────────────────────────────────────────
router.get("/agent/download", (req, res) => {
  // Serve pre-built installer from agent/dist/ if it exists
  const candidates = [
    resolve(process.cwd(), "agent/dist/SchoolManagerAgent-Setup.exe"),
    resolve(process.cwd(), "agent/dist/SchoolManagerAgent Setup.exe"),
  ];
  const found = candidates.find(p => existsSync(p));
  if (found) {
    res.download(found, "SchoolManagerAgent-Setup.exe");
  } else {
    res.status(503).json({
      error: "installer_not_built",
      message: "المثبّت غير متوفر بعد. يجب بناؤه من جهاز Windows أولاً عبر: cd agent && npm install && npm run build:win",
    });
  }
});

// ── Session-authenticated (school admin via web app) ──────────────────────────
router.post("/agent/token", ctrl.createToken);
router.get("/agent/tokens", ctrl.listTokens);
router.delete("/agent/tokens/:id", ctrl.revokeToken);

// ── Agent-token-authenticated (desktop agent) — CORS open, Bearer token guards ─
// Preflight OPTIONS for each endpoint (bare wildcard * is invalid in path-to-regexp v8)
router.options("/agent/status",        agentCors);
router.options("/agent/upload-excel",  agentCors);
router.options("/agent/folders",       agentCors);
router.options("/agent/logs",          agentCors);

router.get("/agent/status",        agentCors, agentAuthMiddleware, ctrl.getStatus);
router.post("/agent/upload-excel", agentCors, agentAuthMiddleware, ...ctrl.uploadExcel);
router.post("/agent/folders",      agentCors, agentAuthMiddleware, ctrl.updateFolders);
router.get("/agent/logs",          agentCors, agentAuthMiddleware, ctrl.getLogs);

export default router;
