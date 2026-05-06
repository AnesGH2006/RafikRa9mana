import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import subscriptionsRouter from "./subscriptions.js";
import gradesRouter from "./grades.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(subscriptionsRouter);
router.use(gradesRouter);

export default router;
