import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import schoolRouter from "./school.js";
import studentsRouter from "./students.js";
import gradesRouter from "./grades.js";
import bemRouter from "./bem.js";
import adminRouter from "./admin.js";
import absencesRouter from "./absences.js";
import assistantRouter from "./assistant.js";
import orientationRouter from "./orientation.js";
import agentRouter from "./agent.js";
import documentsRouter from "./documents.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schoolRouter);
router.use(studentsRouter);
router.use(gradesRouter);
router.use(bemRouter);
router.use(adminRouter);
router.use(absencesRouter);
router.use(assistantRouter);
router.use(orientationRouter);
router.use(agentRouter);
router.use(documentsRouter);

export default router;
