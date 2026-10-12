/**
 * Optional sample (डेमो) data for trying the app. All names are fictional.
 * Every demo student is flagged `demo: true` and can be removed from
 * सेटिंग्ज → ॲप → नमुना माहिती काढा.
 */
import { db } from './db';
import { assessmentId } from './calc';
import { uid } from './crypto';
import { yearMonths } from './format';
import { SPECIAL_AREAS } from './labels';
import * as repo from './repo';
import type { Assessment, AttendanceMonth, AttendanceRec, Gender, Remark, Student } from './types';

const BOYS = ['आरव संजय पाटील', 'ओम राजेश जाधव', 'सार्थक अनिल शिंदे', 'वेदांत सुनील पवार', 'यश दीपक कदम'];
const GIRLS = ['सई महेश देशमुख', 'आर्या प्रकाश कुलकर्णी', 'श्रावणी विजय मोरे', 'स्वरा गणेश गायकवाड', 'ईश्वरी नितीन चव्हाण'];
const MOTHERS = ['सुनीता', 'मनीषा', 'वर्षा', 'रेखा', 'अर्चना', 'कविता', 'संगीता', 'अश्विनी', 'प्रिया', 'शुभांगी'];
const CATS = ['OPEN', 'OBC', 'SC', 'NTC', 'OBC', 'ST', 'OPEN', 'VJA', 'OBC', 'SBC'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export async function seedDemo(scope: repo.Scope): Promise<number> {
  const cls = await repo.getClass(scope);
  const cfg = cls.config;
  const rand = rng(cls.standard * 7919 + 17);
  const yearStart = Number(cls.year.slice(0, 4));
  const birthYear = yearStart - (cls.standard + 5);
  const names: [string, Gender][] = [];
  for (let i = 0; i < 5; i++) {
    names.push([BOYS[i], 'M']);
    names.push([GIRLS[i], 'F']);
  }
  const existing = await repo.listStudents(scope, { includeLeft: true });
  const startRoll = existing.reduce((m, s) => Math.max(m, s.rollNo ?? 0), 0);
  const t = Date.now();
  const students: Student[] = names.map(([fullName, gender], i) => {
    const father = fullName.split(' ')[1] ?? '';
    const surname = fullName.split(' ')[2] ?? '';
    const m = 1 + Math.floor(rand() * 12);
    const d = 1 + Math.floor(rand() * 27);
    return {
      ...repo.emptyStudent(scope.classId),
      id: uid(),
      rollNo: startRoll + i + 1,
      regNo: String(4100 + cls.standard * 100 + i + 1),
      saralId: String(2025000000 + cls.standard * 1000 + i + 1),
      fullName,
      motherName: `${MOTHERS[i]} ${surname}`,
      fatherName: `${father} ${surname}`,
      guardianName: `${father} ${surname}`,
      gender,
      dob: `${birthYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      birthPlace: 'पुणे',
      religion: 'हिंदू',
      caste: '',
      category: CATS[i],
      address: 'मु. पो. नमुना गाव, ता. नमुना, जि. पुणे',
      mobile: `98${String(10000000 + i * 1234567).slice(0, 8)}`,
      admissionDate: `${yearStart - (cls.standard - 1)}-06-15`,
      admissionStd: 'पहिली',
      demo: true,
      createdAt: t,
      updatedAt: t,
    };
  });

  const assessments: Assessment[] = [];
  const remarks: Remark[] = [];
  const library = await repo.listLibrary(scope);
  for (const [si, s] of students.entries()) {
    const ability = 0.45 + rand() * 0.5;
    for (const term of [1, 2] as const) {
      for (const subj of cfg.subjects) {
        const w = cfg.weights[String(term) as '1' | '2'][subj.id];
        if (!w) continue;
        for (const type of ['F', 'S'] as const) {
          const tools = type === 'F' ? cfg.fTools : cfg.sParts;
          const scores: Record<string, number | null> = {};
          let any = false;
          for (const tool of tools) {
            const max = (type === 'F' ? w.F : w.S)[tool.key];
            if (!max) continue;
            const v = Math.min(max, Math.max(0, Math.round(max * (ability + (rand() - 0.5) * 0.3))));
            scores[tool.key] = v;
            any = true;
          }
          if (any) {
            assessments.push({ id: assessmentId(s.id, subj.id, term, type), classId: scope.classId, studentId: s.id, subjectId: subj.id, term, type, scores, updatedAt: t });
          }
        }
        const pool = library.filter((l) => l.category === subj.remarkCat);
        if (pool.length) {
          const item = pool[(si + term) % pool.length];
          remarks.push({ id: repo.remarkId(s.id, term, subj.id), classId: scope.classId, studentId: s.id, term, area: subj.id, text: s.gender === 'F' ? item.textF : item.text, updatedAt: t });
        }
      }
      for (const a of SPECIAL_AREAS) {
        const pool = library.filter((l) => l.category === a.cat);
        if (!pool.length) continue;
        const item = pool[(si * 3 + term) % pool.length];
        remarks.push({ id: repo.remarkId(s.id, term, a.key), classId: scope.classId, studentId: s.id, term, area: a.key, text: s.gender === 'F' ? item.textF : item.text, updatedAt: t });
      }
    }
  }

  const months = yearMonths(cls.year).slice(0, 4);
  const working = [20, 24, 22, 18];
  const monthRecs: AttendanceMonth[] = months.map((m, i) => ({ id: `${scope.classId}|${m}`, classId: scope.classId, month: m, workingDays: working[i], updatedAt: t }));
  const attRecs: AttendanceRec[] = [];
  for (const s of students) {
    months.forEach((m, i) => {
      attRecs.push({ id: `${s.id}|${m}`, classId: scope.classId, studentId: s.id, month: m, present: working[i] - Math.floor(rand() * 4), updatedAt: t });
    });
  }

  await db.transaction('rw', [db.students, db.assessments, db.remarks, db.attendanceMonths, db.attendance], async () => {
    await db.students.bulkAdd(students);
    await db.assessments.bulkPut(assessments);
    await db.remarks.bulkPut(remarks);
    const existingMonths = new Set((await db.attendanceMonths.where('classId').equals(scope.classId).toArray()).map((m) => m.month));
    await db.attendanceMonths.bulkPut(monthRecs.filter((m) => !existingMonths.has(m.month)));
    await db.attendance.bulkPut(attRecs);
  });
  return students.length;
}
