/** Column mapping for student import / export (CSV & Excel). */
import { fmtDate, parseDateLoose } from '../../lib/format';
import { CATEGORIES, GENDER_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import type { Student } from '../../lib/types';
import { normalizeDigits } from '../../lib/validation';

type Key = keyof Student;

export const COLUMNS: { key: Key; header: string; aliases: string[]; width: number }[] = [
  { key: 'rollNo', header: 'हजेरी क्र.', aliases: ['हजेरी क्रमांक', 'हजेरीक्र', 'रोल नं', 'रोलनं', 'roll', 'rollno', 'rollnumber'], width: 9 },
  { key: 'fullName', header: 'विद्यार्थ्याचे नाव', aliases: ['विद्यार्थ्याचे पूर्ण नाव', 'विद्यार्थ्याचेनाव', 'नाव', 'name', 'studentname', 'fullname'], width: 30 },
  { key: 'gender', header: 'लिंग', aliases: ['gender', 'sex'], width: 8 },
  { key: 'dob', header: 'जन्मतारीख', aliases: ['जन्म दिनांक', 'जन्मदिनांक', 'dob', 'dateofbirth', 'birthdate'], width: 12 },
  { key: 'regNo', header: 'रजिस्टर क्र.', aliases: ['रजि. क्र.', 'रजि.नं.', 'रजिनं', 'रजिक्र', 'जनरल रजिस्टर क्र', 'grno', 'registerno', 'regno', 'admissionno'], width: 11 },
  { key: 'pen', header: 'PEN', aliases: ['UDISE PEN', 'pen', 'udisepen', 'penno', 'पेन नंबर', 'पेन'], width: 14 },
  { key: 'aadhaar', header: 'आधार क्र.', aliases: ['आधार', 'आधार क्रमांक', 'आधार नंबर', 'aadhaar', 'aadhar', 'aadhaarno', 'uid'], width: 15 },
  { key: 'apaar', header: 'अपार आयडी', aliases: ['अपार', 'अपार क्रमांक', 'apaar', 'apaarid', 'apar', 'aparid'], width: 15 },
  { key: 'motherName', header: 'आईचे नाव', aliases: ['mother', 'mothername'], width: 18 },
  { key: 'fatherName', header: 'वडिलांचे नाव', aliases: ['father', 'fathername'], width: 22 },
  { key: 'fatherOccupation', header: 'वडिलांचा व्यवसाय', aliases: ['fatheroccupation'], width: 16 },
  { key: 'motherOccupation', header: 'आईचा व्यवसाय', aliases: ['motheroccupation'], width: 16 },
  { key: 'guardianName', header: 'पालकाचे नाव', aliases: ['guardian', 'guardianname'], width: 22 },
  { key: 'caste', header: 'जात', aliases: ['caste'], width: 14 },
  { key: 'subCaste', header: 'पोटजात', aliases: ['subcaste'], width: 12 },
  { key: 'category', header: 'प्रवर्ग', aliases: ['category', 'जातप्रवर्ग'], width: 10 },
  { key: 'religion', header: 'धर्म', aliases: ['religion'], width: 10 },
  { key: 'mobile', header: 'मोबाईल', aliases: ['मोबाईल क्र', 'मोबाईलक्रमांक', 'mobile', 'phone', 'mobileno'], width: 13 },
  { key: 'address', header: 'पत्ता', aliases: ['address'], width: 30 },
  { key: 'admissionDate', header: 'प्रवेश दिनांक', aliases: ['admissiondate'], width: 12 },
  { key: 'birthPlace', header: 'जन्मस्थळ', aliases: ['birthplace'], width: 16 },
  { key: 'previousSchool', header: 'मागील शाळा', aliases: ['previousschool'], width: 22 },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s._\-:()]/g, '');

export function mapHeaders(header: string[]): (Key | null)[] {
  return header.map((h) => {
    const n = norm(h ?? '');
    if (!n) return null;
    for (const c of COLUMNS) {
      if (norm(c.header) === n || c.aliases.some((a) => norm(a) === n)) return c.key;
    }
    return null;
  });
}

function parseGender(v: string): 'M' | 'F' | null {
  const s = norm(v);
  if (['मुलगा', 'm', 'male', 'boy', 'b', 'पुरुष', 'मु'].includes(s)) return 'M';
  if (['मुलगी', 'f', 'female', 'girl', 'g', 'स्त्री', 'मुली'].includes(s)) return 'F';
  return null;
}

function parseCategory(v: string): string {
  const s = norm(v);
  if (!s) return '';
  const hit = CATEGORIES.find((c) => norm(c.code) === s || norm(c.label) === s || norm(c.short) === s || norm(c.label).includes(s));
  if (hit) return hit.code;
  if (s === 'open' || s === 'general' || s === 'gen') return 'OPEN';
  if (s.startsWith('vj') || s.startsWith('dt')) return 'VJA';
  return v.trim().toUpperCase().slice(0, 10);
}

export interface ImportRow {
  line: number;
  student: Student;
  errors: string[];
}

export function rowsToStudents(rows: string[][], classId: string): { rows: ImportRow[]; unknownHeaders: string[]; mapped: number } {
  if (!rows.length) return { rows: [], unknownHeaders: [], mapped: 0 };
  const keys = mapHeaders(rows[0]);
  const unknownHeaders = rows[0].filter((h, i) => h && !keys[i]);
  const out: ImportRow[] = [];
  rows.slice(1).forEach((r, i) => {
    const st = repo.emptyStudent(classId);
    const errors: string[] = [];
    keys.forEach((k, ci) => {
      if (!k) return;
      const v = (r[ci] ?? '').toString().trim();
      if (!v) return;
      switch (k) {
        case 'rollNo': {
          const n = Number(normalizeDigits(v));
          if (Number.isInteger(n) && n > 0) st.rollNo = n;
          else errors.push('हजेरी क्रमांक चुकीचा');
          break;
        }
        case 'gender': {
          const g = parseGender(v);
          if (g) st.gender = g;
          else errors.push('लिंग ओळखता आले नाही');
          break;
        }
        case 'dob':
        case 'admissionDate': {
          const d = parseDateLoose(normalizeDigits(v));
          if (d) st[k] = d;
          else errors.push(k === 'dob' ? 'जन्मतारीख चुकीची' : 'प्रवेश दिनांक चुकीचा');
          break;
        }
        case 'category':
          st.category = parseCategory(v);
          break;
        case 'mobile':
          st.mobile = normalizeDigits(v).replace(/\D/g, '').slice(-10);
          break;
        case 'aadhaar':
        case 'apaar':
          st[k] = normalizeDigits(v).replace(/[\s-]/g, '').slice(0, 20);
          break;
        default:
          (st as unknown as Record<string, string>)[k] = v.slice(0, 300);
      }
    });
    if (!st.fullName.trim()) errors.unshift('नाव नाही');
    if (!st.guardianName && st.fatherName) st.guardianName = st.fatherName;
    out.push({ line: i + 2, student: st, errors });
  });
  return { rows: out, unknownHeaders, mapped: keys.filter(Boolean).length };
}

export function studentsToRows(list: Student[]): (string | number | null)[][] {
  return [
    COLUMNS.map((c) => c.header),
    ...list.map((s) =>
      COLUMNS.map((c) => {
        const v = s[c.key];
        if (c.key === 'gender') return GENDER_LABEL[s.gender];
        if (c.key === 'dob' || c.key === 'admissionDate') return fmtDate(v as string);
        if (v === null || v === undefined) return '';
        return v as string | number;
      }),
    ),
  ];
}

export const COLUMN_WIDTHS = COLUMNS.map((c) => c.width);
