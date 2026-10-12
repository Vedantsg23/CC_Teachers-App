/** Formatting and date helpers (dates are stored as ISO "YYYY-MM-DD"). */
import { MONTH_NAMES, MONTH_SHORT } from './labels';
import type { Term } from './types';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date as YYYY-MM-DD. */
export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isValidIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  const days = new Date(y, mo, 0).getDate();
  return d <= days;
}

/** YYYY-MM-DD → DD-MM-YYYY (as printed in the reference registers). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Accepts DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD or an Excel serial. Returns ISO or ''. */
export function parseDateLoose(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'number' || /^\d{4,5}(\.\d+)?$/.test(String(input).trim())) {
    const serial = Number(input);
    if (serial > 1000 && serial < 80000) {
      // Excel serial date (1900 system)
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }
  const s = String(input).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) {
    const iso = `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
    return isValidIsoDate(iso) ? iso : '';
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const iso = `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    return isValidIsoDate(iso) ? iso : '';
  }
  return '';
}

/** Age in completed years on a date. */
export function ageOn(dob: string, on: string = todayIso()): number | null {
  if (!isValidIsoDate(dob) || !isValidIsoDate(on)) return null;
  const [y1, m1, d1] = dob.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  let age = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) age--;
  return age;
}

/** Marks: integer as-is, otherwise up to 2 decimals without trailing zeros. */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** Academic-year months: June of the first year to April of the next. */
export function yearMonths(year: string): string[] {
  const start = Number(year.slice(0, 4));
  if (!start) return [];
  const out: string[] = [];
  for (let m = 6; m <= 12; m++) out.push(`${start}-${pad2(m)}`);
  for (let m = 1; m <= 4; m++) out.push(`${start + 1}-${pad2(m)}`);
  return out;
}

/** प्रथम सत्र: जून–ऑक्टोबर, द्वितीय सत्र: नोव्हेंबर–एप्रिल. */
export function termOfMonth(month: string): Term {
  const m = Number(month.slice(5, 7));
  return m >= 6 && m <= 10 ? 1 : 2;
}

export function monthLabel(month: string, short = false): string {
  const y = month.slice(0, 4);
  const m = Number(month.slice(5, 7));
  const names = short ? MONTH_SHORT : MONTH_NAMES;
  return short ? names[m - 1] : `${names[m - 1]} ${y}`;
}

export function monthOfDate(iso: string): string {
  return iso.slice(0, 7);
}

/** Number of days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

/** Next academic year string: "2026-27" → "2027-28". */
export function nextYear(year: string): string {
  const s = Number(year.slice(0, 4)) + 1;
  return `${s}-${String((s + 1) % 100).padStart(2, '0')}`;
}

export function isValidYear(year: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(year);
  if (!m) return false;
  return (Number(m[1]) + 1) % 100 === Number(m[2]);
}

/** Sort comparator for students: roll number first, then name. */
export function byRoll<T extends { rollNo: number | null; fullName: string }>(a: T, b: T): number {
  const ra = a.rollNo ?? Number.MAX_SAFE_INTEGER;
  const rb = b.rollNo ?? Number.MAX_SAFE_INTEGER;
  if (ra !== rb) return ra - rb;
  return a.fullName.localeCompare(b.fullName, 'mr');
}

export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
}
