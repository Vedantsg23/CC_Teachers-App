import { describe, expect, it } from 'vitest';
import {
  aggregate,
  classResults,
  combineAnnual,
  gradeDistribution,
  gradeFor,
  groupResult,
  resultSummary,
  subjectTermResult,
  sumTools,
} from '../src/lib/calc';
import { defaultConfig, defaultGrades, distributeFormative, distributeSummative } from '../src/lib/defaults';
import type { Assessment, ClassConfig, Student } from '../src/lib/types';

const cfg7: ClassConfig = defaultConfig(7);
const cfg5: ClassConfig = defaultConfig(5);

function rec(studentId: string, subjectId: string, term: 1 | 2, type: 'F' | 'S', scores: Record<string, number | null>): Assessment {
  return { id: `${studentId}|${subjectId}|${term}|${type}`, classId: 'c', studentId, subjectId, term, type, scores, updatedAt: 0 };
}

function student(id: string, gender: 'M' | 'F', category = 'OPEN'): Student {
  return {
    id, classId: 'c', rollNo: 1, regNo: '', saralId: '', pen: '', fullName: id, motherName: '', fatherName: '', guardianName: '',
    gender, dob: '', birthPlace: '', religion: '', caste: '', category, nationality: '', motherTongue: '', address: '', mobile: '',
    admissionDate: '', admissionStd: '', previousSchool: '', photo: '', status: 'active', leaving: null, demo: false, createdAt: 0, updatedAt: 0,
  };
}

describe('default weightage (भारांश)', () => {
  it('std 7 scholastic: आकारिक 40 + संकलित 60', () => {
    const w = cfg7.weights['1'].marathi;
    expect(sumTools(cfg7.fTools, w.F, undefined).max).toBe(40);
    expect(sumTools(cfg7.sParts, w.S, undefined).max).toBe(60);
  });
  it('std 5 scholastic: आकारिक 50 + संकलित 50', () => {
    const w = cfg5.weights['1'].marathi;
    expect(sumTools(cfg5.fTools, w.F, undefined).max).toBe(50);
    expect(sumTools(cfg5.sParts, w.S, undefined).max).toBe(50);
  });
  it('co-scholastic subjects are 100 आकारिक only', () => {
    for (const id of ['art', 'work', 'pe']) {
      const w = cfg7.weights['1'][id];
      expect(sumTools(cfg7.fTools, w.F, undefined).max).toBe(100);
      expect(sumTools(cfg7.sParts, w.S, undefined).used).toBe(0);
    }
  });
  it('class 5 has its own subjects (परिसर अभ्यास भाग 1/2)', () => {
    expect(cfg5.subjects.map((s) => s.id)).toContain('evs1');
    expect(cfg7.subjects.map((s) => s.id)).toContain('science');
  });
  it('distributes any total exactly', () => {
    for (const t of [30, 40, 45, 50, 60, 70, 100]) {
      const sum = Object.values(distributeFormative(t)).reduce<number>((a, b) => a + (b ?? 0), 0);
      expect(sum).toBe(t);
    }
    expect(distributeSummative(60)).toMatchObject({ oral: 10, written: 50, prac: null });
  });
});

describe('grades (श्रेणी)', () => {
  const g = defaultGrades();
  it.each([
    [100, 'अ-1'], [91, 'अ-1'], [90, 'अ-2'], [81, 'अ-2'], [80, 'ब-1'], [71, 'ब-1'], [70, 'ब-2'], [61, 'ब-2'],
    [60, 'क-1'], [51, 'क-1'], [50, 'क-2'], [41, 'क-2'], [40, 'ड'], [33, 'ड'], [32, 'इ-1'], [21, 'इ-1'], [20, 'इ-2'], [0, 'इ-2'],
  ])('%d%% → %s', (pct, grade) => expect(gradeFor(pct, g)).toBe(grade));
  it('rounds before grading when configured', () => {
    expect(gradeFor(90.5, g, true)).toBe('अ-1');
    expect(gradeFor(90.5, g, false)).toBe('अ-2');
  });
  it('empty for no marks', () => expect(gradeFor(null, g)).toBe(''));
});

describe('subject term result (अ + ब)', () => {
  it('adds formative tools and summative parts', () => {
    const f = rec('s1', 'marathi', 1, 'F', { obs: 5, oral: 4, prac: 5, act: 3, proj: 4, test: 5, hw: 4.5, other: 5 });
    const s = rec('s1', 'marathi', 1, 'S', { oral: 8, written: 42 });
    const r = subjectTermResult(cfg7, cfg7.subjects[0], 1, f, s);
    expect(r.fObt).toBe(35.5);
    expect(r.sObt).toBe(50);
    expect(r.total).toBe(85.5);
    expect(r.max).toBe(100);
    expect(r.pct).toBe(85.5);
    expect(r.grade).toBe('अ-2');
    expect(r.complete).toBe(true);
  });
  it('ignores scores for tools that are switched off', () => {
    const f = rec('s1', 'marathi', 1, 'F', { obs: 5 });
    const s = rec('s1', 'marathi', 1, 'S', { prac: 10, written: 50 }); // prac is not used by default
    const r = subjectTermResult(cfg7, cfg7.subjects[0], 1, f, s);
    expect(r.sObt).toBe(50);
    expect(r.total).toBe(55);
  });
  it('is empty when nothing is entered', () => {
    const r = subjectTermResult(cfg7, cfg7.subjects[0], 1, undefined, undefined);
    expect(r.entered).toBe(false);
    expect(r.total).toBeNull();
    expect(r.grade).toBe('');
  });
  it('combines both terms for the annual result', () => {
    const a = subjectTermResult(cfg7, cfg7.subjects[0], 1, rec('s', 'marathi', 1, 'F', { obs: 5, oral: 5, prac: 5, act: 5, proj: 5, test: 5, hw: 5, other: 5 }), rec('s', 'marathi', 1, 'S', { oral: 10, written: 50 }));
    const b = subjectTermResult(cfg7, cfg7.subjects[0], 2, rec('s', 'marathi', 2, 'F', { obs: 2 }), rec('s', 'marathi', 2, 'S', { written: 18 }));
    const y = combineAnnual(cfg7, a, b);
    expect(y.total).toBe(120);
    expect(y.max).toBe(200);
    expect(y.pct).toBe(60);
    expect(y.grade).toBe('क-1');
  });
});

describe('result rules (निकाल)', () => {
  function full(sid: string, pct: number): Assessment[] {
    const out: Assessment[] = [];
    for (const subj of cfg7.subjects) {
      const w = cfg7.weights['1'][subj.id];
      const f: Record<string, number> = {};
      const s: Record<string, number> = {};
      for (const [k, m] of Object.entries(w.F)) if (m) f[k] = (m * pct) / 100;
      for (const [k, m] of Object.entries(w.S)) if (m) s[k] = (m * pct) / 100;
      out.push(rec(sid, subj.id, 1, 'F', f));
      if (Object.keys(s).length) out.push(rec(sid, subj.id, 1, 'S', s));
    }
    return out;
  }
  const students = [student('a', 'M', 'OBC'), student('b', 'F', 'OBC'), student('c', 'F', 'SC'), student('d', 'M', 'SC')];
  const data = [...full('a', 80), ...full('b', 30), ...full('c', 95), rec('d', 'marathi', 1, 'F', { obs: 3 })];
  const results = classResults(cfg7, students, data);

  it('passes / needs improvement / incomplete / absent', () => {
    expect(results.get('a')!.t1.status).toBe('pass');
    expect(results.get('a')!.t1.pct).toBe(80);
    expect(results.get('b')!.t1.status).toBe('fail');
    expect(results.get('b')!.t1.resultLabel).toBe('आवश्यक सुधारणा');
    expect(results.get('d')!.t1.status).toBe('incomplete');
    expect(results.get('a')!.t2.status).toBe('absent');
  });

  it('applies the per-subject minimum', () => {
    const custom = structuredClone(cfg7);
    custom.result.subjectMin = 0;
    custom.result.overallMin = 25;
    const r = aggregate(custom, 1, results.get('b')!.details['1']);
    expect(r.status).toBe('pass');
  });

  it('summarises the class', () => {
    const s = resultSummary(students, results, 1);
    expect(s.total.T).toBe(4);
    expect(s.pass).toMatchObject({ M: 1, F: 1, T: 2 });
    expect(s.fail).toMatchObject({ F: 1, T: 1 });
    expect(s.incomplete.T).toBe(1);
  });

  it('grade distribution by gender', () => {
    const d = gradeDistribution(cfg7, students, results, 1, 'marathi');
    expect(d['ब-1'].M).toBe(1);
    expect(d['अ-1'].F).toBe(1);
    expect(d['इ-1'].F).toBe(1);
  });

  it('category-wise result', () => {
    const rows = groupResult(students, results, 1, (s) => s.category);
    const obc = rows.find((r) => r.key === 'OBC')!;
    expect(obc).toMatchObject({ boys: 1, girls: 1, total: 2, appeared: 2, pass: 1, passPct: 50 });
  });
});

describe('performance', () => {
  it('computes results for 500 students / 18,000 assessment records quickly', () => {
    const students = Array.from({ length: 500 }, (_, i) => student(`p${i}`, i % 2 ? 'F' : 'M', i % 3 ? 'OBC' : 'SC'));
    const recs: Assessment[] = [];
    for (const st of students) {
      for (const term of [1, 2] as const) {
        for (const subj of cfg7.subjects) {
          const w = cfg7.weights[String(term) as '1' | '2'][subj.id];
          const f: Record<string, number> = {};
          const s: Record<string, number> = {};
          for (const [k, m] of Object.entries(w.F)) if (m) f[k] = Math.round(m * 0.7);
          for (const [k, m] of Object.entries(w.S)) if (m) s[k] = Math.round(m * 0.6);
          recs.push(rec(st.id, subj.id, term, 'F', f));
          recs.push(rec(st.id, subj.id, term, 'S', s));
        }
      }
    }
    expect(recs.length).toBe(18000);
    const t0 = performance.now();
    const results = classResults(cfg7, students, recs);
    const dist = gradeDistribution(cfg7, students, results, 'annual', null);
    const sum = resultSummary(students, results, 'annual');
    const ms = performance.now() - t0;
    expect(results.size).toBe(500);
    expect(sum.total.T).toBe(500);
    expect(Object.values(dist).reduce((a, c) => a + c.T, 0)).toBe(500);
    expect(ms).toBeLessThan(1500);
  });
});
