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
  directeur: zod.string().nullable().optional(),
  phone: zod.string().nullable().optional(),
});

export const UpsertSchoolInfoBody = zod.object({
  nom: zod.string().min(1),
  wilaya: zod.string().min(1),
  commune: zod.string().min(1),
  annee: zod.string().min(1),
  directeur: zod.string().optional(),
  phone: zod.string().optional(),
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

export const GradeSchema = zod.object({
  id: zod.string(),
  studentId: zod.string(),
  annee: zod.string(),
  trimestre: zod.number().int().min(1).max(3),
  subject: zod.string(),
  score: zod.number().min(0).max(20),
});

export const UpsertGradeBody = zod.object({
  studentId: zod.string(),
  annee: zod.string(),
  trimestre: zod.number().int().min(1).max(3),
  subject: zod.string(),
  score: zod.number().min(0).max(20),
});

export const UpsertGradesBulkBody = zod.object({
  studentId: zod.string(),
  annee: zod.string(),
  trimestre: zod.number().int().min(1).max(3),
  grades: zod.record(zod.string(), zod.number().min(0).max(20)),
});

export const AbsenceSchema = zod.object({
  id: zod.string(),
  studentId: zod.string(),
  annee: zod.string(),
  trimestre: zod.number(),
  justifiedHours: zod.number(),
  unjustifiedHours: zod.number(),
});

export const UpsertAbsenceBody = zod.object({
  studentId: zod.string(),
  annee: zod.string(),
  trimestre: zod.number().int().min(1).max(3),
  justifiedHours: zod.number().int().min(0),
  unjustifiedHours: zod.number().int().min(0),
});

// Legacy (kept for compat)
export const UploadGradesResponse = zod.object({
  students: zod.array(zod.object({
    name: zod.string(),
    subjects: zod.record(zod.number()),
    average: zod.number(),
    passed: zod.boolean(),
    rank: zod.number(),
  })),
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
