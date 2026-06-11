import * as zod from "zod";

export const HealthCheckResponse = zod.object({ status: zod.string() });

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

export const ExchangeMobileAuthorizationCodeResponse = zod.object({ token: zod.string() });
export const LogoutMobileSessionResponse = zod.object({ success: zod.boolean() });

export const SchoolInfoSchema = zod.object({
  id: zod.string(),
  userId: zod.string(),
  nom: zod.string(),
  wilaya: zod.string(),
  commune: zod.string(),
  annee: zod.string(),
});

export const UpsertSchoolInfoBody = zod.object({
  nom: zod.string().min(1),
  wilaya: zod.string().min(1),
  commune: zod.string().min(1),
  annee: zod.string().min(1),
});

export const NiveauEnum = zod.enum(["1AM", "2AM", "3AM", "4AM"]);
export const SexeEnum = zod.enum(["M", "F"]);
export const StatutEnum = zod.enum(["nouveau", "redoublant"]);
export const ResultatEnum = zod.enum(["admis", "non_admis"]);

export const StudentSchema = zod.object({
  id: zod.string(),
  userId: zod.string(),
  nomPrenom: zod.string(),
  dateNaissance: zod.string().nullable(),
  niveau: NiveauEnum,
  classe: zod.string(),
  sexe: SexeEnum,
  statut: StatutEnum,
  resultat: ResultatEnum.nullable(),
  annee: zod.string(),
});

export const ListStudentsResponse = zod.object({
  students: zod.array(StudentSchema),
  total: zod.number(),
});

export const ImportStudentsResponse = zod.object({
  imported: zod.number(),
  skipped: zod.number(),
  errors: zod.array(zod.string()),
});

export const LevelStatsSchema = zod.object({
  niveau: NiveauEnum,
  total: zod.number(),
  boys: zod.number(),
  girls: zod.number(),
  admis: zod.number(),
  nonAdmis: zod.number(),
});

export const DashboardStatsResponse = zod.object({
  total: zod.number(),
  boys: zod.number(),
  girls: zod.number(),
  admis: zod.number(),
  nonAdmis: zod.number(),
  byLevel: zod.array(LevelStatsSchema),
});
