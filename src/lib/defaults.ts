/**
 * Defaults for new classes. Everything here is only a starting point —
 * teachers can change subjects, tools, weightage (भारांश), grade bands and
 * result rules from सेटिंग्ज.
 *
 * Weightage per term (marks out of 100 for each scholastic subject), as used
 * in Maharashtra CCE (std 1–8):
 *   इ. 1–2: आकारिक 70 + संकलित 30
 *   इ. 3–4: आकारिक 60 + संकलित 40
 *   इ. 5–6: आकारिक 50 + संकलित 50
 *   इ. 7–8: आकारिक 40 + संकलित 60
 * कला, कार्यानुभव, शारीरिक शिक्षण: 100 गुण आकारिक मूल्यमापन.
 */
import type {
  ClassConfig,
  GradeBand,
  LcTemplate,
  RemarkCategory,
  ReportSettings,
  ResultRules,
  Subject,
  SubjectWeights,
  ToolDef,
  ToolMax,
  Weights,
} from './types';

export const DEFAULT_F_TOOLS: ToolDef[] = [
  { key: 'obs', label: 'निरीक्षण' },
  { key: 'oral', label: 'तोंडीकाम' },
  { key: 'prac', label: 'प्रात्यक्षिक' },
  { key: 'act', label: 'उपक्रम' },
  { key: 'proj', label: 'प्रकल्प' },
  { key: 'test', label: 'चाचणी' },
  { key: 'hw', label: 'स्वाध्याय' },
  { key: 'other', label: 'इतर' },
];

export const DEFAULT_S_PARTS: ToolDef[] = [
  { key: 'oral', label: 'तोंडी' },
  { key: 'prac', label: 'प्रात्य.' },
  { key: 'written', label: 'लेखी' },
];

const CO_SCHOLASTIC = new Set<RemarkCategory>(['art', 'work', 'pe']);

export function isCoScholasticCat(cat: RemarkCategory): boolean {
  return CO_SCHOLASTIC.has(cat);
}

type SubjectSeed = Omit<Subject, 'inTotal'>;

const S_MARATHI: SubjectSeed = { id: 'marathi', name: 'मराठी', short: 'मराठी', remarkLabel: 'प्रथम भाषा: मराठी', remarkCat: 'marathi' };
const S_HINDI: SubjectSeed = { id: 'hindi', name: 'हिंदी', short: 'हिंदी', remarkLabel: 'द्वितीय भाषा: हिंदी', remarkCat: 'hindi' };
const S_ENGLISH: SubjectSeed = { id: 'english', name: 'इंग्रजी', short: 'इंग्रजी', remarkLabel: 'तृतीय भाषा: इंग्रजी', remarkCat: 'english' };
const S_MATH: SubjectSeed = { id: 'math', name: 'गणित', short: 'गणित', remarkLabel: 'गणित', remarkCat: 'math' };
const S_SCIENCE: SubjectSeed = {
  id: 'science',
  name: 'सामान्य विज्ञान',
  short: 'सा.वि./ प.अ.',
  remarkLabel: 'सामान्य विज्ञान / परिसर अभ्यास / परिसर अभ्यास 1',
  remarkCat: 'science',
};
const S_SOCIAL: SubjectSeed = {
  id: 'social',
  name: 'सामाजिक शास्त्रे',
  short: 'स.शा.',
  remarkLabel: 'सामाजिक शास्त्रे / परिसर अभ्यास 2',
  remarkCat: 'social',
};
const S_EVS: SubjectSeed = { id: 'evs', name: 'परिसर अभ्यास', short: 'प.अ.', remarkLabel: 'परिसर अभ्यास', remarkCat: 'science' };
const S_EVS1: SubjectSeed = {
  id: 'evs1',
  name: 'परिसर अभ्यास भाग 1',
  short: 'प.अ. 1',
  remarkLabel: 'परिसर अभ्यास भाग 1 (सामान्य विज्ञान)',
  remarkCat: 'science',
};
const S_EVS2: SubjectSeed = {
  id: 'evs2',
  name: 'परिसर अभ्यास भाग 2',
  short: 'प.अ. 2',
  remarkLabel: 'परिसर अभ्यास भाग 2 (इतिहास, नागरिकशास्त्र व भूगोल)',
  remarkCat: 'social',
};
const S_ART: SubjectSeed = { id: 'art', name: 'कला', short: 'कला', remarkLabel: 'कला', remarkCat: 'art' };
const S_WORK: SubjectSeed = { id: 'work', name: 'कार्यानुभव', short: 'कार्यानुभव', remarkLabel: 'कार्यानुभव', remarkCat: 'work' };
const S_PE: SubjectSeed = {
  id: 'pe',
  name: 'शारीरिक शिक्षण व आरोग्य',
  short: 'शा.शि.',
  remarkLabel: 'शारीरिक शिक्षण व आरोग्य',
  remarkCat: 'pe',
};

export function defaultSubjects(standard: number): Subject[] {
  let seeds: SubjectSeed[];
  if (standard <= 2) seeds = [S_MARATHI, S_ENGLISH, S_MATH, S_ART, S_WORK, S_PE];
  else if (standard <= 4) seeds = [S_MARATHI, S_ENGLISH, S_MATH, S_EVS, S_ART, S_WORK, S_PE];
  else if (standard === 5) seeds = [S_MARATHI, S_HINDI, S_ENGLISH, S_MATH, S_EVS1, S_EVS2, S_ART, S_WORK, S_PE];
  else seeds = [S_MARATHI, S_HINDI, S_ENGLISH, S_MATH, S_SCIENCE, S_SOCIAL, S_ART, S_WORK, S_PE];
  return seeds.map((s) => ({ ...s, inTotal: true }));
}

/** आकारिक / संकलित split for scholastic subjects (per term, out of 100). */
export function defaultSplit(standard: number): { f: number; s: number } {
  if (standard <= 2) return { f: 70, s: 30 };
  if (standard <= 4) return { f: 60, s: 40 };
  if (standard <= 6) return { f: 50, s: 50 };
  return { f: 40, s: 60 };
}

const F_DIST: Record<number, (number | null)[]> = {
  // order: निरीक्षण, तोंडीकाम, प्रात्यक्षिक, उपक्रम, प्रकल्प, चाचणी, स्वाध्याय, इतर
  40: [5, 5, 5, 5, 5, 5, 5, 5],
  50: [5, 10, 5, 5, 5, 10, 5, 5],
  60: [10, 10, 5, 5, 5, 10, 10, 5],
  70: [10, 10, 10, 10, 5, 10, 10, 5],
  100: [20, null, 30, 20, 20, null, null, 10],
};

/** Split a formative total across the default tools. */
export function distributeFormative(total: number, tools: ToolDef[] = DEFAULT_F_TOOLS): ToolMax {
  const out: ToolMax = {};
  const preset = tools.length === 8 ? F_DIST[total] : undefined;
  if (preset) {
    tools.forEach((t, i) => (out[t.key] = preset[i]));
    return out;
  }
  const n = tools.length || 1;
  const base = Math.floor(total / n);
  let rem = total - base * n;
  tools.forEach((t) => {
    out[t.key] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  });
  return out;
}

/** Split a summative total: तोंडी 10 + लेखी (rest). */
export function distributeSummative(total: number, parts: ToolDef[] = DEFAULT_S_PARTS): ToolMax {
  const out: ToolMax = {};
  for (const p of parts) out[p.key] = null;
  if (total <= 0) return out;
  const hasOral = parts.some((p) => p.key === 'oral');
  const hasWritten = parts.some((p) => p.key === 'written');
  if (hasOral && hasWritten && total > 10) {
    out.oral = 10;
    out.written = total - 10;
  } else if (hasWritten) out.written = total;
  else if (parts[0]) out[parts[0].key] = total;
  return out;
}

export function defaultSubjectWeights(subject: Subject, standard: number, fTools = DEFAULT_F_TOOLS, sParts = DEFAULT_S_PARTS): SubjectWeights {
  if (isCoScholasticCat(subject.remarkCat)) {
    return { F: distributeFormative(100, fTools), S: distributeSummative(0, sParts) };
  }
  const { f, s } = defaultSplit(standard);
  return { F: distributeFormative(f, fTools), S: distributeSummative(s, sParts) };
}

export function defaultWeights(subjects: Subject[], standard: number): Weights {
  const term: Record<string, SubjectWeights> = {};
  for (const s of subjects) term[s.id] = defaultSubjectWeights(s, standard);
  return { '1': structuredClone(term), '2': structuredClone(term) };
}

/** Maharashtra CCE grade bands (std 1–8). */
export function defaultGrades(): GradeBand[] {
  return [
    { label: 'अ-1', min: 91 },
    { label: 'अ-2', min: 81 },
    { label: 'ब-1', min: 71 },
    { label: 'ब-2', min: 61 },
    { label: 'क-1', min: 51 },
    { label: 'क-2', min: 41 },
    { label: 'ड', min: 33 },
    { label: 'इ-1', min: 21 },
    { label: 'इ-2', min: 0 },
  ];
}

export function defaultResultRules(): ResultRules {
  return {
    overallMin: 33,
    subjectMin: 33,
    passLabel: 'उत्तीर्ण',
    failLabel: 'आवश्यक सुधारणा',
    absentLabel: 'अनुपस्थित',
    incompleteLabel: 'अपूर्ण',
    roundForGrade: true,
  };
}

export function defaultReportSettings(): ReportSettings {
  return {
    teacherSignLabel: 'वर्गशिक्षक स्वाक्षरी',
    headSignLabel: 'मुख्याध्यापक स्वाक्षरी',
    parentSignLabel: 'पालक स्वाक्षरी',
    showPageNumbers: true,
    showSchoolOnCards: true,
    marathiDigits: true,
  };
}

export function defaultConfig(standard: number): ClassConfig {
  const subjects = defaultSubjects(standard);
  return {
    subjects,
    fTools: structuredClone(DEFAULT_F_TOOLS),
    sParts: structuredClone(DEFAULT_S_PARTS),
    weights: defaultWeights(subjects, standard),
    grades: defaultGrades(),
    result: defaultResultRules(),
    report: defaultReportSettings(),
  };
}

export function defaultLcTemplate(): LcTemplate {
  return {
    title: 'शाळा सोडल्याचा दाखला',
    headerNote: '(या दाखल्यात कोणताही बदल करू नये.)',
    fields: [
      { key: 'regNo', label: 'प्रवेश क्रमांक (जनरल रजिस्टर क्र.)', enabled: true },
      { key: 'saralId', label: 'विद्यार्थी आयडी (सरल)', enabled: true },
      { key: 'pen', label: 'UDISE PEN क्रमांक', enabled: true },
      { key: 'fullName', label: 'विद्यार्थ्याचे संपूर्ण नाव', enabled: true },
      { key: 'motherName', label: 'आईचे नाव', enabled: true },
      { key: 'fatherName', label: 'वडिलांचे / पालकांचे नाव', enabled: true },
      { key: 'nationality', label: 'राष्ट्रीयत्व', enabled: true },
      { key: 'motherTongue', label: 'मातृभाषा', enabled: true },
      { key: 'religion', label: 'धर्म', enabled: true },
      { key: 'caste', label: 'जात', enabled: true },
      { key: 'category', label: 'जात प्रवर्ग', enabled: true },
      { key: 'birthPlace', label: 'जन्मस्थळ (गाव / तालुका / जिल्हा)', enabled: true },
      { key: 'dob', label: 'जन्मदिनांक (अंकी)', enabled: true },
      { key: 'dobWords', label: 'जन्मदिनांक (अक्षरी)', enabled: true },
      { key: 'previousSchool', label: 'यापूर्वीची शाळा व इयत्ता', enabled: true },
      { key: 'admissionDate', label: 'या शाळेत प्रवेश घेतल्याचा दिनांक', enabled: true },
      { key: 'admissionStd', label: 'प्रवेशाच्या वेळची इयत्ता', enabled: true },
      { key: 'currentStd', label: 'सध्याची इयत्ता', enabled: true },
      { key: 'lastStd', label: 'कोणत्या इयत्तेत शिकत होता व केव्हापासून', enabled: true },
      { key: 'progress', label: 'अभ्यासातील प्रगती', enabled: true },
      { key: 'conduct', label: 'वर्तणूक / आचरण', enabled: true },
      { key: 'lastAttended', label: 'शाळेतील शेवटचा उपस्थित दिवस', enabled: true },
      { key: 'leftDate', label: 'शाळा सोडल्याचा दिनांक', enabled: true },
      { key: 'reason', label: 'शाळा सोडण्याचे कारण', enabled: true },
      { key: 'remark', label: 'शेरा', enabled: true },
    ],
    certText: 'दाखला देण्यात येतो की, वरील माहिती शाळेतील जनरल रजिस्टर क्रमांक {regNo} प्रमाणे आहे.',
    signLabels: ['वर्गशिक्षक', 'लिपिक', 'मुख्याध्यापक'],
  };
}

/**
 * Starter remark library (masculine forms; feminine forms are derived with
 * toFeminine() and can be edited by the teacher).
 */
export const SEED_REMARKS: Record<RemarkCategory, string[]> = {
  marathi: [
    'अभ्यासलेल्या पाठातील प्रसंगाप्रमाणे काल्पनिक प्रसंग सांगतो.',
    'कविता तालासुरात म्हणतो.',
    'शुद्धलेखनाचे नियम पाळून लेखन करतो.',
    'स्पष्ट उच्चारांसह प्रकट वाचन करतो.',
    'स्वतःच्या शब्दांत गोष्ट सांगतो.',
    'प्रश्नांची उत्तरे पूर्ण वाक्यात लिहितो.',
    'सुवाच्य व सुंदर अक्षरात लेखन करतो.',
    'विरामचिन्हांचा योग्य वापर करतो.',
    'दिलेल्या विषयावर निबंध लिहितो.',
    'उतारा वाचून त्यावरील प्रश्नांची उत्तरे देतो.',
    'नवीन शब्दांचा अर्थ समजून वाक्यात उपयोग करतो.',
    'संवाद योग्य हावभावांसह सादर करतो.',
  ],
  hindi: [
    'जानकारी प्राप्त करने के लिए विविध स्रोतों का उपयोग करता है।',
    'कविता का सस्वर पाठ करता है।',
    'पाठ का आशय अपने शब्दों में बताता है।',
    'शुद्ध उच्चारण के साथ वाचन करता है।',
    'सरल वाक्यों में अपने विचार लिखता है।',
    'कहानी ध्यान से सुनकर प्रश्नों के उत्तर देता है।',
    'व्याकरण के नियमों का सही प्रयोग करता है।',
    'हिंदी में बातचीत करने का प्रयास करता है।',
    'सुंदर और सुवाच्य लेखन करता है।',
    'चित्र देखकर वर्णन करता है।',
  ],
  english: [
    'He reads simple English words.',
    'He recites English poems with proper rhythm.',
    'He answers simple questions in English.',
    'He writes neatly with correct spelling.',
    'He understands and follows simple instructions.',
    'He uses new words in sentences.',
    'He reads the lesson fluently.',
    'He describes a picture in simple sentences.',
    'He takes part in English conversation.',
    'He writes short paragraphs on familiar topics.',
  ],
  math: [
    'आकृतीतील चौकोन व त्रिकोणांची संख्या सांगतो.',
    'गणिती क्रिया अचूकपणे करतो.',
    'शाब्दिक उदाहरणे समजून सोडवतो.',
    'पाढे अचूक म्हणतो.',
    'भौमितिक आकृत्या अचूक काढतो.',
    'अपूर्णांकांवरील क्रिया करतो.',
    'मापनाची एकके ओळखून रूपांतर करतो.',
    'मोठ्या संख्यांचे वाचन व लेखन करतो.',
    'आलेख व सारणीतील माहितीचे वाचन करतो.',
    'तोंडी गणिते जलद सोडवतो.',
    'गणितातील संकल्पना उदाहरणांसह स्पष्ट करतो.',
  ],
  science: [
    'चित्राचे व आकृतीचे निरीक्षण करून चर्चेत सहभाग घेतो.',
    'प्रयोग काळजीपूर्वक करून निष्कर्ष काढतो.',
    'परिसरातील वनस्पती व प्राण्यांचे निरीक्षण करतो.',
    'वैज्ञानिक संकल्पना उदाहरणांसह स्पष्ट करतो.',
    'आकृत्या सुबक व नामनिर्देशित काढतो.',
    'आरोग्य व स्वच्छतेच्या सवयी पाळतो.',
    'दैनंदिन जीवनातील विज्ञान ओळखतो.',
    'प्रश्न विचारून जिज्ञासा व्यक्त करतो.',
    'पर्यावरण संवर्धनाविषयी जागरूकता दाखवतो.',
    'वर्गीकरण करून तक्ता तयार करतो.',
  ],
  social: [
    'ऐतिहासिक साधनांविषयी माहितीची कात्रणे जमा करतो.',
    'नकाशा वाचन व्यवस्थित करतो.',
    'ऐतिहासिक घटनांचा क्रम सांगतो.',
    'नागरिकशास्त्रातील संकल्पना स्पष्ट करतो.',
    'भौगोलिक घटकांची माहिती सांगतो.',
    'थोर व्यक्तींच्या कार्याची माहिती सांगतो.',
    'नकाशात ठिकाणे अचूक दाखवतो.',
    'सण, उत्सव व परंपरा यांची माहिती सांगतो.',
    'सामाजिक समस्यांवर आपले मत मांडतो.',
    'स्थानिक शासन संस्थांची माहिती सांगतो.',
  ],
  art: [
    'मातीच्या वस्तूंना आकर्षक रंग - रंगोटी करतो.',
    'चित्रात रंगसंगती योग्य साधतो.',
    'सुबक रांगोळी काढतो.',
    'गीत तालासुरात गातो.',
    'नृत्यात उत्साहाने सहभाग घेतो.',
    'कागदकाम व हस्तकलेच्या वस्तू तयार करतो.',
    'नाट्यीकरणात सहभाग घेतो.',
    'निसर्गचित्र सुंदर काढतो.',
    'वाद्य वाजवण्यात रुची दाखवतो.',
  ],
  work: [
    'परिसरातील घटकांचा व क्रमांचा परस्परसंबंध लक्षात घेतो.',
    'टाकाऊ वस्तूंपासून टिकाऊ वस्तू तयार करतो.',
    'परसबागेच्या कामात सहभाग घेतो.',
    'वर्ग व शाळा स्वच्छतेत सहभाग घेतो.',
    'साधनांचा सुरक्षित वापर करतो.',
    'दिलेले काम वेळेत पूर्ण करतो.',
    'गटकार्यात सहकार्य करतो.',
    'शिवणकाम व विणकामाची प्राथमिक कौशल्ये आत्मसात करतो.',
  ],
  pe: [
    'खेळातील वाद - विवाद समंजसपणे मिटवतो.',
    'नियमित व्यायाम करतो.',
    'खेळाचे नियम पाळतो.',
    'सांघिक खेळात सहकार्य करतो.',
    'योगासने व्यवस्थित करतो.',
    'कवायत शिस्तबद्धपणे करतो.',
    'धावण्याच्या स्पर्धेत सहभाग घेतो.',
    'आरोग्यदायी सवयींचे पालन करतो.',
    'खिलाडूवृत्ती दाखवतो.',
  ],
  special: [
    'शालेय उपक्रमात सहभाग घेतो.',
    'वर्गात नियमित उपस्थित राहतो.',
    'अभ्यासात सातत्य ठेवतो.',
    'वक्तृत्व स्पर्धेत सहभाग घेतो.',
    'अवांतर वाचन करतो.',
    'गणितात विशेष प्रगती करतो.',
    'हस्ताक्षरात चांगली सुधारणा करतो.',
    'नेतृत्वगुण दाखवतो.',
  ],
  hobby: [
    'सायकल खेळणे.',
    'चित्र काढणे.',
    'गोष्टींची पुस्तके वाचणे.',
    'क्रिकेट खेळणे.',
    'गाणी गाणे.',
    'नृत्य करणे.',
    'कबड्डी खेळणे.',
    'बागकाम करणे.',
    'खो-खो खेळणे.',
    'पोस्टाची तिकिटे जमवणे.',
  ],
  improve: [
    'वाचन, लेखनाकडे लक्ष द्यावे.',
    'शुद्धलेखनाकडे लक्ष द्यावे.',
    'गणितीय क्रियांचा सराव करावा.',
    'नियमित उपस्थित राहावे.',
    'गृहपाठ वेळेवर पूर्ण करावा.',
    'अक्षर सुवाच्य काढावे.',
    'पाढ्यांचा सराव करावा.',
    'वर्गात लक्षपूर्वक ऐकावे.',
    'इंग्रजी वाचनाचा सराव करावा.',
  ],
  personality: [
    'उपक्रमामध्ये कृतीशील सहभाग घेतो.',
    'नम्रपणे व शिस्तीत वागतो.',
    'मित्रांना मदत करतो.',
    'स्वच्छता व टापटीप ठेवतो.',
    'वडीलधाऱ्यांचा आदर करतो.',
    'प्रामाणिकपणे वागतो.',
    'आत्मविश्वासाने बोलतो.',
    'जबाबदारीने काम करतो.',
    'सर्वांशी मिळूनमिसळून वागतो.',
    'वेळेचे पालन करतो.',
  ],
};
