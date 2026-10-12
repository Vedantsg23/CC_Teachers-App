/** Marathi language helpers: number words, dates in words, gendered remarks. */
import { MONTH_NAMES } from './labels';
import type { RemarkCategory } from './types';

const ONES: string[] = [
  'शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ',
  'दहा', 'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस',
  'वीस', 'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस',
  'तीस', 'एकतीस', 'बत्तीस', 'तेहेतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस',
  'चाळीस', 'एक्केचाळीस', 'बेचाळीस', 'त्रेचाळीस', 'चव्वेचाळीस', 'पंचेचाळीस', 'सेहेचाळीस', 'सत्तेचाळीस', 'अठ्ठेचाळीस', 'एकोणपन्नास',
  'पन्नास', 'एक्कावन्न', 'बावन्न', 'त्रेपन्न', 'चोपन्न', 'पंचावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ',
  'साठ', 'एकसष्ट', 'बासष्ट', 'त्रेसष्ट', 'चौसष्ट', 'पासष्ट', 'सहासष्ट', 'सदुसष्ट', 'अडुसष्ट', 'एकोणसत्तर',
  'सत्तर', 'एक्काहत्तर', 'बाहत्तर', 'त्र्याहत्तर', 'चौऱ्याहत्तर', 'पंच्याहत्तर', 'शहात्तर', 'सत्त्याहत्तर', 'अठ्ठ्याहत्तर', 'एकोणऐंशी',
  'ऐंशी', 'एक्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौऱ्याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्त्याऐंशी', 'अठ्ठ्याऐंशी', 'एकोणनव्वद',
  'नव्वद', 'एक्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंच्याण्णव', 'शहाण्णव', 'सत्त्याण्णव', 'अठ्ठ्याण्णव', 'नव्व्याण्णव',
];

/** Marathi words for 0 – 99,999. */
export function numberToMarathiWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99999) return String(n);
  if (n < 100) return ONES[n];
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands) parts.push(`${ONES[thousands]} हजार`);
  if (hundreds) parts.push(`${ONES[hundreds]}शे`);
  if (rest) parts.push(ONES[rest]);
  return parts.join(' ');
}

/** "2013-11-28" → "अठ्ठावीस नोव्हेंबर दोन हजार तेरा" */
export function dateToMarathiWords(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${numberToMarathiWords(d)} ${MONTH_NAMES[mo - 1]} ${numberToMarathiWords(y)}`;
}

/* ------------------------------------------------------------------ */
/* Gendered remark forms                                               */
/* ------------------------------------------------------------------ */

const END = '(?=[\\s.,।!?;:)\\-]|$)';

function marathiFeminine(t: string): string {
  return t
    .replace(new RegExp(`(^|\\s)तो${END}`, 'g'), '$1ती')
    .replace(new RegExp(`त्याला${END}`, 'g'), 'तिला')
    .replace(new RegExp(`त्याचे${END}`, 'g'), 'तिचे')
    .replace(new RegExp(`त्याची${END}`, 'g'), 'तिची')
    .replace(new RegExp(`त्याचा${END}`, 'g'), 'तिचा')
    .replace(new RegExp(`त्याच्या${END}`, 'g'), 'तिच्या')
    .replace(new RegExp(`त्याने${END}`, 'g'), 'तिने')
    .replace(new RegExp(`विद्यार्थी${END}`, 'g'), 'विद्यार्थिनी')
    .replace(new RegExp(`([\\u0900-\\u097F])तो${END}`, 'g'), '$1ते');
}

function hindiFeminine(t: string): string {
  // करता है → करती है, लिखता रहता है → लिखती रहती है
  return t.replace(/ता(?=\s*(?:है|हैं|था|रहता)|[।.\s]*$)/g, 'ती').replace(/रहता(?=\s*है)/g, 'रहती');
}

function englishFeminine(t: string): string {
  return t
    .replace(/\bHe\b/g, 'She')
    .replace(/\bhe\b/g, 'she')
    .replace(/\bHis\b/g, 'Her')
    .replace(/\bhis\b/g, 'her')
    .replace(/\bhimself\b/g, 'herself')
    .replace(/\bHimself\b/g, 'Herself')
    .replace(/\bhim\b/g, 'her')
    .replace(/\bboy\b/g, 'girl');
}

/** Derive the feminine (मुलगी) form of a masculine remark. */
export function toFeminine(text: string, cat?: RemarkCategory): string {
  if (!text) return text;
  if (cat === 'english' || (/[A-Za-z]/.test(text) && !/[ऀ-ॿ]/.test(text))) return englishFeminine(text);
  if (cat === 'hindi' || /(है|हैं)\s*[।.]?\s*$/.test(text)) return hindiFeminine(text);
  return marathiFeminine(text);
}
