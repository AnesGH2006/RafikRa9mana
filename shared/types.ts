export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  priceDA: number;
  priceYear: string;
  features: string[];
  featuresAr: string[];
  featuresFr: string[];
}

export interface MySubscription {
  plan: string;
  schoolMode: string;
  activatedAt: string;
  expiresAt?: string | null;
}

export type StudentResultSubjects = { [key: string]: number };

export interface StudentResult {
  name: string;
  subjects: StudentResultSubjects;
  average: number;
  passed: boolean;
  rank: number;
}

export interface GradeSummary {
  classAverage: number;
  highestAverage: number;
  lowestAverage: number;
  passRate: number;
  passCount: number;
  failCount: number;
  topStudent: string;
  weakestStudent: string;
}

export interface GradeAnalysisResult {
  students: StudentResult[];
  summary: GradeSummary;
  fileName: string;
  totalStudents: number;
  schoolMode: string;
  subjects: string[];
}
