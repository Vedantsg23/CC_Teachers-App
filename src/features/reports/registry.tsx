/** All printable reports (अहवाल) with their options and layouts. */
import type { ReactNode } from 'react';
import type { IconName } from '../../components/Icon';
import type { Orientation } from '../../components/report/Report';
import type { ReportCtx, ReportOpts } from './common';
import {
  AttendanceReport,
  ClassABReport,
  ClassRegisterReport,
  CoverReport,
  IndexReport,
  StudentListReport,
  StudentWiseReport,
  SubjectWiseReport,
  TypeSummaryReport,
} from './templates/registers';
import { AnnualMarksheetReport, CategoryWiseReport, GradeWiseReport, ProgressCardReport, RemarksReport, ResultSheetReport } from './templates/results';

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
  { key: 'index', title: 'अनुक्रमणिका', group: 'वर्ग नोंदवही', icon: 'list', orientation: 'portrait', opts: ['term'], desc: 'अ.नं., विद्यार्थ्याचे नाव, रजि.नं., जन्मतारीख, पृष्ठ क्र.', render: (c, o) => <IndexReport ctx={c} opts={o} /> },
  { key: 'student-list', title: 'विद्यार्थी यादी', group: 'वर्ग नोंदवही', icon: 'student', orientation: 'landscape', opts: [], desc: 'वर्गातील सर्व विद्यार्थ्यांची माहिती', render: (c) => <StudentListReport ctx={c} /> },
  { key: 'attendance', title: 'उपस्थिती', group: 'वर्ग नोंदवही', icon: 'calendar', orientation: 'landscape', opts: ['period'], desc: 'महिनावार हजर दिवस, एकूण उपस्थिती व टक्केवारी', render: (c, o) => <AttendanceReport ctx={c} opts={o} /> },

  { key: 'formative', title: 'आकारिक मूल्यमापन', group: 'मूल्यमापन नोंदी', icon: 'formative', orientation: 'landscape', opts: ['term'], desc: 'प्रत्येक विषयाचे आकारिक (अ) गुण', render: (c, o) => <TypeSummaryReport ctx={c} opts={o} type="F" /> },
  { key: 'summative', title: 'संकलित मूल्यमापन', group: 'मूल्यमापन नोंदी', icon: 'summative', orientation: 'landscape', opts: ['term'], desc: 'प्रत्येक विषयाचे संकलित (ब) गुण', render: (c, o) => <TypeSummaryReport ctx={c} opts={o} type="S" /> },
  { key: 'subject-wise', title: 'विषयवार CCE नोंद', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'portrait', opts: ['term', 'subject', 'orientation'], desc: 'निरीक्षण ते इतर साधने, संकलित भाग, अ+ब, शे.गुण, श्रेणी', render: (c, o) => <SubjectWiseReport ctx={c} opts={o} /> },
  { key: 'student-wise', title: 'विद्यार्थीवार CCE', group: 'मूल्यमापन नोंदी', icon: 'student', orientation: 'portrait', opts: ['term', 'student'], desc: 'प्रत्येक विद्यार्थ्याचे विषयवार प्राप्त / पैकी गुण', render: (c, o) => <StudentWiseReport ctx={c} opts={o} /> },
  { key: 'class-register', title: 'वर्गनिहाय CCE नोंद (गुण–श्रेणी)', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'landscape', opts: ['term'], desc: 'लिंग, हजर दिवस, विषयवार गुण व श्रेणी आणि श्रेणी सारांश', render: (c, o) => <ClassRegisterReport ctx={c} opts={o} /> },
  { key: 'class-ab', title: 'वर्गनिहाय CCE नोंद (अ–ब)', group: 'मूल्यमापन नोंदी', icon: 'table', orientation: 'landscape', opts: ['term'], desc: 'आकारिक, संकलित, एकूण (अ+ब), श्रेणी आणि श्रेणी सारांश', render: (c, o) => <ClassABReport ctx={c} opts={o} /> },

  { key: 'remarks', title: 'वर्णनात्मक नोंदी', group: 'नोंदी व निकाल', icon: 'remarks', orientation: 'portrait', opts: ['term', 'student'], desc: 'विषयवार वर्णनात्मक नोंदी व विशेष नोंदी', render: (c, o) => <RemarksReport ctx={c} opts={o} /> },
  { key: 'progress-card', title: 'प्रगती कार्ड', group: 'नोंदी व निकाल', icon: 'progress', orientation: 'landscape', opts: ['student'], desc: 'प्रथम व द्वितीय सत्र शेजारी — गुण, श्रेणी, नोंदी, स्वाक्षऱ्या', render: (c, o) => <ProgressCardReport ctx={c} opts={o} /> },
  { key: 'annual-marksheet', title: 'वार्षिक गुणपत्रक', group: 'नोंदी व निकाल', icon: 'marksheet', orientation: 'portrait', opts: ['student'], desc: 'दोन्ही सत्रांचे गुण, वार्षिक गुण, टक्केवारी, श्रेणी व निकाल', render: (c, o) => <AnnualMarksheetReport ctx={c} opts={o} /> },
  { key: 'result-sheet', title: 'निकाल पत्रक', group: 'नोंदी व निकाल', icon: 'trophy', orientation: 'landscape', opts: ['period'], desc: 'विषयवार गुण, एकूण, टक्केवारी, श्रेणी, निकाल व सारांश', render: (c, o) => <ResultSheetReport ctx={c} opts={o} /> },
  { key: 'grade-wise', title: 'श्रेणीवार निकाल', group: 'नोंदी व निकाल', icon: 'bars', orientation: 'landscape', opts: ['period'], desc: 'विषयवार प्रत्येक श्रेणीतील मुले-मुली, पट व उपस्थिती', render: (c, o) => <GradeWiseReport ctx={c} opts={o} /> },
  { key: 'category-wise', title: 'जातनिहाय / प्रवर्गनिहाय निकाल', group: 'नोंदी व निकाल', icon: 'group', orientation: 'portrait', opts: ['period', 'group'], desc: 'प्रवर्ग / जात, मुलगे, मुली, एकूण, उत्तीर्ण, टक्केवारी', render: (c, o) => <CategoryWiseReport ctx={c} opts={o} /> },
];

export function findReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}
