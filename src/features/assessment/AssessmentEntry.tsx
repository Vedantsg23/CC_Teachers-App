import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { assessmentId, gradeFor, percent, round2, sumTools } from '../../lib/calc';
import { marksWorkbook } from '../../lib/exportMarks';
import { fmtNum, fmtPct, monthOfDate, safeFileName, termOfMonth, todayIso } from '../../lib/format';
import { standardLabel, TERM_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { downloadBytes } from '../../lib/share';
import { toXlsx } from '../../lib/sheet';
import type { AType, Student, Term, ToolDef } from '../../lib/types';
import { MSG, validateMark } from '../../lib/validation';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { Button, Checkbox, EmptyState, InlineSelect, LinkButton, Modal, Notice, PageHeader, Segmented, TextField } from '../../components/ui';
import { Avatar } from '../students/StudentsPage';

type CellState = 'saving' | 'saved' | 'error';

export default function AssessmentEntry({ type }: { type: AType }) {
  const { cfg, scope, cls } = useTeacher();
  const b = useClassBundle();
  const { toast } = useFeedback();
  const [params, setParams] = useSearchParams();
  const term = (Number(params.get('term')) === 2 ? 2 : params.get('term') === '1' ? 1 : termOfMonth(monthOfDate(todayIso()))) as Term;
  const tools: ToolDef[] = type === 'F' ? cfg.fTools : cfg.sParts;

  const subjectsForType = cfg.subjects.map((s) => {
    const w = cfg.weights[String(term) as '1' | '2']?.[s.id];
    const used = sumTools(tools, type === 'F' ? w?.F : w?.S, undefined).used > 0;
    return { s, used };
  });
  const firstUsed = subjectsForType.find((x) => x.used)?.s.id ?? cfg.subjects[0]?.id ?? '';
  const subjectId = params.get('subject') && cfg.subjects.some((s) => s.id === params.get('subject')) ? params.get('subject')! : firstUsed;
  const subject = cfg.subjects.find((s) => s.id === subjectId);
  const w = cfg.weights[String(term) as '1' | '2']?.[subjectId];
  const maxes = (type === 'F' ? w?.F : w?.S) ?? {};
  const otherMaxes = (type === 'F' ? w?.S : w?.F) ?? {};
  const usedTools = tools.filter((t) => (maxes[t.key] ?? 0) > 0);

  const [mode, setMode] = useState<'table' | 'card'>(() => (window.innerWidth < 640 ? 'card' : 'table'));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [cell, setCell] = useState<Record<string, CellState>>({});
  const [lastError, setLastError] = useState('');
  const [fill, setFill] = useState<ToolDef | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const refs = useRef(new Map<string, HTMLInputElement>());

  // new subject/term → forget unsaved text
  useEffect(() => {
    setDraft({});
    setCell({});
    setLastError('');
  }, [subjectId, term, type]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    if (k === 'term') p.delete('subject');
    setParams(p, { replace: true });
  };

  const students = b?.students ?? [];
  const keyOf = (sid: string, tool: string) => `${sid}|${tool}`;
  const dbScore = (sid: string, tool: string, t: AType = type) => b?.idx.get(assessmentId(sid, subjectId, term, t))?.scores[tool];
  const textOf = (sid: string, tool: string) => {
    const k = keyOf(sid, tool);
    if (k in draft) return draft[k];
    const v = dbScore(sid, tool);
    return v === null || v === undefined ? '' : fmtNum(v);
  };

  function rowCalc(st: Student) {
    const own: Record<string, number | null> = {};
    for (const t of tools) {
      const chk = validateMark(textOf(st.id, t.key), maxes[t.key] ?? 0);
      own[t.key] = chk.ok ? chk.value : (dbScore(st.id, t.key) ?? null);
    }
    const mine = sumTools(tools, maxes, own);
    const otherTools = type === 'F' ? cfg.sParts : cfg.fTools;
    const other = sumTools(otherTools, otherMaxes, b?.idx.get(assessmentId(st.id, subjectId, term, type === 'F' ? 'S' : 'F'))?.scores);
    const entered = mine.count + other.count > 0;
    const total = entered ? round2((mine.obt ?? 0) + (other.obt ?? 0)) : null;
    const max = mine.max + other.max;
    const pct = entered ? percent(total, max) : null;
    return { mine, other, total, max, pct, grade: gradeFor(pct, cfg.grades, cfg.result.roundForGrade) };
  }

  async function onInput(st: Student, tool: ToolDef, raw: string) {
    const k = keyOf(st.id, tool.key);
    setDraft((d) => ({ ...d, [k]: raw }));
    const chk = validateMark(raw, maxes[tool.key] ?? 0);
    if (!chk.ok) {
      setCell((c) => ({ ...c, [k]: 'error' }));
      setLastError(`${st.fullName} — ${tool.label}: ${chk.error}`);
      return;
    }
    if (chk.value === (dbScore(st.id, tool.key) ?? null)) {
      setCell((c) => ({ ...c, [k]: 'saved' }));
      return;
    }
    setCell((c) => ({ ...c, [k]: 'saving' }));
    setLastError('');
    try {
      await track(repo.setScore(scope, { studentId: st.id, subjectId, term, type, key: tool.key, value: chk.value }));
      setCell((c) => (c[k] === 'saving' ? { ...c, [k]: 'saved' } : c));
    } catch {
      setCell((c) => ({ ...c, [k]: 'error' }));
      setLastError(MSG.marksInvalid);
    }
  }

  function focusCell(row: number, col: number) {
    const st = students[row];
    const tool = usedTools[col];
    if (!st || !tool) return false;
    const el = refs.current.get(keyOf(st.id, tool.key));
    if (el) {
      el.focus();
      el.select();
      return true;
    }
    return false;
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const el = e.currentTarget;
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.shiftKey) focusCell(row - 1, col);
      else if (!focusCell(row + 1, col)) focusCell(0, col + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(row - 1, col);
    } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) {
      if (focusCell(row, col + 1)) e.preventDefault();
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (focusCell(row, col - 1)) e.preventDefault();
    }
  }

  const stats = useMemo(() => {
    let done = 0;
    for (const st of students) {
      if (usedTools.some((t) => dbScore(st.id, t.key) !== null && dbScore(st.id, t.key) !== undefined)) done++;
    }
    return { done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, subjectId, term, type]);

  if (!b) return null;
  const title = type === 'F' ? 'आकारिक मूल्यमापन' : 'संकलित मूल्यमापन';
  const typeTotalLabel = type === 'F' ? 'आकारिक (अ)' : 'संकलित (ब)';
  const otherTotalLabel = type === 'F' ? 'संकलित (ब)' : 'आकारिक (अ)';
  const myMax = usedTools.reduce((a, t) => a + (maxes[t.key] ?? 0), 0);
  const otherMax = (type === 'F' ? cfg.sParts : cfg.fTools).reduce((a, t) => a + ((otherMaxes[t.key] ?? 0) > 0 ? (otherMaxes[t.key] as number) : 0), 0);

  const toolbar = (
    <div className="panel mb-3 grid gap-3 p-3 md:grid-cols-[auto_1fr_auto] md:items-end">
      <div>
        <span className="mb-1 block text-[13px] font-semibold text-muted">सत्र</span>
        <Segmented label="सत्र" value={term} onChange={(v) => setParam('term', String(v))} options={[{ value: 1 as Term, label: TERM_LABEL[1] }, { value: 2 as Term, label: TERM_LABEL[2] }]} />
      </div>
      <InlineSelect
        label="विषय"
        value={subjectId}
        onChange={(v) => setParam('subject', v)}
        options={subjectsForType.map(({ s, used }) => ({ value: s.id, label: used ? s.name : `${s.name} (${type === 'F' ? 'आकारिक' : 'संकलित'} नाही)`, disabled: !used }))}
      />
      <div>
        <span className="mb-1 block text-[13px] font-semibold text-muted">मांडणी</span>
        <Segmented
          label="मांडणी"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'table', label: 'तक्ता' },
            { value: 'card', label: 'एकेक विद्यार्थी' },
          ]}
        />
      </div>
    </div>
  );

  const header = (
    <PageHeader
      title={title}
      subtitle={`इयत्ता ${standardLabel(cls.standard)} (${cls.section}) — ${subject?.name ?? ''}, ${TERM_LABEL[term]} — ${stats.done}/${students.length} विद्यार्थ्यांचे गुण भरले`}
      actions={
        <>
          <Button
            icon="download"
            size="sm"
            onClick={() =>
              downloadBytes(
                toXlsx(marksWorkbook(cfg, b.students, b.results, b.idx)),
                `${safeFileName(`गुण-${standardLabel(cls.standard)}-${cls.section}-${cls.year}`)}.xlsx`,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              )
            }
          >
            गुण निर्यात (Excel)
          </Button>
          <LinkButton to={`/reports/subject-wise?term=${term}&subject=${subjectId}`} size="sm" icon="printer">
            विषयवार नोंद PDF
          </LinkButton>
        </>
      }
    />
  );

  if (!students.length) {
    return (
      <div>
        {header}
        <EmptyState icon="student" title="गुण भरण्यासाठी आधी विद्यार्थी जोडा." action={<LinkButton to="/students/new" variant="primary" icon="plus">विद्यार्थी जोडा</LinkButton>} />
      </div>
    );
  }

  return (
    <div>
      {header}
      {toolbar}
      {!usedTools.length ? (
        <Notice kind="warn">
          {subject?.name} विषयासाठी {TERM_LABEL[term]}मध्ये {type === 'F' ? 'आकारिक' : 'संकलित'} मूल्यमापनाची साधने ठरवलेली नाहीत.{' '}
          <Link to="/settings/weights" className="font-semibold underline">
            सेटिंग्ज → भारांश
          </Link>{' '}
          येथे कमाल गुण ठरवा.
        </Notice>
      ) : (
        <>
          <p className="mb-2 text-[14px] text-muted" id="entry-help">
            गुण टाइप करताच आपोआप जतन होतात. Enter दाबल्यावर पुढील विद्यार्थ्याकडे जा. कमाल गुणांपेक्षा जास्त गुण स्वीकारले जात नाहीत.
          </p>
          <div aria-live="polite" className="mb-2 min-h-[1.5em]">
            {lastError ? <p className="text-[14.5px] font-semibold text-margin">{lastError}</p> : null}
          </div>

          {mode === 'table' ? (
            <div className="panel scroll-x max-h-[calc(100dvh-210px)] overflow-y-auto">
              <table className="grid-table" aria-describedby="entry-help">
                <thead>
                  <tr>
                    <th className="w-12">हजेरी क्र.</th>
                    <th className="sticky-col min-w-[140px] !text-left">विद्यार्थ्याचे नाव</th>
                    {usedTools.map((t) => (
                      <th key={t.key} className="min-w-[60px]">
                        <div>{t.label}</div>
                        <div className="tabular text-[12px] font-normal text-muted">/{maxes[t.key]}</div>
                        <button type="button" className="mt-1 rounded px-1.5 py-0.5 text-[12px] font-semibold text-ink underline-offset-2 hover:bg-white hover:underline" onClick={() => setFill(t)}>
                          भरा
                        </button>
                      </th>
                    ))}
                    <th className="min-w-[56px]">
                      {typeTotalLabel}
                      <div className="tabular text-[12px] font-normal text-muted">/{myMax}</div>
                    </th>
                    {otherMax > 0 ? (
                      <th className="min-w-[56px]">
                        {otherTotalLabel}
                        <div className="tabular text-[12px] font-normal text-muted">/{otherMax}</div>
                      </th>
                    ) : null}
                    <th className="min-w-[52px]">
                      अ+ब<div className="tabular text-[12px] font-normal text-muted">/{myMax + otherMax}</div>
                    </th>
                    <th>श्रेणी</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, ri) => {
                    const r = rowCalc(st);
                    return (
                      <tr key={st.id}>
                        <td className="tabular text-muted">{st.rollNo ?? ''}</td>
                        <td className="sticky-col !py-1.5 text-[15px] font-semibold">{st.fullName}</td>
                        {usedTools.map((t, ci) => {
                          const k = keyOf(st.id, t.key);
                          const state = cell[k];
                          return (
                            <td key={t.key}>
                              <input
                                ref={(el) => {
                                  if (el) refs.current.set(k, el);
                                  else refs.current.delete(k);
                                }}
                                className={`cell-input ${state === 'saved' ? 'is-saved' : ''}`}
                                inputMode="decimal"
                                autoComplete="off"
                                value={textOf(st.id, t.key)}
                                aria-label={`${st.fullName} — ${t.label} (कमाल ${maxes[t.key]})`}
                                aria-invalid={state === 'error' ? true : undefined}
                                onChange={(e) => void onInput(st, t, e.target.value)}
                                onKeyDown={(e) => onKey(e, ri, ci)}
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </td>
                          );
                        })}
                        <td className="tabular font-semibold">{fmtNum(r.mine.obt)}</td>
                        {otherMax > 0 ? <td className="tabular text-muted">{fmtNum(r.other.obt)}</td> : null}
                        <td className="tabular font-bold">{fmtNum(r.total)}</td>
                        <td className="font-bold text-ink-deep">{r.grade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            (() => {
              const i = Math.min(cardIdx, students.length - 1);
              const st = students[i];
              const r = rowCalc(st);
              return (
                <div className="panel p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar s={st} size={52} />
                    <div className="min-w-0 flex-1">
                      <select className="field-input !min-h-[42px] font-semibold" value={st.id} onChange={(e) => setCardIdx(students.findIndex((x) => x.id === e.target.value))} aria-label="विद्यार्थी निवडा">
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.rollNo ? `${s.rollNo}. ` : ''}
                            {s.fullName}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[13.5px] text-muted">
                        {i + 1} / {students.length}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {usedTools.map((t, ci) => {
                      const k = keyOf(st.id, t.key);
                      const state = cell[k];
                      return (
                        <label key={t.key} className="block">
                          <span className="mb-1 block text-[14px] font-semibold">
                            {t.label} <span className="tabular font-normal text-muted">/{maxes[t.key]}</span>
                          </span>
                          <input
                            ref={(el) => {
                              if (el) refs.current.set(k, el);
                              else refs.current.delete(k);
                            }}
                            className={`field-input tabular text-center !text-[20px] ${state === 'saved' ? '!border-[#9ccfb1]' : ''}`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={textOf(st.id, t.key)}
                            aria-invalid={state === 'error' ? true : undefined}
                            onChange={(e) => void onInput(st, t, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!focusCell(i, ci + 1)) setCardIdx(Math.min(students.length - 1, i + 1));
                              }
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-ink-soft p-3 text-center">
                    <div>
                      <div className="text-[12.5px] text-muted">{typeTotalLabel}</div>
                      <div className="tabular text-[20px] font-bold">{fmtNum(r.mine.obt) || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[12.5px] text-muted">{otherTotalLabel}</div>
                      <div className="tabular text-[20px] font-bold">{fmtNum(r.other.obt) || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[12.5px] text-muted">अ+ब / {r.max}</div>
                      <div className="tabular text-[20px] font-bold">{fmtNum(r.total) || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[12.5px] text-muted">श्रेणी ({fmtPct(r.pct) || 0}%)</div>
                      <div className="text-[20px] font-bold text-ink-deep">{r.grade || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between gap-2">
                    <Button icon="left" disabled={i === 0} onClick={() => setCardIdx(i - 1)}>
                      मागील
                    </Button>
                    <Button variant="primary" disabled={i >= students.length - 1} onClick={() => setCardIdx(i + 1)}>
                      पुढील विद्यार्थी <Icon name="right" size={18} />
                    </Button>
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}

      <FillDialog
        tool={fill}
        max={fill ? (maxes[fill.key] ?? 0) : 0}
        onClose={() => setFill(null)}
        onFill={async (value, overwrite) => {
          if (!fill) return;
          const n = await track(repo.fillScores(scope, { studentIds: students.map((s) => s.id), subjectId, term, type, key: fill.key, value, overwrite }));
          setDraft((d) => {
            const next = { ...d };
            for (const s of students) delete next[keyOf(s.id, fill.key)];
            return next;
          });
          toast(`${n} विद्यार्थ्यांचे गुण भरले.`);
          setFill(null);
        }}
      />
    </div>
  );
}

function FillDialog({ tool, max, onClose, onFill }: { tool: ToolDef | null; max: number; onClose: () => void; onFill: (v: number, overwrite: boolean) => Promise<void> }) {
  const [val, setVal] = useState('');
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setVal('');
    setOver(false);
    setErr('');
  }, [tool]);
  return (
    <Modal
      open={!!tool}
      onClose={onClose}
      title={`${tool?.label ?? ''} — सर्वांना गुण भरा`}
      footer={
        <>
          <Button onClick={onClose}>रद्द करा</Button>
          <Button
            variant="primary"
            onClick={async () => {
              const chk = validateMark(val, max);
              if (!chk.ok || chk.value === null) {
                setErr(chk.ok ? MSG.marksInvalid : chk.error);
                return;
              }
              await onFill(chk.value, over);
            }}
          >
            भरा
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <TextField label={`गुण (कमाल ${max})`} value={val} onChange={setVal} inputMode="decimal" error={err} autoFocus />
        <Checkbox label="आधी भरलेले गुणही बदला" hint="न निवडल्यास फक्त रिकाम्या जागा भरल्या जातील." checked={over} onChange={setOver} />
      </div>
    </Modal>
  );
}
