export type SubscriptionStatus = "pending" | "active" | "suspended";
export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string | null;
}

export interface SchoolInfo {
  id: string;
  userId: string;
  nom: string;
  wilaya: string;
  commune: string;
  annee: string;
  directeur?: string | null;
  phone?: string | null;
}

export type Niveau = "1AM" | "2AM" | "3AM" | "4AM";
export type Sexe = "M" | "F";
export type Statut = "nouveau" | "redoublant";
export type Resultat = "admis" | "non_admis" | null;

export interface Student {
  id: string;
  userId: string;
  nomPrenom: string;
  dateNaissance: string | null;
  niveau: Niveau;
  classe: string;
  sexe: Sexe;
  statut: Statut;
  resultat: Resultat;
  annee: string;
}

export interface LevelStats {
  niveau: Niveau;
  total: number;
  boys: number;
  girls: number;
  admis: number;
  nonAdmis: number;
  nouveau: number;
  redoublant: number;
  avgAge: number | null;
  minAge: number | null;
  maxAge: number | null;
  ageDist: { age: number; count: number }[];
}

export interface DashboardStats {
  total: number;
  boys: number;
  girls: number;
  admis: number;
  nonAdmis: number;
  nouveau: number;
  redoublant: number;
  byLevel: LevelStats[];
}

export interface StudentsFilter {
  annee?: string;
  niveau?: Niveau;
  classe?: string;
  sexe?: Sexe;
  statut?: Statut;
  q?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  annee: string;
  trimestre: number;
  subject: string;
  score: number;
}

export interface Absence {
  id: string;
  studentId: string;
  annee: string;
  trimestre: number;
  justifiedHours: number;
  unjustifiedHours: number;
}

export interface StudentResult {
  student: Student;
  scores: Record<string, Record<string, number>>;
  t1Avg: number | null;
  t2Avg: number | null;
  t3Avg: number | null;
  annualAvg: number | null;
  passed: boolean | null;
  rank: number | null;
  totalJustified: number;
  totalUnjustified: number;
}

export interface SubjectDef {
  key: string;
  arLabel: string;
  coef: number;
  levels?: Niveau[];
}

export interface SubjectAverage {
  subject: string;
  arLabel: string;
  avg: number;
  min: number;
  max: number;
  passCount: number;
  total: number;
}
