export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface SchoolInfo {
  id: string;
  userId: string;
  nom: string;
  wilaya: string;
  commune: string;
  annee: string;
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
}

export interface DashboardStats {
  total: number;
  boys: number;
  girls: number;
  admis: number;
  nonAdmis: number;
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
