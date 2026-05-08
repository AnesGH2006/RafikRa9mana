import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../utils/prisma.js';
import { calculateGeneralAverage, getStatus, calculateSubjectAverage } from '../utils/coefficients.js';

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      level, className, schoolYear = '2024-2025',
      trimester = '1', search, page = '1', limit = '20',
    } = req.query as Record<string, string>;

    const where: any = { schoolId: req.schoolId!, schoolYear };
    if (level) where.level = level;
    if (className) where.className = className;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { registrationNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { grades: { where: { trimester: parseInt(trimester), schoolYear } } },
        orderBy: [{ level: 'asc' }, { className: 'asc' }, { lastName: 'asc' }],
        skip, take: parseInt(limit),
      }),
      prisma.student.count({ where }),
    ]);

    const result = students.map((s) => {
      const avg = calculateGeneralAverage(s.grades);
      return { ...s, generalAverage: avg, status: getStatus(avg) };
    });

    res.json({
      success: true,
      students: result,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const getStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, schoolId: req.schoolId! },
      include: { grades: { orderBy: [{ trimester: 'asc' }, { subjectCode: 'asc' }] } },
    });
    if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
    const avg = calculateGeneralAverage(student.grades);
    res.json({ success: true, student: { ...student, generalAverage: avg, status: getStatus(avg) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, registrationNo, className } = req.body;
    const existing = await prisma.student.findFirst({ where: { id: req.params.id, schoolId: req.schoolId! } });
    if (!existing) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
    const student = await prisma.student.update({ where: { id: req.params.id }, data: { firstName, lastName, registrationNo, className } });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.student.findFirst({ where: { id: req.params.id, schoolId: req.schoolId! } });
    if (!existing) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Élève supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const updateGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { devoir, exam } = req.body;
    const grade = await prisma.grade.findFirst({
      where: { id: req.params.gradeId, student: { id: req.params.id, schoolId: req.schoolId! } },
    });
    if (!grade) { res.status(404).json({ success: false, message: 'Note introuvable' }); return; }

    const newDevoir = devoir !== undefined ? parseFloat(devoir) : grade.devoir;
    const newExam = exam !== undefined ? parseFloat(exam) : grade.exam;
    const average = calculateSubjectAverage(newDevoir, newExam);

    const updated = await prisma.grade.update({
      where: { id: req.params.gradeId },
      data: { devoir: newDevoir, exam: newExam, average },
    });
    res.json({ success: true, grade: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};