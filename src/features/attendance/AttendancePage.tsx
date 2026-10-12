import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { attendanceTotals, useClassBundle, type ClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { attendancePct } from '../../lib/calc';
import { daysInMonth, fmtDate, fmtPct, monthLabel, monthOfDate, todayIso, yearMonths } from '../../lib/format';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { Student } from '../../lib/types';
import { MSG, validateCount } from '../../lib/validation';
import { useFeedback } from '../../components/feedback';
import { Button, EmptyState, InlineSelect, LinkButton, Notice, PageHeader, Segmented } from '../../components/ui';

type Tab = 'daily' | 'monthly' | 'annual';

function DailyTab({ b }: { b: ClassBundle }) {
  const { scope } = useTeacher();
  const { toast, confirm } = useFeedback();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const rec = b.daily.find((d) => d.date === date);
  const absent = new Set(rec?.absent ?? []);
  const absentCount = b.students.filter((s) => absent.has(s.id)).length;

  async function toggle(s: Student, isAbsent: boolean) {
    const next = new Set(absent);
    if (isAbsent) next.add(s.id);
    else next.delete(s.id);
    await track(repo.setDaily(scope, date, [...next]));
  }

  return (
    <div className="grid gap-3">
      <div className="panel flex flex-wrap items-end gap-3 p-3">
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-muted">दिनांक</span>
          <input type="date" className="field-input" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <div className="flex gap-4 text-[15px]">
          <span>
            हजर: <b className="tabular text-leaf">{b.students.length - absentCount}</b>
          </span>
          <span>
            गैरहजर: <b className="tabular text-margin">{absentCount}</b>
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {!rec ? (
            <Button
              variant="primary"
              icon="check"
              onClick={async () => {
                await track(repo.setDaily(scope, date, []));
                toast('सर्व विद्यार्थी हजर म्हणून हजेरी जतन झाली.');
              }}
            >
              सर्व हजर — जतन करा
            </Button>
          ) : (
            <Button
              variant="danger-ghost"
              icon="trash"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: 'हजेरी काढा', message: `${fmtDate(date)} ची हजेरी नोंद काढायची का? (उदा. सुट्टीचा दिवस चुकून नोंदवला असल्यास)`, confirmLabel: 'काढा', danger: true })) {
                  await track(repo.deleteDaily(scope, date));
                }
              }}
            >
              या दिवसाची नोंद काढा
            </Button>
          )}
        </div>
      </div>
      {!rec ? <Notice>{fmtDate(date)} ची हजेरी अजून घेतलेली नाही. गैरहजर विद्यार्थ्यांना “गैरहजर” करा — बाकी सर्व हजर धरले जातील.</Notice> : null}
      <ul className="panel divide-y divide-rule">
        {b.students.map((s) => {
          const isAbsent = absent.has(s.id);
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="tabular w-8 text-muted">{s.rollNo ?? ''}</span>
              <span className={`min-w-0 flex-1 text-[15.5px] font-semibold ${isAbsent ? 'text-margin' : ''}`}>{s.fullName}</span>
              <div role="radiogroup" aria-label={`${s.fullName} — हजेरी`} className="inline-flex rounded-lg border border-rule-strong p-0.5">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isAbsent}
                  onClick={() => void toggle(s, false)}
                  className={`min-h-[40px] rounded-md px-3 text-[14.5px] font-semibold ${!isAbsent ? 'bg-leaf text-white' : 'text-muted'}`}
                >
                  हजर
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isAbsent}
                  onClick={() => void toggle(s, true)}
                  className={`min-h-[40px] rounded-md px-3 text-[14.5px] font-semibold ${isAbsent ? 'bg-margin text-white' : 'text-muted'}`}
                >
                  गैरहजर
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MonthlyTab({ b }: { b: ClassBundle }) {
  const { scope, cls } = useTeacher();
  const { toast, confirm } = useFeedback();
  const months = yearMonths(cls.year);
  const cur = monthOfDate(todayIso());
  const [month, setMonth] = useState(months.includes(cur) ? cur : months[0]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const mrec = b.attMonths.find((m) => m.month === month);
  const working = mrec?.workingDays ?? null;
  const dailyCount = b.daily.filter((d) => d.date.startsWith(month)).length;
  const presentOf = (sid: string) => b.attById.get(`${sid}|${month}`)?.present ?? null;
  const wKey = `w|${month}`;

  const totals = useMemo(() => {
    let p = 0;
    let a = 0;
    for (const s of b.students) {
      const v = presentOf(s.id);
      if (v !== null && working !== null) {
        p += v;
        a += working - v;
      }
    }
    return { p, a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, month, working]);

  return (
    <div className="grid gap-3">
      <div className="panel grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <InlineSelect label="महिना" value={month} onChange={(v) => { setMonth(v); setDraft({}); setErr(''); }} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-muted">एकूण कामाचे दिवस</span>
          <input
            className="field-input tabular"
            inputMode="numeric"
            value={wKey in draft ? draft[wKey] : (working ?? '').toString()}
            onChange={async (e) => {
              const raw = e.target.value;
              setDraft((d) => ({ ...d, [wKey]: raw }));
              const chk = validateCount(raw, Math.min(31, daysInMonth(month)), MSG.workingDaysInvalid);
              if (!chk.ok) return setErr(chk.error);
              setErr('');
              await track(repo.setWorkingDays(scope, month, chk.value));
            }}
          />
        </label>
        {dailyCount ? (
          <Button
            icon="refresh"
            onClick={async () => {
              if (await confirm({ title: 'दैनिक हजेरीवरून भरा', message: `${monthLabel(month)} मधील ${dailyCount} दिवसांच्या दैनिक हजेरीवरून कामाचे दिवस व प्रत्येकाचे हजर दिवस भरले जातील. आधी भरलेली संख्या बदलेल.`, confirmLabel: 'भरा' })) {
                await track(repo.monthFromDaily(scope, month));
                setDraft({});
                toast('दैनिक हजेरीवरून मासिक उपस्थिती भरली.');
              }
            }}
          >
            दैनिक हजेरीवरून भरा ({dailyCount})
          </Button>
        ) : (
          <span />
        )}
      </div>
      {err ? <Notice kind="error">{err}</Notice> : null}
      {working === null ? (
        <Notice>आधी या महिन्याचे एकूण कामाचे दिवस भरा.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon="check"
              onClick={async () => {
                for (const s of b.students) if (presentOf(s.id) === null) await repo.setPresentDays(scope, s.id, month, working);
                setDraft({});
                toast('रिकाम्या जागी पूर्ण हजेरी भरली.');
              }}
            >
              रिकाम्या जागी पूर्ण हजेरी भरा
            </Button>
            <span className="text-[14.5px] text-muted">
              एकूण उपस्थिती <b className="tabular text-text">{totals.p}</b>, एकूण अनुपस्थिती <b className="tabular text-text">{totals.a}</b>
            </span>
          </div>
          <div className="panel scroll-x">
            <table className="grid-table min-w-[560px]">
              <thead>
                <tr>
                  <th>हजेरी क्र.</th>
                  <th className="sticky-col !text-left">विद्यार्थ्याचे नाव</th>
                  <th>हजर दिवस (/{working})</th>
                  <th>गैरहजर दिवस</th>
                  <th>उपस्थिती %</th>
                </tr>
              </thead>
              <tbody>
                {b.students.map((s) => {
                  const k = `${s.id}|${month}`;
                  const v = presentOf(s.id);
                  const text = k in draft ? draft[k] : v === null ? '' : String(v);
                  const chk = validateCount(text, working, MSG.attendanceExceeds);
                  const pv = chk.ok ? chk.value : v;
                  return (
                    <tr key={s.id}>
                      <td className="tabular text-muted">{s.rollNo ?? ''}</td>
                      <td className="sticky-col !py-1.5 font-semibold">{s.fullName}</td>
                      <td>
                        <input
                          className="cell-input"
                          inputMode="numeric"
                          value={text}
                          aria-label={`${s.fullName} — हजर दिवस`}
                          aria-invalid={chk.ok ? undefined : true}
                          onChange={async (e) => {
                            const raw = e.target.value;
                            setDraft((d) => ({ ...d, [k]: raw }));
                            const c = validateCount(raw, working, MSG.attendanceExceeds);
                            if (!c.ok) return setErr(`${s.fullName}: ${c.error}`);
                            setErr('');
                            await track(repo.setPresentDays(scope, s.id, month, c.value));
                          }}
                        />
                      </td>
                      <td className="tabular">{pv === null ? '' : working - pv}</td>
                      <td className="tabular">{fmtPct(attendancePct(pv, working))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AnnualTab({ b }: { b: ClassBundle }) {
  const { cls } = useTeacher();
  const months = yearMonths(cls.year);
  return (
    <div className="grid gap-3">
      <div className="panel scroll-x">
        <table className="grid-table min-w-[900px]">
          <thead>
            <tr>
              <th className="sticky-col !text-left">विद्यार्थी</th>
              {months.map((m) => (
                <th key={m}>
                  {monthLabel(m, true)}
                  <div className="tabular text-[12px] font-normal text-muted">{b.workingByMonth.get(m) ?? '—'}</div>
                </th>
              ))}
              <th>एकूण हजर</th>
              <th>एकूण कामाचे दिवस</th>
              <th>उपस्थिती %</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {b.students.map((s) => {
              const t = attendanceTotals(b, s.id, months);
              return (
                <tr key={s.id}>
                  <td className="sticky-col !py-1.5 font-semibold">
                    {s.rollNo ? `${s.rollNo}. ` : ''}
                    {s.fullName}
                  </td>
                  {months.map((m) => (
                    <td key={m}>{b.attById.get(`${s.id}|${m}`)?.present ?? ''}</td>
                  ))}
                  <td className="font-semibold">{t.entered ? t.present : ''}</td>
                  <td>{t.working || ''}</td>
                  <td className="font-semibold">{fmtPct(attendancePct(t.entered ? t.present : null, t.working))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const b = useClassBundle();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'daily';
  if (!b) return null;
  return (
    <div>
      <PageHeader
        title="उपस्थिती"
        subtitle="आजची हजेरी, मासिक उपस्थिती व वार्षिक सारांश"
        actions={
          <LinkButton to="/reports/attendance" size="sm" icon="printer">
            उपस्थिती अहवाल PDF
          </LinkButton>
        }
      />
      <div className="mb-3">
        <Segmented
          label="उपस्थिती विभाग"
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={[
            { value: 'daily' as Tab, label: 'आजची हजेरी' },
            { value: 'monthly' as Tab, label: 'मासिक उपस्थिती' },
            { value: 'annual' as Tab, label: 'वार्षिक' },
          ]}
        />
      </div>
      {!b.students.length ? (
        <EmptyState icon="student" title="हजेरीसाठी आधी विद्यार्थी जोडा." action={<LinkButton to="/students/new" variant="primary">विद्यार्थी जोडा</LinkButton>} />
      ) : tab === 'daily' ? (
        <DailyTab b={b} />
      ) : tab === 'monthly' ? (
        <MonthlyTab b={b} />
      ) : (
        <AnnualTab b={b} />
      )}
    </div>
  );
}
