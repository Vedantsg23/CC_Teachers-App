/** Central validation with Marathi messages. */
import { ageOn, isValidIsoDate, todayIso } from './format';
import type { Student } from './types';

export const MSG = {
  nameRequired: 'कृपया विद्यार्थ्याचे नाव भरा.',
  genderRequired: 'कृपया लिंग निवडा.',
  dobInvalid: 'कृपया योग्य जन्मतारीख भरा.',
  dobFuture: 'जन्मतारीख भविष्यातील असू शकत नाही.',
  dobAge: 'जन्मतारीख तपासा — विद्यार्थ्याचे वय 3 ते 20 वर्षांदरम्यान असावे.',
  dateInvalid: 'कृपया योग्य दिनांक भरा.',
  rollInvalid: 'हजेरी क्रमांक 1 ते 999 दरम्यानची संख्या असावा.',
  dupRoll: 'हा हजेरी क्रमांक आधीच दुसऱ्या विद्यार्थ्याला दिला आहे.',
  dupReg: 'हा रजिस्टर क्रमांक आधीच दुसऱ्या विद्यार्थ्याच्या नावे आहे.',
  mobileInvalid: 'मोबाईल क्रमांक 10 अंकी असावा.',
  marksMax: 'प्राप्त गुण हे कमाल गुणांपेक्षा जास्त असू शकत नाहीत.',
  marksNegative: 'गुण उणे (ऋण) असू शकत नाहीत.',
  marksInvalid: 'कृपया गुण अंकांमध्ये भरा.',
  attendanceExceeds: 'हजर दिवस हे कामाच्या दिवसांपेक्षा जास्त असू शकत नाहीत.',
  workingDaysInvalid: 'कामाचे दिवस 0 ते 31 दरम्यान असावेत.',
  required: 'ही माहिती आवश्यक आहे.',
  usernameInvalid: 'वापरकर्ता नाव 3 ते 20 इंग्रजी लहान अक्षरे/अंक असावे (उदा. jadhav7).',
  passwordShort: 'पासवर्ड किमान 6 अक्षरांचा असावा.',
  passwordMismatch: 'दोन्ही पासवर्ड सारखे नाहीत.',
  udiseInvalid: 'UDISE क्रमांक 11 अंकी असावा.',
  aadhaarInvalid: 'आधार क्रमांक 12 अंकी असावा.',
  aadhaarCheck: 'आधार क्रमांक तपासा — अंक चुकीचे असू शकतात.',
  apaarInvalid: 'अपार आयडी 12 अंकी असावा.',
  measureInvalid: 'कृपया अंकांमध्ये भरा (उदा. 24.5).',
} as const;

/** Convert Devanagari digits to ASCII so "८५" is accepted as 85. */
export function normalizeDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
}

export type MarkCheck = { ok: true; value: number | null } | { ok: false; error: string };

/** Validate one mark entry against the tool's maximum. Empty = not entered. */
export function validateMark(raw: string, max: number): MarkCheck {
  const s = normalizeDigits(raw).trim().replace(',', '.');
  if (s === '') return { ok: true, value: null };
  if (/^-/.test(s)) return { ok: false, error: MSG.marksNegative };
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return { ok: false, error: MSG.marksInvalid };
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, error: MSG.marksInvalid };
  if (v < 0) return { ok: false, error: MSG.marksNegative };
  if (v > max) return { ok: false, error: MSG.marksMax };
  return { ok: true, value: v };
}

/** Whole-number entry such as days. */
export function validateCount(raw: string, max: number, overMsg: string): MarkCheck {
  const s = normalizeDigits(raw).trim();
  if (s === '') return { ok: true, value: null };
  if (/^-/.test(s)) return { ok: false, error: MSG.marksNegative };
  if (!/^\d+$/.test(s)) return { ok: false, error: MSG.marksInvalid };
  const v = Number(s);
  if (v > max) return { ok: false, error: overMsg };
  return { ok: true, value: v };
}

export interface FieldErrors {
  [field: string]: string;
}

export interface StudentCheck {
  errors: FieldErrors; // block saving
  warnings: FieldErrors; // shown, saving allowed
}

export function validateStudent(s: Partial<Student>, others: Student[]): StudentCheck {
  const errors: FieldErrors = {};
  const warnings: FieldErrors = {};
  if (!s.fullName || !s.fullName.trim()) errors.fullName = MSG.nameRequired;
  if (s.gender !== 'M' && s.gender !== 'F') errors.gender = MSG.genderRequired;
  if (s.dob) {
    if (!isValidIsoDate(s.dob)) errors.dob = MSG.dobInvalid;
    else if (s.dob > todayIso()) errors.dob = MSG.dobFuture;
    else {
      const age = ageOn(s.dob);
      if (age !== null && (age < 3 || age > 20)) warnings.dob = MSG.dobAge;
    }
  }
  for (const k of ['admissionDate'] as const) {
    const v = s[k];
    if (v && !isValidIsoDate(v)) errors[k] = MSG.dateInvalid;
  }
  if (s.rollNo !== null && s.rollNo !== undefined) {
    if (!Number.isInteger(s.rollNo) || s.rollNo < 1 || s.rollNo > 999) errors.rollNo = MSG.rollInvalid;
    else if (others.some((o) => o.id !== s.id && o.status === 'active' && o.rollNo === s.rollNo)) warnings.rollNo = MSG.dupRoll;
  }
  const reg = (s.regNo ?? '').trim();
  if (reg && others.some((o) => o.id !== s.id && o.regNo.trim() === reg)) warnings.regNo = MSG.dupReg;
  const mob = normalizeDigits(s.mobile ?? '').replace(/[\s-]/g, '');
  if (mob && !/^(\+?91)?[6-9]\d{9}$/.test(mob)) errors.mobile = MSG.mobileInvalid;
  const aadhaar = digitsOnly(s.aadhaar ?? '');
  if (aadhaar) {
    if (!/^\d{12}$/.test(aadhaar)) errors.aadhaar = MSG.aadhaarInvalid;
    else if (!/^[2-9]/.test(aadhaar) || !verhoeffValid(aadhaar)) warnings.aadhaar = MSG.aadhaarCheck;
  }
  const apaar = digitsOnly(s.apaar ?? '');
  if (apaar && !/^\d{12}$/.test(apaar)) errors.apaar = MSG.apaarInvalid;
  const h = s.health;
  if (h) {
    for (const k of ['weight1', 'height1', 'weight2', 'height2'] as const) {
      const v = normalizeDigits(h[k] ?? '').trim();
      if (v && !/^\d{1,3}(\.\d{1,2})?$/.test(v)) errors[`health.${k}`] = MSG.measureInvalid;
    }
  }
  return { errors, warnings };
}

/** Strip spaces/dashes and convert Devanagari digits ("१२३४ ५६७८" → "12345678"). */
export function digitsOnly(s: string): string {
  return normalizeDigits(s).replace(/[\s-]/g, '');
}

/* Verhoeff checksum (the check digit scheme used by Aadhaar). */
const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(num: string): boolean {
  let c = 0;
  const digits = num.split('').reverse();
  for (let i = 0; i < digits.length; i++) c = VD[c][VP[i % 8][Number(digits[i])]];
  return c === 0;
}

export function validateUsername(u: string): string | null {
  return /^[a-z0-9_.]{3,20}$/.test(u) ? null : MSG.usernameInvalid;
}

export function validatePassword(p: string, confirm?: string): string | null {
  if (p.length < 6) return MSG.passwordShort;
  if (confirm !== undefined && p !== confirm) return MSG.passwordMismatch;
  return null;
}

export function validateUdise(u: string): string | null {
  if (!u) return null;
  return /^\d{11}$/.test(normalizeDigits(u).trim()) ? null : MSG.udiseInvalid;
}
