import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { attendanceTotals, useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate, fmtNum, fmtPct, yearMonths } from '../../lib/format';
import { categoryLabel, GENDER_LABEL, TERM_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { Avatar } from './StudentsPage';
import { useFeedback } from '../../components/feedback';
import { Button, LinkButton, PageHeader, Panel } from '../../components/ui';
import type { Term } from '../../lib/types';

export default function StudentView() {
  const { id = '' } = useParams();
  const { scope, cfg, cls } = useTeacher();
  const b = useClassBundle();
  const nav = useNavigate();
  const { confirm, toast } = useFeedback();
  // throws AccessError for another class's student (caught by the page error boundary)
  const s = useLiveQuery(() => repo.getStudent(scope, id), [id, scope.classId]);
  if (!s || !b) return null;
  const r = b.results.get(s.id);
  const att = attendanceTotals(b, s.id, yearMonths(cls.year));

  const rows: [string, string][] = [
    ['हजेरी क्रमांक', s.rollNo ? String(s.rollNo) : '—'],
    ['लिंग', GENDER_LABEL[s.gender]],
    ['जन्मतारीख', fmtDate(s.dob) || '—'],
    ['जन्मस्थळ', s.birthPlace || '—'],
    ['रजिस्टर क्रमांक', s.regNo || '—'],
    ['विद्यार्थी आयडी (सरल)', s.saralId || '—'],
    ['UDISE PEN', s.pen || '—'],
    ['आईचे नाव', s.motherName || '—'],
    ['वडिलांचे नाव', s.fatherName || '—'],
    ['पालकाचे नाव', s.guardianName || '—'],
    ['मोबाईल', s.mobile || '—'],
    ['पत्ता', s.address || '—'],
    ['धर्म', s.religion || '—'],
    ['जात', s.caste || '—'],
    ['प्रवर्ग', s.category ? categoryLabel(s.category) : '—'],
    ['प्रवेश दिनांक', fmtDate(s.admissionDate) || '—'],
    ['मागील शाळा', s.previousSchool || '—'],
  ];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={s.fullName}
        back="/students"
        subtitle={s.status === 'left' ? `शाळा सोडली — ${fmtDate(s.leaving?.date) || ''}` : undefined}
        actions={
          <>
            <LinkButton to={`/students/${s.id}/edit`} icon="edit" variant="primary">
              संपादित करा
            </LinkButton>
            <Button
              variant="danger-ghost"
              icon="trash"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'विद्यार्थी हटवा',
                    message: `${s.fullName} व त्याचे/तिचे सर्व गुण, नोंदी, उपस्थिती कायमचे हटवले जातील.`,
                    confirmLabel: 'हटवा',
                    danger: true,
                  })
                ) {
                  await track(repo.deleteStudent(scope, s.id));
                  toast('विद्यार्थी हटवला.');
                  nav('/students', { replace: true });
                }
              }}
            >
              हटवा
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel>
          <div className="mb-4 flex items-center gap-4">
            <Avatar s={s} size={88} />
            <div className="text-[14.5px] text-muted">
              <div>
                उपस्थिती: <b className="tabular text-text">{att.entered ? `${att.present} / ${att.working}` : '—'}</b>
              </div>
              <div>
                {TERM_LABEL[1]}: <b className="text-text">{r?.t1.grade || '—'}</b>
              </div>
              <div>
                {TERM_LABEL[2]}: <b className="text-text">{r?.t2.grade || '—'}</b>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[14.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="grid gap-4">
          {([1, 2] as Term[]).map((t) => {
            const tr = t === 1 ? r?.t1 : r?.t2;
            return (
              <Panel key={t} title={TERM_LABEL[t]}>
                <div className="scroll-x">
                  <table className="grid-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th className="!text-left">विषय</th>
                        <th>आकारिक (अ)</th>
                        <th>संकलित (ब)</th>
                        <th>एकूण</th>
                        <th>टक्केवारी</th>
                        <th>श्रेणी</th>
                      </tr>
                    </thead>
                    <tbody className="tabular">
                      {cfg.subjects.map((sub) => {
                        const d = r?.details[String(t) as '1' | '2'][sub.id];
                        return (
                          <tr key={sub.id}>
                            <td className="!text-left font-semibold">{sub.name}</td>
                            <td>{d?.fObt !== null && d ? `${fmtNum(d.fObt)}/${d.fMax}` : '—'}</td>
                            <td>{d?.hasSummative ? (d.sObt !== null ? `${fmtNum(d.sObt)}/${d.sMax}` : '—') : ''}</td>
                            <td className="font-semibold">{d?.total !== null && d ? `${fmtNum(d.total)}/${d.max}` : '—'}</td>
                            <td>{fmtPct(d?.pct)}</td>
                            <td className="font-semibold">{d?.grade || '—'}</td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td className="!text-left font-bold">एकूण</td>
                        <td colSpan={2} />
                        <td className="font-bold">{tr?.total !== null && tr ? `${fmtNum(tr.total)}/${tr.max}` : '—'}</td>
                        <td className="font-bold">{fmtPct(tr?.pct)}</td>
                        <td className="font-bold">{tr?.grade || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>
            );
          })}
          <Panel title="अहवाल">
            <div className="flex flex-wrap gap-2">
              <LinkButton to={`/reports/progress-card?student=${s.id}`} icon="progress">
                प्रगती कार्ड
              </LinkButton>
              <LinkButton to={`/reports/annual-marksheet?student=${s.id}`} icon="marksheet">
                वार्षिक गुणपत्रक
              </LinkButton>
              <LinkButton to={`/reports/student-wise?student=${s.id}`} icon="table">
                विद्यार्थीवार CCE
              </LinkButton>
              <LinkButton to={`/reports/remarks?student=${s.id}`} icon="remarks">
                वर्णनात्मक नोंदी
              </LinkButton>
              <LinkButton to={`/certificates/new?student=${s.id}`} icon="certificate">
                शाळा सोडल्याचा दाखला
              </LinkButton>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
