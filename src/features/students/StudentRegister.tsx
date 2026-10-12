import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate, safeFileName } from '../../lib/format';
import { CATEGORIES, categoryShort, GENDER_LABEL, standardLabel } from '../../lib/labels';
import { downloadBytes, downloadText } from '../../lib/share';
import { toCsv, toXlsx } from '../../lib/sheet';
import { normalizeDigits } from '../../lib/validation';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, InlineSelect, LinkButton, PageHeader } from '../../components/ui';
import { COLUMN_WIDTHS, studentsToRows } from './studentSheet';

export default function StudentRegister() {
  const { cls } = useTeacher();
  const b = useClassBundle();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<'roll' | 'name' | 'dob'>('roll');

  const list = useMemo(() => {
    if (!b) return [];
    const needle = normalizeDigits(q.trim().toLowerCase());
    const out = b.students.filter(
      (s) =>
        (!gender || s.gender === gender) &&
        (!cat || s.category === cat) &&
        (!needle || s.fullName.toLowerCase().includes(needle) || String(s.rollNo ?? '') === needle || s.regNo === needle),
    );
    if (sort === 'name') out.sort((a, z) => a.fullName.localeCompare(z.fullName, 'mr'));
    if (sort === 'dob') out.sort((a, z) => (a.dob || '9').localeCompare(z.dob || '9'));
    return out;
  }, [b, q, gender, cat, sort]);

  if (!b) return null;
  const base = safeFileName(`विद्यार्थी-यादी-${standardLabel(cls.standard)}-${cls.section}-${cls.year}`);

  return (
    <div>
      <PageHeader
        title="विद्यार्थी यादी"
        subtitle={`इयत्ता ${standardLabel(cls.standard)}, तुकडी ${cls.section} — ${list.length} विद्यार्थी`}
        actions={
          <>
            <Button icon="download" onClick={() => downloadBytes(toXlsx([{ name: 'विद्यार्थी', rows: studentsToRows(list), widths: COLUMN_WIDTHS }]), `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>
              Excel
            </Button>
            <Button icon="download" onClick={() => downloadText(toCsv(studentsToRows(list)), `${base}.csv`, 'text/csv')}>
              CSV
            </Button>
            <LinkButton to="/reports/student-list" variant="primary" icon="printer">
              PDF / प्रिंट
            </LinkButton>
          </>
        }
      />
      <div className="panel mb-3 grid gap-3 p-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="relative block self-end">
          <span className="sr-only">शोधा</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="field-input pl-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="नाव / हजेरी क्र. / रजि. क्र." />
        </label>
        <InlineSelect label="लिंग" value={gender} onChange={setGender} options={[{ value: '', label: 'सर्व' }, { value: 'M', label: 'मुलगा' }, { value: 'F', label: 'मुलगी' }]} />
        <InlineSelect label="प्रवर्ग" value={cat} onChange={setCat} options={[{ value: '', label: 'सर्व' }, ...CATEGORIES.map((c) => ({ value: c.code, label: c.label }))]} />
        <InlineSelect label="क्रम" value={sort} onChange={(v) => setSort(v as 'roll')} options={[{ value: 'roll', label: 'हजेरी क्रमांकानुसार' }, { value: 'name', label: 'नावानुसार' }, { value: 'dob', label: 'जन्मतारखेनुसार' }]} />
      </div>
      {b.students.length === 0 ? (
        <EmptyState icon="list" title="यादीत अजून विद्यार्थी नाहीत." action={<LinkButton to="/students/new" variant="primary" icon="plus">विद्यार्थी जोडा</LinkButton>} />
      ) : (
        <div className="panel scroll-x">
          <table className="grid-table min-w-[860px]">
            <thead>
              <tr>
                <th>अ.क्र.</th>
                <th>हजेरी क्र.</th>
                <th className="sticky-col !text-left">विद्यार्थ्याचे नाव</th>
                <th>लिंग</th>
                <th>जन्मतारीख</th>
                <th>रजि. क्र.</th>
                <th>जात</th>
                <th>प्रवर्ग</th>
                <th>मोबाईल</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} className="hover:bg-[#f6f8fb]">
                  <td className="tabular text-muted">{i + 1}</td>
                  <td className="tabular">{s.rollNo ?? ''}</td>
                  <td className="sticky-col !py-2">
                    <Link to={`/students/${s.id}`} className="font-semibold text-ink-deep hover:underline">
                      {s.fullName}
                    </Link>
                  </td>
                  <td>{GENDER_LABEL[s.gender]}</td>
                  <td className="tabular">{fmtDate(s.dob)}</td>
                  <td className="tabular">{s.regNo}</td>
                  <td>{s.caste}</td>
                  <td>{s.category ? categoryShort(s.category) : ''}</td>
                  <td className="tabular">{s.mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
