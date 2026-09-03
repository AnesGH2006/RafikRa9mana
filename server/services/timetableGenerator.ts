export interface TimetableRequestSubject {
  subject: string;
  teacherId?: string | null;
  periods?: number;
  roomId?: string | null;
}

export interface TimetableRequestClass {
  classe: string;
  subjects: TimetableRequestSubject[];
}

export interface TimetableGenerationRules {
  workingDays?: number[];
  periodsPerDay?: number;
  blockedSlots?: Array<{ day: number; period: number }>;
  maxDailyPeriodsPerClass?: number;
  avoidConsecutiveSameSubject?: boolean;
  teacherAvailability?: Record<string, Array<{ day: number; period: number }>>;
}

export interface GeneratedTimetableSlot {
  classe: string;
  subject: string;
  teacherId: string | null;
  roomId: string | null;
  day: number;
  period: number;
}

export interface UnscheduledTimetableItem {
  classe: string;
  subject: string;
  teacherId: string | null;
  reason: string;
}

export interface TimetableGenerationResult {
  slots: GeneratedTimetableSlot[];
  unscheduled: UnscheduledTimetableItem[];
}

const SCHOOL_DAYS = 5;
const PERIODS_PER_DAY = 6;

function slotKey(day: number, period: number): string {
  return `${day}:${period}`;
}

interface PendingLesson {
  classe: string;
  subject: string;
  teacherId: string | null;
  roomId: string | null;
}

/**
 * Builds the ordered list of individual lesson placements, interleaving
 * subjects round-robin WITHIN each class (one period of subject A, one of
 * subject B, one of subject C, then back to A, ...) instead of scheduling
 * one subject to completion before starting the next.
 *
 * This matters when total requested periods exceed available capacity: with
 * a subject-by-subject ordering, the first subjects in the input list would
 * consume all available slots and later subjects would get none at all.
 * Round-robin spreads any shortage evenly across every subject instead.
 */
function buildLessonQueue(classes: TimetableRequestClass[]): PendingLesson[] {
  const lessons: PendingLesson[] = [];

  for (const entry of classes) {
    const classe = entry.classe.trim();
    const queues = entry.subjects.map((subject) => ({
      subject: subject.subject.trim(),
      teacherId: subject.teacherId ?? null,
      roomId: subject.roomId ?? null,
      remaining: Math.max(1, Math.min(30, Math.floor(subject.periods ?? 1))),
    }));

    let anyRemaining = queues.some((q) => q.remaining > 0);
    while (anyRemaining) {
      anyRemaining = false;
      for (const q of queues) {
        if (q.remaining <= 0) continue;
        lessons.push({ classe, subject: q.subject, teacherId: q.teacherId, roomId: q.roomId });
        q.remaining -= 1;
        if (q.remaining > 0) anyRemaining = true;
      }
    }
  }

  return lessons;
}

/**
 * Greedily places the most constrained lessons first. A lesson is accepted
 * only when its class, teacher, and room are all free at the same slot.
 */
export function generateTimetable(
  classes: TimetableRequestClass[],
  availableRoomIds: string[] = [],
  rules: TimetableGenerationRules = {},
): TimetableGenerationResult {
  const slots: GeneratedTimetableSlot[] = [];
  const unscheduled: UnscheduledTimetableItem[] = [];
  const classBusy = new Set<string>();
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const workingDays = [...new Set((rules.workingDays ?? [0, 1, 2, 3, 4])
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
  const periodsPerDay = Math.max(1, Math.min(10, Math.floor(rules.periodsPerDay ?? 6)));
  const blocked = new Set((rules.blockedSlots ?? []).map(slot => slotKey(slot.day, slot.period)));
  const dailyPeriods = new Map<string, number>();
  const subjectAt = new Map<string, string>();

  const teacherCanTeach = (teacherId: string | null, day: number, period: number) => {
    if (!teacherId || !rules.teacherAvailability?.[teacherId]) return true;
    return rules.teacherAvailability[teacherId]!.some(slot => slot.day === day && slot.period === period);
  };

  // Round-robin across subjects within each class, instead of exhausting
  // one subject before starting the next — see buildLessonQueue() above.
  const lessons = buildLessonQueue(classes).sort((a, b) => {
    if (a.teacherId !== b.teacherId) return a.teacherId ? -1 : 1;
    if (a.roomId !== b.roomId) return a.roomId ? -1 : 1;
    return a.classe.localeCompare(b.classe);
  });

  for (const lesson of lessons) {
    if (!lesson.classe || !lesson.subject) {
      unscheduled.push({ ...lesson, reason: "classe and subject are required" });
      continue;
    }

    let placed = false;
    for (const day of workingDays) {
      if (placed) break;
      for (let period = 0; period < periodsPerDay; period += 1) {
        const key = slotKey(day, period);
        if (blocked.has(key)) continue;
        if (classBusy.has(`${lesson.classe}:${key}`)) continue;
        if (lesson.teacherId && teacherBusy.has(`${lesson.teacherId}:${key}`)) continue;
        if (!teacherCanTeach(lesson.teacherId, day, period)) continue;
        const classDayKey = `${lesson.classe}:${day}`;
        if (rules.maxDailyPeriodsPerClass !== undefined &&
            (dailyPeriods.get(classDayKey) ?? 0) >= Math.max(1, Math.floor(rules.maxDailyPeriodsPerClass))) continue;
        if (rules.avoidConsecutiveSameSubject &&
            (subjectAt.get(`${lesson.classe}:${day}:${period - 1}`) === lesson.subject ||
             subjectAt.get(`${lesson.classe}:${day}:${period + 1}`) === lesson.subject)) continue;

        const roomId = lesson.roomId ?? availableRoomIds.find((candidate) => !roomBusy.has(`${candidate}:${key}`)) ?? null;
        if (lesson.roomId && roomBusy.has(`${lesson.roomId}:${key}`)) continue;
        if (availableRoomIds.length > 0 && !roomId) continue;

        slots.push({ ...lesson, roomId, day, period });
        classBusy.add(`${lesson.classe}:${key}`);
        dailyPeriods.set(classDayKey, (dailyPeriods.get(classDayKey) ?? 0) + 1);
        subjectAt.set(`${lesson.classe}:${day}:${period}`, lesson.subject);
        if (lesson.teacherId) teacherBusy.add(`${lesson.teacherId}:${key}`);
        if (roomId) roomBusy.add(`${roomId}:${key}`);
        placed = true;
      }
    }

    if (!placed) {
      unscheduled.push({ ...lesson, reason: "no conflict-free period is available" });
    }
  }

  return { slots, unscheduled };
}