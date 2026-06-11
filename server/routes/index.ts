import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import schoolRouter from "./school.js";
import studentsRouter from "./students.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schoolRouter);
router.use(studentsRouter);

export default router;
