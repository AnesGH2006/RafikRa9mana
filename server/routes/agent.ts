import { Router } from "express";
import * as ctrl from "../controllers/agentController.js";
import { agentAuthMiddleware } from "../middlewares/agentAuth.js";

const router = Router();

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
