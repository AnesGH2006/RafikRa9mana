import * as zod from "zod";

export const HealthCheckResponse = zod.object({
  status: zod.string(),
});

export const GetCurrentAuthUserResponse = zod.object({
  user: zod.union([
    zod.object({
      id: zod.string(),
      email: zod.string().email().nullable(),
      firstName: zod.string().nullable(),
      lastName: zod.string().nullable(),
      profileImageUrl: zod.string().nullable(),
    }),
    zod.null(),
  ]),
});

export const ExchangeMobileAuthorizationCodeBody = zod.object({
  code: zod.string().min(1),
  code_verifier: zod.string().min(1),
  redirect_uri: zod.string().url().min(1),
  state: zod.string().min(1),
  nonce: zod.string().min(1).optional(),
});

export const ExchangeMobileAuthorizationCodeResponse = zod.object({
  token: zod.string(),
});

export const LogoutMobileSessionResponse = zod.object({
  success: zod.boolean(),
});

export const ListSubscriptionPlansResponseItem = zod.object({
  id: zod.string(),
  name: zod.string(),
  nameAr: zod.string(),
  nameFr: zod.string(),
  priceDA: zod.number(),
  priceYear: zod.string(),
  features: zod.array(zod.string()),
  featuresAr: zod.array(zod.string()),
  featuresFr: zod.array(zod.string()),
});
export const ListSubscriptionPlansResponse = zod.array(ListSubscriptionPlansResponseItem);

export const GetMySubscriptionResponse = zod.object({
  plan: zod.string(),
  schoolMode: zod.string(),
  activatedAt: zod.string(),
  expiresAt: zod.string().nullish(),
});

export const ActivateSubscriptionBody = zod.object({
  plan: zod.enum(["gratuit", "standard", "pro", "max"]),
  schoolMode: zod.enum(["cem", "lycee"]),
});

export const ActivateSubscriptionResponse = zod.object({
  plan: zod.string(),
  schoolMode: zod.string(),
  activatedAt: zod.string(),
  expiresAt: zod.string().nullish(),
});

export const UploadGradesResponse = zod.object({
  students: zod.array(
    zod.object({
      name: zod.string(),
      subjects: zod.record(zod.string(), zod.number()),
      average: zod.number(),
      passed: zod.boolean(),
      rank: zod.number(),
    }),
  ),
  summary: zod.object({
    classAverage: zod.number(),
    highestAverage: zod.number(),
    lowestAverage: zod.number(),
    passRate: zod.number(),
    passCount: zod.number(),
    failCount: zod.number(),
    topStudent: zod.string(),
    weakestStudent: zod.string(),
  }),
  fileName: zod.string(),
  totalStudents: zod.number(),
  schoolMode: zod.string(),
  subjects: zod.array(zod.string()),
});

export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};
