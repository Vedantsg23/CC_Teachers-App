/** Central Marathi labels and constants. Keep all teacher-facing wording here. */
import type { Gender, Period, RemarkCategory, SpecialArea, Term } from './types';

export const APP_NAME = 'CCE नोंदवही';
export const APP_TITLE = 'सातत्यपूर्ण सर्वंकष मूल्यमापन';
export const DEFAULT_YEAR = '2026-27';
export const APP_VERSION = '1.0.0';

export const L = {
  save: 'जतन करा',
  cancel: 'रद्द करा',
  edit: 'संपादित करा',
  del: 'हटवा',
  add: 'जोडा',
  close: 'बंद करा',
  view: 'पहा',
  search: 'शोधा',
  back: 'मागे',
  next: 'पुढील',
  prev: 'मागील',
  yes: 'होय',
  no: 'नाही',
  confirm: 'खात्री करा',
  saved: 'जतन झाले ✓',
  savedLocal: 'स्थानिक पातळीवर जतन झाले ✓',
  saving: 'जतन होत आहे…',
  online: 'ऑनलाइन',
  offline: 'ऑफलाइन',
  logout: 'बाहेर पडा',
  makePdf: 'PDF तयार करा',
  print: 'प्रिंट करा',
  share: 'शेअर करा',
  preview: 'अहवाल पूर्वदृश्य',
  download: 'डाउनलोड करा',
  installApp: 'ॲप स्थापित करा',
  loading: 'माहिती लोड होत आहे…',
  noData: 'डेटा उपलब्ध नाही.',
  saveError: 'माहिती जतन करताना अडचण आली.',
  checkInternet: 'कृपया इंटरनेट कनेक्शन तपासा.',
  accessDenied: 'या माहितीमध्ये प्रवेश करण्याची परवानगी नाही.',
  notFound: 'माहिती सापडली नाही.',
} as const;

export const TERM_LABEL: Record<Term, string> = { 1: 'प्रथम सत्र', 2: 'द्वितीय सत्र' };
export const PERIOD_LABEL: Record<string, string> = { '1': 'प्रथम सत्र', '2': 'द्वितीय सत्र', annual: 'वार्षिक' };
export function periodLabel(p: Period): string {
  return PERIOD_LABEL[String(p)];
}

export const GENDER_LABEL: Record<Gender, string> = { M: 'मुलगा', F: 'मुलगी' };
/** Plural forms used in summary tables. */
export const GENDER_PLURAL: Record<Gender, string> = { M: 'मुले', F: 'मुली' };

export const STANDARD_WORDS: Record<number, string> = {
  1: 'पहिली',
  2: 'दुसरी',
  3: 'तिसरी',
  4: 'चौथी',
  5: 'पाचवी',
  6: 'सहावी',
  7: 'सातवी',
  8: 'आठवी',
  9: 'नववी',
  10: 'दहावी',
};

const DEV_DIGITS = '०१२३४५६७८९';
export function toDevDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => DEV_DIGITS[Number(d)]);
}

export function standardLabel(n: number | null | undefined): string {
  if (!n) return '';
  return STANDARD_WORDS[n] ?? `${n} वी`;
}

/** "इयत्ता ७ वी" style */
export function standardOrdinal(n: number): string {
  return `${toDevDigits(n)} वी`;
}

export const SECTIONS = ['अ', 'ब', 'क', 'ड', 'इ', 'फ'];

export const MONTH_NAMES = [
  'जानेवारी',
  'फेब्रुवारी',
  'मार्च',
  'एप्रिल',
  'मे',
  'जून',
  'जुलै',
  'ऑगस्ट',
  'सप्टेंबर',
  'ऑक्टोबर',
  'नोव्हेंबर',
  'डिसेंबर',
];

export const MONTH_SHORT = ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'];

/** प्रवर्ग (category) list used in Maharashtra school records. */
export const CATEGORIES: { code: string; label: string; short: string }[] = [
  { code: 'SC', label: 'अनुसूचित जाती (SC)', short: 'अ.जा.' },
  { code: 'ST', label: 'अनुसूचित जमाती (ST)', short: 'अ.ज.' },
  { code: 'VJA', label: 'विमुक्त जाती – अ (VJ/DT-A)', short: 'वि.जा.(अ)' },
  { code: 'NTB', label: 'भटक्या जमाती – ब (NT-B)', short: 'भ.ज.(ब)' },
  { code: 'NTC', label: 'भटक्या जमाती – क (NT-C)', short: 'भ.ज.(क)' },
  { code: 'NTD', label: 'भटक्या जमाती – ड (NT-D)', short: 'भ.ज.(ड)' },
  { code: 'OBC', label: 'इतर मागास वर्ग (OBC)', short: 'इ.मा.व.' },
  { code: 'SBC', label: 'विशेष मागास प्रवर्ग (SBC)', short: 'वि.मा.प्र.' },
  { code: 'SEBC', label: 'सामाजिक व शैक्षणिक मागास वर्ग (SEBC)', short: 'SEBC' },
  { code: 'EWS', label: 'आर्थिक दुर्बल घटक (EWS)', short: 'EWS' },
  { code: 'OPEN', label: 'खुला (Open)', short: 'खुला' },
];

/**
 * जात संवर्ग groups used by the जातीनिहाय संकलन तक्ता (order as printed).
 * Students without a प्रवर्ग fall into "नोंद नाही".
 */
export const CASTE_GROUPS: { key: string; label: string; codes: string[] }[] = [
  { key: 'SC', label: 'अनुसूचित जाती', codes: ['SC'] },
  { key: 'ST', label: 'अनुसूचित जमाती', codes: ['ST'] },
  { key: 'NT', label: 'भटक्या जाती', codes: ['NTB', 'NTC', 'NTD'] },
  { key: 'VJ', label: 'विमुक्त जाती', codes: ['VJA'] },
  { key: 'OBC', label: 'इतर मागास', codes: ['OBC', 'SBC', 'SEBC'] },
  { key: 'OPEN', label: 'बिगर मागास', codes: ['OPEN', 'EWS'] },
];
export const NO_GROUP = { key: 'NONE', label: 'नोंद नाही' };

export function casteGroupOf(category: string): string {
  return CASTE_GROUPS.find((g) => g.codes.includes(category))?.key ?? NO_GROUP.key;
}

/** "6 वी", "1 ली", "2 री", "4 थी" (digits as given). */
export function standardNum(n: number): string {
  const suffix = n === 1 ? 'ली' : n === 2 || n === 3 ? 'री' : n === 4 ? 'थी' : 'वी';
  return `${n} ${suffix}`;
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}
export function categoryShort(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.short ?? code;
}

export const RELIGIONS = ['हिंदू', 'बौद्ध', 'मुस्लिम', 'ख्रिश्चन', 'जैन', 'शीख', 'पारशी', 'इतर'];

export const LEAVING_REASONS = [
  'प्राथमिक शिक्षण पूर्ण झाल्यामुळे',
  'पुढील शिक्षणासाठी',
  'पालकांच्या विनंतीवरून',
  'पालकांची बदली झाल्यामुळे',
  'स्थलांतरामुळे',
  'इतर शाळेत प्रवेशासाठी',
];

export const CONDUCT_OPTIONS = ['उत्तम', 'चांगली', 'समाधानकारक'];
export const PROGRESS_OPTIONS = ['उत्तम', 'चांगली', 'समाधानकारक', 'साधारण'];

export const REMARK_CATEGORY_LABEL: Record<RemarkCategory, string> = {
  marathi: 'भाषा – मराठी',
  hindi: 'भाषा – हिंदी',
  english: 'भाषा – इंग्रजी',
  math: 'गणित',
  science: 'विज्ञान / परिसर अभ्यास',
  social: 'सामाजिक शास्त्र',
  art: 'कला',
  work: 'कार्यानुभव',
  pe: 'शारीरिक शिक्षण',
  special: 'विशेष प्रगती',
  hobby: 'आवड / छंद',
  improve: 'सुधारणा आवश्यक',
  personality: 'व्यक्तिमत्व गुण',
};

export const REMARK_CATEGORIES = Object.keys(REMARK_CATEGORY_LABEL) as RemarkCategory[];

export const SPECIAL_AREAS: { key: SpecialArea; label: string; short: string; cat: RemarkCategory }[] = [
  { key: 'special', label: 'विशेष प्रगती', short: 'विशेष प्रगती', cat: 'special' },
  { key: 'hobby', label: 'आवड, छंद कला, क्रीडा, साहित्य इ.', short: 'आवड, छंद इ.', cat: 'hobby' },
  { key: 'improve', label: 'सुधारणा आवश्यक', short: 'सुधारणा आवश्यक', cat: 'improve' },
  {
    key: 'personality',
    label: 'व्यक्तिमत्व गुण विशेष (अभिवृत्ती, कल, मूल्ये, स्वभाव गुणविशेष)',
    short: 'व्यक्तिमत्व गुण विशेष',
    cat: 'personality',
  },
];

export const ROLE_LABEL = { admin: 'मुख्याध्यापक / प्रशासक', teacher: 'वर्गशिक्षक' } as const;
