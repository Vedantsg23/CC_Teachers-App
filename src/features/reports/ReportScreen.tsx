import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { monthOfDate, safeFileName, termOfMonth, todayIso } from '../../lib/format';
import { standardLabel, TERM_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import type { Period, Term } from '../../lib/types';
import { ReportViewer } from '../../components/report/ReportViewer';
import { EmptyState, LinkButton, Segmented } from '../../components/ui';
import type { ReportCtx, ReportOpts } from './common';
import { findReport } from './registry';

function SmallSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col sm:max-w-[300px]">
      <span className="mb-0.5 text-[12.5px] font-semibold text-muted">{label}</span>
      <select className="field-input !min-h-[40px] !py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ReportScreen({ reportKey }: { reportKey?: string }) {
  const params = useParams();
  const key = reportKey ?? params.key ?? '';
  const def = findReport(key);
  const { school, cls, cfg, user } = useTeacher();
  const b = useClassBundle();
  const lc = useLiveQuery(() => repo.getLcTemplate(), []);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();

  const defaultTerm: Term = termOfMonth(monthOfDate(todayIso()));
  const opts: ReportOpts = useMemo(() => {
    const t = sp.get('term');
    const p = sp.get('period');
    const ts = sp.get('terms');
    return {
      term: t === '2' ? 2 : t === '1' ? 1 : defaultTerm,
      terms: ts === '1' ? [1] : ts === '2' ? [2] : [1, 2],
      period: p === '1' ? 1 : p === '2' ? 2 : p === 'annual' ? 'annual' : ((defaultTerm === 1 ? 1 : 'annual') as Period),
      subject: sp.get('subject') ?? 'all',
      student: sp.get('student') ?? 'all',
      group: sp.get('group') === 'caste' ? 'caste' : 'category',
      orientation: sp.get('orientation') === 'landscape' ? 'landscape' : sp.get('orientation') === 'portrait' ? 'portrait' : (def?.orientation ?? 'portrait'),
    };
  }, [sp, defaultTerm, def?.orientation]);

  if (!def) {
    return <EmptyState icon="info" title="हा अहवाल सापडला नाही." action={<LinkButton to="/reports" variant="primary">अहवाल यादी</LinkButton>} />;
  }
  if (!b || !lc) return null;

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp);
    p.set(k, v);
    setSp(p, { replace: true });
  };
  const close = () => (loc.key === 'default' ? nav('/reports') : nav(-1));

  const ctx: ReportCtx = { school, cls, cfg, teacher: user.displayName, b, lc };
  const paper = sp.get('paper') === 'A3' ? 'A3' : sp.get('paper') === 'A4' ? 'A4' : (def.paper ?? 'A4');
  const termsKey = opts.terms.length === 2 ? 'both' : String(opts.terms[0]);
  const optionUi = def.opts.length ? (
    <div className="flex flex-wrap items-end gap-3">
      {def.opts.includes('terms') ? (
        <div>
          <span className="mb-0.5 block text-[12.5px] font-semibold text-muted">सत्र</span>
          <Segmented
            label="सत्र"
            value={termsKey}
            onChange={(v) => set('terms', v)}
            options={[
              { value: '1', label: TERM_LABEL[1] },
              { value: '2', label: TERM_LABEL[2] },
              { value: 'both', label: 'दोन्ही सत्रे' },
            ]}
          />
        </div>
      ) : null}
      {def.opts.includes('term') ? (
        <div>
          <span className="mb-0.5 block text-[12.5px] font-semibold text-muted">सत्र</span>
          <Segmented label="सत्र" value={opts.term} onChange={(v) => set('term', String(v))} options={[{ value: 1 as Term, label: TERM_LABEL[1] }, { value: 2 as Term, label: TERM_LABEL[2] }]} />
        </div>
      ) : null}
      {def.opts.includes('period') ? (
        <SmallSelect
          label="कालावधी"
          value={String(opts.period)}
          onChange={(v) => set('period', v)}
          options={[
            { value: '1', label: TERM_LABEL[1] },
            { value: '2', label: TERM_LABEL[2] },
            { value: 'annual', label: 'वार्षिक (दोन्ही सत्रे)' },
          ]}
        />
      ) : null}
      {def.opts.includes('subject') ? (
        <SmallSelect label="विषय" value={opts.subject} onChange={(v) => set('subject', v)} options={[{ value: 'all', label: 'सर्व विषय' }, ...cfg.subjects.map((s) => ({ value: s.id, label: s.name }))]} />
      ) : null}
      {def.opts.includes('student') ? (
        <SmallSelect
          label="विद्यार्थी"
          value={opts.student}
          onChange={(v) => set('student', v)}
          options={[{ value: 'all', label: `सर्व विद्यार्थी (${b.students.length})` }, ...b.allStudents.map((s) => ({ value: s.id, label: `${s.rollNo ? `${s.rollNo}. ` : ''}${s.fullName}${s.status === 'left' ? ' (सोडले)' : ''}` }))]}
        />
      ) : null}
      {def.opts.includes('orientation') ? (
        <div>
          <span className="mb-0.5 block text-[12.5px] font-semibold text-muted">पृष्ठ</span>
          <Segmented
            label="पृष्ठ"
            value={opts.orientation}
            onChange={(v) => set('orientation', v)}
            options={[
              { value: 'portrait', label: 'A4 उभे' },
              { value: 'landscape', label: 'A4 आडवे' },
            ]}
          />
        </div>
      ) : null}
      {def.opts.includes('paper') ? (
        <div>
          <span className="mb-0.5 block text-[12.5px] font-semibold text-muted">कागद</span>
          <Segmented
            label="कागद"
            value={paper}
            onChange={(v) => set('paper', v)}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'A3', label: 'A3' },
            ]}
          />
        </div>
      ) : null}
      {def.opts.includes('group') ? (
        <div>
          <span className="mb-0.5 block text-[12.5px] font-semibold text-muted">गट</span>
          <Segmented
            label="गट"
            value={opts.group}
            onChange={(v) => set('group', v)}
            options={[
              { value: 'category', label: 'प्रवर्गनिहाय' },
              { value: 'caste', label: 'जातनिहाय' },
            ]}
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const studentName = opts.student !== 'all' ? b.allStudents.find((s) => s.id === opts.student)?.fullName : '';
  const suffix = [
    def.opts.includes('term') ? TERM_LABEL[opts.term] : '',
    def.opts.includes('terms') && opts.terms.length === 1 ? TERM_LABEL[opts.terms[0]] : '',
    def.opts.includes('paper') && paper === 'A3' ? 'A3' : '',
    def.opts.includes('period') ? (opts.period === 'annual' ? 'वार्षिक' : TERM_LABEL[opts.period]) : '',
    studentName ?? '',
  ]
    .filter(Boolean)
    .join('-');
  const fileName = `${safeFileName(`${def.title}-${standardLabel(cls.standard)}-${cls.section}-${cls.year}${suffix ? `-${suffix}` : ''}`)}.pdf`;

  return (
    <ReportViewer
      title={def.title}
      fileName={fileName}
      orientation={def.opts.includes('orientation') ? opts.orientation : def.orientation}
      paper={def.opts.includes('paper') ? paper : 'A4'}
      options={optionUi}
      onClose={close}
      showPageNumbers={cfg.report.showPageNumbers}
      author={school.name}
    >
      {def.render(ctx, opts)}
    </ReportViewer>
  );
}
