/** All printable reports (अहवाल) with their options and layouts. */
import type { ReactNode } from 'react';
import type { IconName } from '../../components/Icon';
import type { Orientation } from '../../components/report/Report';
import type { ReportCtx, ReportOpts } from './common';
import { AttendanceReport, ClassABReport, ClassRegisterReport, CoverReport, IndexReport, StudentListReport, SubjectWiseReport, TypeSummaryReport } from './templates/registers';
import { ProgressCardReport } from './templates/progress';
import { AnnualMarksheetReport, ResultSummaryReport } from './templates/results';
import { RemarksBookReport, StudentSheetReport } from './templates/sheets';
import { CasteGradeSummaryReport, ResultBothTermsReport, SubjectGradeSummaryReport } from './templates/summaries';

export type OptKey = 'term' | 'period' | 'subject' | 'student' | 'group' | 'orientation';

export interface ReportDef {
  key: string;
  title: string;
  group: string;
  icon: IconName;
  orientation: Orientation;
  opts: OptKey[];
  desc: string;
  render: (ctx: ReportCtx, opts: ReportOpts) => ReactNode;
}

export const REPORTS: ReportDef[] = [
  { key: 'cover', title: 'मुखपृष्ठ', group: 'वर्ग नोंदवही', icon: 'book', orientation: 'portrait', opts: [], desc: 'नोंदवहीचे मुखपृष्ठ — शाळा, युडायस, वर्गशिक्षक, इयत्ता, तुकडी', render: (c) => <CoverReport ctx={c} /> },
  { key: 'index', title: 'अनुक्रमणिका', group: 'वर्ग नोंदवही', icon: 'list', orientation: 'portrait', opts: [], desc: 'शाळेचे नाव, इयत्ता, शैक्षणिक वर्ष — अनुक्रमांक, विद्यार्थ्याचे नाव व परीक्षा क्रमांक', render: (c) => <IndexReport ctx={c} /> },
  { key: 'student-list', title: 'विद्यार्थी यादी', group: 'वर्ग नोंदवही', icon: 'student', orientation: 'landscape', opts: [], desc: 'वर्गातील सर्व विद्यार्थ्यांची माहिती', render: (c) => <StudentListReport ctx={c} /> },
  { key: 'attendance', title: 'उपस्थिती', group: 'वर्ग नोंदवही', icon: 'calendar', orientation: 'landscape', opts: ['period'], desc: 'महिनावार हजर दिवस, एकूण उपस्थिती व टक्केवारी', render: (c, o) => <AttendanceReport ctx={c} opts={o} /> },

  { key: 'formative', title: 'आकारिक मूल्यमापन', group: 'मूल्यमापन नोंदी', icon: 'formative', orientation: 'landscape', opts: ['term'], desc: 'प्रत्येक विषयाचे आकारिक (अ) गुण', render: (c, o) => <TypeSummaryReport ctx={c} opts={o} type="F" /> },
  { key: 'summative', title: 'संकलित मूल्यमापन', group: 'मूल्यमापन नोंदी', icon: 'summative', orientation: 'landscape', opts: ['term'], desc: 'प्रत्येक विषयाचे संकलित (ब) गुण', render: (c, o) => <TypeSummaryReport ctx={c} opts={o} type="S" /> },
  { key: 'subject-wise', title: 'विषयवार CCE नोंद', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'portrait', opts: ['term', 'subject', 'orientation'], desc: 'निरीक्षण ते इतर साधने, संकलित भाग, अ+ब, शे.गुण, श्रेणी', render: (c, o) => <SubjectWiseReport ctx={c} opts={o} /> },
  { key: 'student-wise', title: 'विद्यार्थीवार CCE नोंदपत्र', group: 'मूल्यमापन नोंदी', icon: 'student', orientation: 'portrait', opts: ['student'], desc: 'प्रथम व द्वितीय सत्र एकाच पानावर — साधननिहाय प्राप्त / पैकी गुण, एकूण, शेकडा, श्रेणी', render: (c, o) => <StudentSheetReport ctx={c} opts={o} /> },
  { key: 'class-register', title: 'वर्गनिहाय CCE नोंद (गुण–श्रेणी)', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'landscape', opts: ['term'], desc: 'लिंग, हजर दिवस, विषयवार गुण व श्रेणी आणि श्रेणी सारांश', render: (c, o) => <ClassRegisterReport ctx={c} opts={o} /> },
  { key: 'class-ab', title: 'वर्गनिहाय CCE नोंद (अ–ब)', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'landscape', opts: ['term'], desc: 'आकारिक, संकलित, एकूण (अ+ब), श्रेणी आणि श्रेणी सारांश', render: (c, o) => <ClassABReport ctx={c} opts={o} /> },

  { key: 'remarks', title: 'वर्णनात्मक नोंद वही', group: 'नोंदी व निकाल', icon: 'remarks', orientation: 'portrait', opts: ['student'], desc: 'प्रथम व द्वितीय सत्राच्या विषयवार नोंदी शेजारी — विशेष प्रगती, आवड/छंद, सुधारणा', render: (c, o) => <RemarksBookReport ctx={c} opts={o} /> },
  { key: 'progress-card', title: 'प्रगती कार्ड', group: 'नोंदी व निकाल', icon: 'progress', orientation: 'portrait', opts: ['student'], desc: 'मुखपृष्ठ: शाळा, इयत्ता, सन, विद्यार्थ्याची माहिती व मासिक उपस्थिती; दुसरे पान: दोन्ही सत्रांच्या विषयनिहाय श्रेणी, विशेष नोंदी व स्वाक्षऱ्या', render: (c, o) => <ProgressCardReport ctx={c} opts={o} /> },
  { key: 'annual-marksheet', title: 'वार्षिक गुणपत्रक', group: 'नोंदी व निकाल', icon: 'marksheet', orientation: 'portrait', opts: ['student'], desc: 'दोन्ही सत्रांचे गुण, वार्षिक गुण, टक्केवारी, श्रेणी व निकाल', render: (c, o) => <AnnualMarksheetReport ctx={c} opts={o} /> },
  { key: 'result-sheet', title: 'निकाल पत्रक (दोन्ही सत्रे)', group: 'नोंदी व निकाल', icon: 'trophy', orientation: 'landscape', opts: [], desc: 'प्रत्येक विषयाचे प्रथम व द्वितीय सत्राचे आकारिक, संकलित, एकूण व श्रेणी; जात/संवर्ग, उपस्थित दिवस', render: (c) => <ResultBothTermsReport ctx={c} /> },
  { key: 'grade-wise', title: 'विषयनिहाय / श्रेणीनिहाय संकलन तक्ता', group: 'नोंदी व निकाल', icon: 'bars', orientation: 'landscape', opts: [], desc: 'प्रत्येक विषयाचा प्रथम व द्वितीय सत्राचा पट व श्रेणीनिहाय मुलगे-मुली', render: (c) => <SubjectGradeSummaryReport ctx={c} /> },
  { key: 'category-wise', title: 'जातीनिहाय / श्रेणीनिहाय संकलन तक्ता', group: 'नोंदी व निकाल', icon: 'group', orientation: 'landscape', opts: [], desc: 'जात संवर्गनिहाय पटसंख्या, उपस्थित विद्यार्थी व श्रेणी — दोन्ही सत्रे', render: (c) => <CasteGradeSummaryReport ctx={c} /> },
  { key: 'result-summary', title: 'निकाल — एकूण व टक्केवारी', group: 'नोंदी व निकाल', icon: 'marksheet', orientation: 'landscape', opts: ['period'], desc: 'विषयवार एकूण गुण, टक्केवारी, श्रेणी, उत्तीर्ण/निकाल व सारांश', render: (c, o) => <ResultSummaryReport ctx={c} opts={o} /> },
];

export function findReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}
