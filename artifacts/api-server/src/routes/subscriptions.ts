import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import {
  ListSubscriptionPlansResponse,
  GetMySubscriptionResponse,
  ActivateSubscriptionBody,
  ActivateSubscriptionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PLANS = [
  {
    id: "gratuit",
    name: "Trial",
    nameAr: "تجريبي",
    nameFr: "Essai",
    priceDA: 0,
    priceYear: "Gratuit",
    features: [
      "Upload 1 file at a time",
      "CEM mode only",
      "Basic stats (average, pass/fail)",
      "Up to 15 students",
    ],
    featuresAr: [
      "رفع ملف واحد في كل مرة",
      "وضع التعليم المتوسط فقط",
      "إحصائيات أساسية (المعدل، النجاح/الرسوب)",
      "حتى 15 تلميذ",
    ],
    featuresFr: [
      "Importer un fichier à la fois",
      "Mode CEM uniquement",
      "Statistiques de base (moyenne, réussite/échec)",
      "Jusqu'à 15 élèves",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    nameAr: "العادية",
    nameFr: "Standard",
    priceDA: 2000,
    priceYear: "2000 DA / an",
    features: [
      "Unlimited file uploads",
      "CEM mode",
      "Full stats & ranking",
      "Unlimited students",
      "Export results",
    ],
    featuresAr: [
      "رفع ملفات غير محدودة",
      "وضع التعليم المتوسط",
      "إحصائيات كاملة والترتيب",
      "عدد غير محدود من التلاميذ",
      "تصدير النتائج",
    ],
    featuresFr: [
      "Importation illimitée de fichiers",
      "Mode CEM",
      "Statistiques complètes et classement",
      "Nombre illimité d'élèves",
      "Exporter les résultats",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    nameAr: "الاحترافية",
    nameFr: "Pro",
    priceDA: 3000,
    priceYear: "3000 DA / an",
    features: [
      "Everything in Standard",
      "Both CEM & Lycée modes",
      "Advanced analytics",
      "Priority support",
    ],
    featuresAr: [
      "كل ما في الباقة العادية",
      "وضعَي المتوسط والثانوي",
      "تحليلات متقدمة",
      "دعم ذو أولوية",
    ],
    featuresFr: [
      "Tout ce qui est dans Standard",
      "Modes CEM et Lycée",
      "Analyses avancées",
      "Support prioritaire",
    ],
  },
  {
    id: "max",
    name: "Max",
    nameAr: "الشاملة",
    nameFr: "Max",
    priceDA: 5000,
    priceYear: "5000 DA / an",
    features: [
      "Everything in Pro",
      "Multi-class comparison",
      "Historical data across terms",
      "Custom subject columns",
      "Dedicated support",
    ],
    featuresAr: [
      "كل ما في الباقة الاحترافية",
      "مقارنة بين الأقسام",
      "بيانات تاريخية عبر الفصول",
      "أعمدة مواد مخصصة",
      "دعم مخصص",
    ],
    featuresFr: [
      "Tout ce qui est dans Pro",
      "Comparaison multi-classes",
      "Données historiques par trimestre",
      "Colonnes de matières personnalisées",
      "Support dédié",
    ],
  },
];

router.get("/subscriptions/plans", (_req, res): void => {
  res.json(ListSubscriptionPlansResponse.parse(PLANS));
});

router.get("/subscriptions/my", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.json(
      GetMySubscriptionResponse.parse({
        plan: "gratuit",
        schoolMode: "cem",
        activatedAt: new Date().toISOString(),
        expiresAt: null,
      }),
    );
    return;
  }

  res.json(
    GetMySubscriptionResponse.parse({
      plan: sub.plan,
      schoolMode: sub.schoolMode,
      activatedAt: sub.activatedAt.toISOString(),
      expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
    }),
  );
});

router.post("/subscriptions/activate", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = ActivateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan or school mode" });
    return;
  }

  const { plan, schoolMode } = parsed.data;
  const userId = req.user.id;

  const now = new Date();
  const expiresAt =
    plan === "gratuit"
      ? null
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (existing) {
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ plan, schoolMode, activatedAt: now, expiresAt, updatedAt: now })
      .where(eq(subscriptionsTable.userId, userId))
      .returning();

    res.json(
      ActivateSubscriptionResponse.parse({
        plan: updated.plan,
        schoolMode: updated.schoolMode,
        activatedAt: updated.activatedAt.toISOString(),
        expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
      }),
    );
  } else {
    const [created] = await db
      .insert(subscriptionsTable)
      .values({
        id: crypto.randomBytes(16).toString("hex"),
        userId,
        plan,
        schoolMode,
        activatedAt: now,
        expiresAt,
      })
      .returning();

    req.log.info({ userId, plan, schoolMode }, "Subscription activated");
    res.json(
      ActivateSubscriptionResponse.parse({
        plan: created.plan,
        schoolMode: created.schoolMode,
        activatedAt: created.activatedAt.toISOString(),
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      }),
    );
  }
});

export default router;
