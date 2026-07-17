import { Router } from "express";
import { existsSync } from "fs";
import { resolve } from "path";
import * as ctrl from "../controllers/agentController.js";
import { agentAuthMiddleware } from "../middlewares/agentAuth.js";

const router = Router();

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

// ── Agent-token-authenticated (desktop agent) ─────────────────────────────────
router.get("/agent/status", agentAuthMiddleware, ctrl.getStatus);
router.post("/agent/upload-excel", agentAuthMiddleware, ...ctrl.uploadExcel);
router.post("/agent/folders", agentAuthMiddleware, ctrl.updateFolders);
router.get("/agent/logs", agentAuthMiddleware, ctrl.getLogs);

export default router;
