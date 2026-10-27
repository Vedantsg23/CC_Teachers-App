import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate } from '../../lib/format';
import { CATEGORIES, categoryShort, GENDER_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { Student } from '../../lib/types';
import { normalizeDigits } from '../../lib/validation';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { Button, Checkbox, EmptyState, InlineSelect, LinkButton, PageHeader } from '../../components/ui';

/** Initials badge (student photos are no longer used). */
export function Avatar({ s, size = 56 }: { s: Pick<Student, 'fullName' | 'gender'>; size?: number }) {
  const initials = s.fullName.trim().split(/\s+/).map((w) => [...w][0] ?? '').slice(0, 2).join('');
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold ${s.gender === 'F' ? 'bg-[#f6e9ef] text-[#8a2d55]' : 'bg-ink-soft text-ink-deep'}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

const PAGE = 60;

export default function StudentsPage() {
  const { scope } = useTeacher();
  const b = useClassBundle();
  const nav = useNavigate();
  const { confirm, toast } = useFeedback();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState('');
  const [cat, setCat] = useState('');
  const [caste, setCaste] = useState('');
  const [grade, setGrade] = useState('');
  const [showLeft, setShowLeft] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    if (!b) return [];
    const needle = normalizeDigits(q.trim().toLowerCase());
    return (showLeft ? b.allStudents : b.students).filter((s) => {
      if (gender && s.gender !== gender) return false;
      if (cat && s.category !== cat) return false;
      if (caste && s.caste !== caste) return false;
      if (grade) {
        const r = b.results.get(s.id);
        const g = r ? (r.t2.entered ? r.t2.grade : r.t1.grade) : '';
        if (g !== grade) return false;
      }
      if (!needle) return true;
      const digits = needle.replace(/\s/g, '');
      return (
        s.fullName.toLowerCase().includes(needle) ||
        String(s.rollNo ?? '') === needle ||
        s.regNo.toLowerCase() === needle ||
        (digits.length >= 4 && [s.aadhaar, s.apaar, s.pen].some((x) => x && x === digits))
      );
    });
  }, [b, q, gender, cat, caste, grade, showLeft]);

  if (!b) return null;
  const castes = [...new Set(b.allStudents.map((s) => s.caste).filter(Boolean))].sort((a, z) => a.localeCompare(z, 'mr'));
  const grades = [...new Set([...b.results.values()].map((r) => (r.t2.entered ? r.t2.grade : r.t1.grade)).filter(Boolean))];

  async function remove(s: Student) {
    const ok = await confirm({
      title: 'विद्यार्थी हटवा',
      message: (
        <>
          <b>{s.fullName}</b> व त्याचे/तिचे सर्व गुण, वर्णनात्मक नोंदी, उपस्थिती आणि दाखले कायमचे हटवले जातील. हे परत आणता येणार नाही.
        </>
      ),
      confirmLabel: 'हटवा',
      danger: true,
    });
    if (!ok) return;
    await track(repo.deleteStudent(scope, s.id));
    toast('विद्यार्थी हटवला.');
  }

  return (
    <div>
      <PageHeader
        title="विद्यार्थी माहिती"
        subtitle={`${b.students.length} विद्यार्थी (मुलगे ${b.students.filter((s) => s.gender === 'M').length}, मुली ${b.students.filter((s) => s.gender === 'F').length})`}
        actions={
          <>
            <LinkButton to="/students/import" icon="upload">
              आयात करा
            </LinkButton>
            <LinkButton to="/students/new" variant="primary" icon="plus">
              विद्यार्थी जोडा
            </LinkButton>
          </>
        }
      />

      <div className="panel mb-4 grid gap-3 p-3 md:p-4">
        <label className="relative block">
          <span className="sr-only">विद्यार्थी शोधा</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="field-input pl-10" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="नावाने, हजेरी क्र. किंवा रजिस्टर क्र. ने शोधा" />
        </label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <InlineSelect label="लिंग" value={gender} onChange={setGender} options={[{ value: '', label: 'सर्व' }, { value: 'M', label: 'मुलगा' }, { value: 'F', label: 'मुलगी' }]} />
          <InlineSelect label="प्रवर्ग" value={cat} onChange={setCat} options={[{ value: '', label: 'सर्व' }, ...CATEGORIES.map((c) => ({ value: c.code, label: c.label }))]} />
          <InlineSelect label="जात" value={caste} onChange={setCaste} options={[{ value: '', label: 'सर्व' }, ...castes.map((c) => ({ value: c, label: c }))]} />
          <InlineSelect label="श्रेणी (शेवटचे सत्र)" value={grade} onChange={setGrade} options={[{ value: '', label: 'सर्व' }, ...grades.map((g) => ({ value: g, label: g }))]} />
        </div>
        <Checkbox label="शाळा सोडलेले विद्यार्थीही दाखवा" checked={showLeft} onChange={setShowLeft} />
      </div>

      {b.allStudents.length === 0 ? (
        <EmptyState
          icon="student"
          title="अजून विद्यार्थी नाहीत."
          text="“विद्यार्थी जोडा” दाबा किंवा Excel/CSV मधून संपूर्ण यादी आयात करा."
          action={
            <LinkButton to="/students/new" variant="primary" icon="plus">
              विद्यार्थी जोडा
            </LinkButton>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState icon="search" title="जुळणारा विद्यार्थी सापडला नाही." text="शोध किंवा फिल्टर बदलून पहा." />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.slice(0, limit).map((s) => (
              <li key={s.id} className="panel flex gap-3 p-3">
                <Link to={`/students/${s.id}`} className="shrink-0" aria-label={`${s.fullName} — माहिती पहा`}>
                  <Avatar s={s} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/students/${s.id}`} className="block truncate text-[17px] font-semibold text-ink-deep hover:underline">
                    {s.fullName}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[14px] text-muted">
                    <span className="whitespace-nowrap">
                      हजेरी क्र.: <b className="tabular text-text">{s.rollNo ?? '—'}</b>
                    </span>
                    <span className="whitespace-nowrap">
                      रजि. क्र.: <b className="tabular text-text">{s.regNo || '—'}</b>
                    </span>
                    <span className="tabular whitespace-nowrap">{fmtDate(s.dob) || '—'}</span>
                    <span className="whitespace-nowrap">
                      {GENDER_LABEL[s.gender]}
                      {s.category ? `, ${categoryShort(s.category)}` : ''}
                    </span>
                  </div>
                  {s.status === 'left' ? <span className="mt-1 inline-block rounded bg-margin-soft px-2 py-0.5 text-[12.5px] font-semibold text-margin">शाळा सोडली</span> : null}
                  {s.demo ? <span className="mt-1 ml-1 inline-block rounded bg-turmeric-soft px-2 py-0.5 text-[12.5px] font-semibold text-turmeric">नमुना</span> : null}
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => nav(`/students/${s.id}/edit`)} aria-label={`${s.fullName} — संपादित करा`}>
                    <Icon name="edit" size={18} />
                  </button>
                  <button type="button" className="btn btn-danger-ghost btn-sm !px-2" onClick={() => void remove(s)} aria-label={`${s.fullName} — हटवा`}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {list.length > limit ? (
            <div className="mt-4 text-center">
              <Button onClick={() => setLimit((l) => l + PAGE)}>आणखी दाखवा ({list.length - limit})</Button>
            </div>
          ) : null}
        </>
      )}

      <Link
        to="/students/new"
        className="no-print fixed right-4 bottom-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg hover:bg-ink-deep md:hidden"
        aria-label="विद्यार्थी जोडा"
      >
        <Icon name="plus" size={26} />
      </Link>
    </div>
  );
}
