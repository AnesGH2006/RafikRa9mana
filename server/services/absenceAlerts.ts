import { and, eq } from "drizzle-orm";
import { db, schoolMembersTable, studentsTable } from "../../shared/db.js";
import { sendPushToUser } from "./pushNotificationService.js";
import { sendSmsAlertTool } from "../lib/tools/send-sms-alert.js";
import { logger } from "../lib/logger.js";

export async function notifyParentOfAbsence(input: {
  schoolUserId: string;
  studentId: string;
  annee: string;
  date?: string;
}): Promise<{ pushSent: number; smsSent: boolean }> {
  const [student] = await db.select({
    id: studentsTable.id,
    nomPrenom: studentsTable.nomPrenom,
    parentPhone: studentsTable.parentPhone,
  }).from(studentsTable).where(and(
    eq(studentsTable.id, input.studentId),
    eq(studentsTable.userId, input.schoolUserId),
  )).limit(1);

  if (!student) return { pushSent: 0, smsSent: false };

  const absenceDate = input.date ?? new Date().toISOString().slice(0, 10);
  const message = `السيد/السيدة ولي أمر ${student.nomPrenom}: نُبلّغكم بغياب ابنكم/ابنتكم بتاريخ ${absenceDate}. يرجى التواصل مع إدارة المؤسسة.`;
  const [parent] = await db.select({ memberUserId: schoolMembersTable.memberUserId })
    .from(schoolMembersTable)
    .where(and(
      eq(schoolMembersTable.schoolUserId, input.schoolUserId),
      eq(schoolMembersTable.linkedStudentId, input.studentId),
      eq(schoolMembersTable.role, "parent"),
    )).limit(1);

  let pushSent = 0;
  if (parent?.memberUserId) {
    pushSent = await sendPushToUser(parent.memberUserId, {
      title: "تنبيه غياب",
      body: `${student.nomPrenom} غائب اليوم (${absenceDate})`,
      url: "/my-child",
      type: "absence",
    });
  }

  let smsSent = false;
  if (student.parentPhone) {
    try {
      const result = await sendSmsAlertTool({ student_id: student.id, message }, input.schoolUserId) as { success?: boolean };
      smsSent = result.success === true;
    } catch (error) {
      logger.error({ error, studentId: student.id }, "Absence SMS alert failed");
    }
  }

  logger.info({ studentId: student.id, pushSent, smsSent }, "Absence parent alert dispatched");
  return { pushSent, smsSent };
}
