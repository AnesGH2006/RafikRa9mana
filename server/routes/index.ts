import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import schoolRouter from "./school.js";
import studentsRouter from "./students.js";
import gradesRouter from "./grades.js";
import bemRouter from "./bem.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schoolRouter);
router.use(studentsRouter);
router.use(gradesRouter);
router.use(bemRouter);

export default router;
