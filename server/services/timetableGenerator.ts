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

/**
 * Greedily places the most constrained lessons first. A lesson is accepted
 * only when its class, teacher, and room are all free at the same slot.
 */
export function generateTimetable(
  classes: TimetableRequestClass[],
  availableRoomIds: string[] = [],
): TimetableGenerationResult {
  const slots: GeneratedTimetableSlot[] = [];
  const unscheduled: UnscheduledTimetableItem[] = [];
  const classBusy = new Set<string>();
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();

  const lessons = classes.flatMap((entry) => entry.subjects.flatMap((subject) => {
    const periods = Math.max(1, Math.min(30, Math.floor(subject.periods ?? 1)));
    return Array.from({ length: periods }, () => ({
      classe: entry.classe.trim(),
      subject: subject.subject.trim(),
      teacherId: subject.teacherId ?? null,
      roomId: subject.roomId ?? null,
    }));
  })).sort((a, b) => {
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
    for (let day = 0; day < SCHOOL_DAYS && !placed; day += 1) {
      for (let period = 0; period < PERIODS_PER_DAY && !placed; period += 1) {
        const key = slotKey(day, period);
        if (classBusy.has(`${lesson.classe}:${key}`)) continue;
        if (lesson.teacherId && teacherBusy.has(`${lesson.teacherId}:${key}`)) continue;

        const roomId = lesson.roomId ?? availableRoomIds.find((candidate) => !roomBusy.has(`${candidate}:${key}`)) ?? null;
        if (lesson.roomId && roomBusy.has(`${lesson.roomId}:${key}`)) continue;
        if (availableRoomIds.length > 0 && !roomId) continue;

        slots.push({ ...lesson, roomId, day, period });
        classBusy.add(`${lesson.classe}:${key}`);
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
