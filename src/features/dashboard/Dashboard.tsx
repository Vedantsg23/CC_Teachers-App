import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useClassBundle, type ClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { assessmentId, sumTools } from '../../lib/calc';
import { db } from '../../lib/db';
import { termOfMonth, todayIso, yearMonths, monthOfDate } from '../../lib/format';
import { SPECIAL_AREAS, standardLabel, TERM_LABEL } from '../../lib/labels';
import type { AType, ClassConfig, Term } from '../../lib/types';
import { Icon, type IconName } from '../../components/Icon';
import { EmptyState, LinkButton, Notice, Panel, ProgressBar, Segmented, StatCard } from '../../components/ui';

function typeCompletion(cfg: ClassConfig, b: ClassBundle, term: Term, type: AType) {
  let done = 0;
  let total = 0;
  const w = cfg.weights[String(term) as '1' | '2'] ?? {};
  for (const subj of cfg.subjects) {
    const tools = type === 'F' ? cfg.fTools : cfg.sParts;
    if (!sumTools(tools, type === 'F' ? w[subj.id]?.F : w[subj.id]?.S, undefined).used) continue;
    for (const st of b.students) {
      total++;
      const rec = b.idx.get(assessmentId(st.id, subj.id, term, type));
      if (rec && Object.values(rec.scores).some((v) => v !== null && v !== undefined)) done++;
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function remarkCompletion(cfg: ClassConfig, b: ClassBundle, term: Term) {
  const areas = [...cfg.subjects.map((s) => s.id), ...SPECIAL_AREAS.map((a) => a.key)];
  let done = 0;
  const perStudent = new Map<string, number>();
  for (const st of b.students) {
    let n = 0;
    for (const a of areas) if (b.remarkMap.get(`${st.id}|${term}|${a}`)?.text) n++;
    perStudent.set(st.id, n);
    done += n;
  }
  const total = areas.length * b.students.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, perStudent, areas: areas.length };
}

export function Dashboard() {
  const { cfg, cls, user, school, scope } = useTeacher();
  const b = useClassBundle();
  const today = todayIso();
  const [term, setTerm] = useState<Term>(termOfMonth(monthOfDate(today)));
  const lastBackup = useLiveQuery(() => db.meta.get(`lastBackup:${scope.classId}`), [scope.classId]);

  const stats = useMemo(() => {
    if (!b) return null;
    const boys = b.students.filter((s) => s.gender === 'M').length;
    const girls = b.students.length - boys;
    const todayRec = b.daily.find((d) => d.date === today);
    const active = new Set(b.students.map((s) => s.id));
    const absentToday = todayRec ? todayRec.absent.filter((id) => active.has(id)).length : null;
    const f = typeCompletion(cfg, b, term, 'F');
    const s = typeCompletion(cfg, b, term, 'S');
    const assess = { done: f.done + s.done, total: f.total + s.total };
    const rem = remarkCompletion(cfg, b, term);
    let cardsReady = 0;
    let resultsReady = 0;
    for (const st of b.students) {
      const r = b.results.get(st.id);
      if (!r) continue;
      const tr = term === 1 ? r.t1 : r.t2;
      const allSubjects = cfg.subjects.every((sub) => tr.subjects[sub.id]?.entered);
      if (allSubjects && rem.perStudent.get(st.id) === rem.areas) cardsReady++;
      const decided = (x: string) => x === 'pass' || x === 'fail';
      if (decided(r.t1.status) && decided(r.t2.status)) resultsReady++;
    }
    const months = yearMonths(cls.year).filter((m) => m <= monthOfDate(today));
    const monthsDone = months.filter((m) => b.attMonths.some((a) => a.month === m && a.workingDays !== null)).length;
    return { boys, girls, absentToday, f, s, assess, rem, cardsReady, resultsReady, months: months.length, monthsDone };
  }, [b, cfg, term, today, cls.year]);

  if (!b || !stats) return null;
  const n = b.students.length;
  const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);

  const steps: { label: string; to: string; icon: IconName; status: string; done: boolean }[] = [
    { label: 'विद्यार्थी माहिती भरा', to: '/students', icon: 'student', status: `${n} विद्यार्थी`, done: n > 0 },
    { label: 'आकारिक मूल्यमापन', to: '/formative', icon: 'formative', status: `${stats.f.pct}%`, done: stats.f.pct === 100 },
    { label: 'संकलित मूल्यमापन', to: '/summative', icon: 'summative', status: `${stats.s.pct}%`, done: stats.s.pct === 100 },
    { label: 'वर्णनात्मक नोंदी', to: '/remarks', icon: 'remarks', status: `${stats.rem.pct}%`, done: stats.rem.pct === 100 },
    { label: 'मासिक उपस्थिती', to: '/attendance', icon: 'calendar', status: `${stats.monthsDone}/${stats.months} महिने`, done: stats.months > 0 && stats.monthsDone === stats.months },
    { label: 'प्रगती कार्ड', to: '/progress-card', icon: 'progress', status: `${stats.cardsReady}/${n} तयार`, done: n > 0 && stats.cardsReady === n },
    { label: 'वार्षिक निकाल', to: '/result', icon: 'trophy', status: `${stats.resultsReady}/${n} तयार`, done: n > 0 && stats.resultsReady === n },
    { label: 'अहवाल — PDF / प्रिंट', to: '/reports', icon: 'printer', status: '14 अहवाल', done: false },
  ];

  const backupAt = lastBackup?.value as number | undefined;
  const backupOld = !backupAt || Date.now() - backupAt > 7 * 86400_000;

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="margin-rule pl-3.5 font-display text-[30px] leading-tight text-ink-deep md:text-[34px]">नमस्कार, {user.displayName}</h1>
          <div className="mt-2 flex flex-wrap gap-2 pl-3.5 text-[14.5px]">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-rule">
              इयत्ता: <b>{standardLabel(cls.standard)}</b>
            </span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-rule">
              तुकडी: <b>{cls.section}</b>
            </span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-rule">
              सन: <b>{cls.year}</b>
            </span>
          </div>
          {school.name ? <p className="mt-2 pl-3.5 text-[14px] text-muted">{school.name}</p> : null}
        </div>
        <Segmented label="सत्र" value={term} onChange={setTerm} options={[{ value: 1 as Term, label: TERM_LABEL[1] }, { value: 2 as Term, label: TERM_LABEL[2] }]} />
      </section>

      {n === 0 ? (
        <EmptyState
          icon="student"
          title="अजून एकही विद्यार्थी जोडलेला नाही."
          text="सुरुवात करण्यासाठी विद्यार्थी जोडा किंवा Excel/CSV यादी आयात करा."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton to="/students/new" variant="primary" icon="plus">
                विद्यार्थी जोडा
              </LinkButton>
              <LinkButton to="/students/import" icon="upload">
                यादी आयात करा
              </LinkButton>
            </div>
          }
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="वर्गाची आकडेवारी">
        <StatCard label="एकूण विद्यार्थी" value={n} />
        <StatCard label="मुलगे" value={stats.boys} />
        <StatCard label="मुली" value={stats.girls} />
        <StatCard label="आज उपस्थित" value={stats.absentToday === null ? '—' : n - stats.absentToday} tone="leaf" sub={stats.absentToday === null ? 'आजची हजेरी घेतली नाही' : undefined} />
        <StatCard label="आज अनुपस्थित" value={stats.absentToday === null ? '—' : stats.absentToday} tone="margin" />
      </section>

      {backupOld && n > 0 ? (
        <Notice kind="warn">
          {backupAt ? 'शेवटचा बॅकअप एका आठवड्यापूर्वीचा आहे.' : 'अजून एकदाही बॅकअप घेतलेला नाही.'} माहिती फक्त या उपकरणावर आहे —{' '}
          <Link to="/settings/backup" className="font-semibold underline">
            आता बॅकअप घ्या
          </Link>
          .
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Panel title={`${TERM_LABEL[term]} — कामाची प्रगती`}>
          <div className="grid gap-4">
            <ProgressBar label="मूल्यमापन पूर्णता" value={pct(stats.assess.done, stats.assess.total)} />
            <ProgressBar label="वर्णनात्मक नोंदी पूर्ण" value={stats.rem.pct} />
            <ProgressBar label="प्रगती कार्ड तयार" value={pct(stats.cardsReady, n)} detail={`${stats.cardsReady} / ${n}`} />
            <ProgressBar label="वार्षिक निकाल तयार" value={pct(stats.resultsReady, n)} detail={`${stats.resultsReady} / ${n}`} />
          </div>
          {stats.absentToday === null && n > 0 ? (
            <div className="mt-4">
              <LinkButton to="/attendance" size="sm" icon="calendar">
                आजची हजेरी घ्या
              </LinkButton>
            </div>
          ) : null}
        </Panel>

        <Panel title="कामाचा क्रम">
          <ol className="grid gap-1">
            {steps.map((s, i) => (
              <li key={s.to}>
                <Link to={s.to} className="flex min-h-[50px] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[#f2f5f9]">
                  <span
                    className={`tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                      s.done ? 'bg-leaf text-white' : 'bg-ink-soft text-ink-deep'
                    }`}
                    aria-hidden
                  >
                    {s.done ? <Icon name="check" size={16} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15.5px] font-semibold">{s.label}</span>
                  <span className={`text-[14px] ${s.done ? 'text-leaf' : 'text-muted'}`}>{s.status}</span>
                  <Icon name="right" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
