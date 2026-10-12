import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useClassBundle, useLibrary } from '../../app/data';
import { useTeacher } from '../../app/session';
import { monthOfDate, termOfMonth, todayIso } from '../../lib/format';
import { SPECIAL_AREAS, TERM_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { RemarkCategory, RemarkItem, Student, Term } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { Button, EmptyState, InlineSelect, LinkButton, PageHeader, Segmented } from '../../components/ui';
import { Avatar } from '../students/StudentsPage';

interface Area {
  key: string;
  label: string;
  cat: RemarkCategory;
}

const NEW = '__new__';

function RemarkField({
  student,
  area,
  term,
  saved,
  library,
  showName,
}: {
  student: Student;
  area: Area;
  term: Term;
  saved: string;
  library: RemarkItem[];
  showName?: boolean;
}) {
  const { scope } = useTeacher();
  const { toast } = useFeedback();
  const [text, setText] = useState(saved);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);

  // follow external changes (e.g. copy from previous term) when not typing
  useEffect(() => {
    if (!dirty.current) setText(saved);
  }, [saved]);

  const options = library.filter((i) => i.category === area.cat).map((i) => (student.gender === 'F' ? i.textF || i.text : i.text));
  const inLibrary = !text.trim() || options.includes(text.trim());

  async function save(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState('saving');
    try {
      await track(repo.setRemark(scope, { studentId: student.id, term, area: area.key, text: value }));
      setState('saved');
    } finally {
      dirty.current = false;
    }
  }

  function change(value: string) {
    dirty.current = true;
    setText(value);
    setState('idle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), 600);
  }

  useEffect(
    () => () => {
      // flush on unmount
      if (timer.current) {
        clearTimeout(timer.current);
        void repo.setRemark(scope, { studentId: student.id, term, area: area.key, text: areaRef.current?.value ?? '' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const id = `rm-${student.id}-${area.key}`;
  return (
    <div className="border-b border-rule py-3 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[15px] font-semibold text-ink-deep">
          {showName ? `${student.rollNo ? `${student.rollNo}. ` : ''}${student.fullName}` : area.label}
        </label>
        <span className="text-[12.5px] text-muted" aria-live="polite">
          {state === 'saving' ? 'जतन होत आहे…' : state === 'saved' ? 'जतन झाले ✓' : ''}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <select
          className="field-input"
          aria-label={`${area.label} — वर्णनात्मक नोंद निवडा`}
          value={options.includes(text.trim()) ? text.trim() : ''}
          onChange={(e) => {
            if (e.target.value === NEW) {
              change('');
              areaRef.current?.focus();
              return;
            }
            if (!e.target.value) return;
            setText(e.target.value);
            dirty.current = true;
            void save(e.target.value);
          }}
        >
          <option value="">वर्णनात्मक नोंद निवडा ▾</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={NEW}>+ नवीन नोंद लिहा</option>
        </select>
        <div className="flex gap-2">
          <textarea
            id={id}
            ref={areaRef}
            rows={2}
            className="field-input min-w-0 flex-1 !min-h-[46px] resize-y text-[15px]"
            value={text}
            placeholder="येथे नोंद लिहा किंवा बदला"
            onChange={(e) => change(e.target.value)}
            onBlur={() => {
              if (timer.current) void save(text);
            }}
          />
          {!inLibrary ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm shrink-0 !px-2.5"
              title="ही नोंद संचात जोडा"
              aria-label="ही नोंद वर्णनात्मक नोंद संचात जोडा"
              onClick={async () => {
                await track(repo.addRemarkItem(scope, area.cat, text.trim()));
                toast('नोंद संचात जोडली — पुढे ड्रॉपडाऊनमध्ये दिसेल.');
              }}
            >
              <Icon name="plus" size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function RemarksPage() {
  const { cfg, scope } = useTeacher();
  const b = useClassBundle();
  const library = useLibrary();
  const { toast, confirm } = useFeedback();
  const [params, setParams] = useSearchParams();
  const term = (params.get('term') === '2' ? 2 : params.get('term') === '1' ? 1 : termOfMonth(monthOfDate(todayIso()))) as Term;
  const mode = params.get('mode') === 'area' ? 'area' : 'student';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  const areas: Area[] = useMemo(
    () => [...cfg.subjects.map((s) => ({ key: s.id, label: s.remarkLabel || s.name, cat: s.remarkCat })), ...SPECIAL_AREAS.map((a) => ({ key: a.key, label: a.label, cat: a.cat }))],
    [cfg.subjects],
  );

  if (!b || !library) return null;
  const students = b.students;
  if (!students.length) {
    return (
      <div>
        <PageHeader title="वर्णनात्मक नोंदी" />
        <EmptyState icon="student" title="नोंदी लिहिण्यासाठी आधी विद्यार्थी जोडा." action={<LinkButton to="/students/new" variant="primary">विद्यार्थी जोडा</LinkButton>} />
      </div>
    );
  }
  const sid = params.get('student') && students.some((s) => s.id === params.get('student')) ? params.get('student')! : students[0].id;
  const idx = students.findIndex((s) => s.id === sid);
  const st = students[idx];
  const areaKey = params.get('area') && areas.some((a) => a.key === params.get('area')) ? params.get('area')! : areas[0].key;
  const area = areas.find((a) => a.key === areaKey)!;
  const remarkOf = (s: string, a: string, t: Term = term) => b.remarkMap.get(`${s}|${t}|${a}`)?.text ?? '';
  const filled = areas.filter((a) => remarkOf(st.id, a.key)).length;

  return (
    <div>
      <PageHeader
        title="वर्णनात्मक नोंदी"
        subtitle="विषयवार वर्णनात्मक नोंदी — ड्रॉपडाऊनमधून निवडा किंवा स्वतः लिहा. लिहिताच आपोआप जतन होते."
        actions={
          <>
            <LinkButton to="/remarks/library" size="sm" icon="book">
              वर्णनात्मक नोंद संच
            </LinkButton>
            <LinkButton to={`/reports/remarks?term=${term}`} size="sm" icon="printer">
              PDF
            </LinkButton>
          </>
        }
      />
      <div className="panel mb-3 flex flex-wrap items-end gap-3 p-3">
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-muted">सत्र</span>
          <Segmented label="सत्र" value={term} onChange={(v) => set('term', String(v))} options={[{ value: 1 as Term, label: TERM_LABEL[1] }, { value: 2 as Term, label: TERM_LABEL[2] }]} />
        </div>
        <div>
          <span className="mb-1 block text-[13px] font-semibold text-muted">पद्धत</span>
          <Segmented
            label="पद्धत"
            value={mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'student', label: 'विद्यार्थीनिहाय' },
              { value: 'area', label: 'विषयनिहाय' },
            ]}
          />
        </div>
        {mode === 'area' ? (
          <InlineSelect className="min-w-[240px] flex-1" label="विषय / क्षेत्र" value={areaKey} onChange={(v) => set('area', v)} options={areas.map((a) => ({ value: a.key, label: a.label }))} />
        ) : null}
      </div>

      {mode === 'student' ? (
        <div className="panel p-3 md:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Avatar s={st} size={48} />
            <select className="field-input min-w-0 flex-1 font-semibold" value={st.id} onChange={(e) => set('student', e.target.value)} aria-label="विद्यार्थी निवडा">
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNo ? `${s.rollNo}. ` : ''}
                  {s.fullName}
                </option>
              ))}
            </select>
            <span className="text-[14px] text-muted">
              {filled}/{areas.length} नोंदी
            </span>
          </div>
          {term === 2 ? (
            <Button
              size="sm"
              icon="copy"
              className="mb-1"
              onClick={async () => {
                const ok = await confirm({ title: 'प्रथम सत्रातील नोंदी', message: 'या विद्यार्थ्याच्या प्रथम सत्रातील नोंदी द्वितीय सत्रात रिकाम्या जागी कॉपी करायच्या का?', confirmLabel: 'कॉपी करा' });
                if (!ok) return;
                let n = 0;
                for (const a of areas) {
                  const prev = remarkOf(st.id, a.key, 1);
                  if (prev && !remarkOf(st.id, a.key, 2)) {
                    await track(repo.setRemark(scope, { studentId: st.id, term: 2, area: a.key, text: prev }));
                    n++;
                  }
                }
                toast(`${n} नोंदी कॉपी केल्या.`);
              }}
            >
              प्रथम सत्रातील नोंदी कॉपी करा
            </Button>
          ) : null}
          <div key={`${st.id}-${term}`}>
            {areas.map((a) => (
              <RemarkField key={a.key} student={st} area={a} term={term} saved={remarkOf(st.id, a.key)} library={library} />
            ))}
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <Button icon="left" disabled={idx <= 0} onClick={() => set('student', students[idx - 1].id)}>
              मागील
            </Button>
            <Button variant="primary" disabled={idx >= students.length - 1} onClick={() => set('student', students[idx + 1].id)}>
              पुढील विद्यार्थी <Icon name="right" size={18} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="panel p-3 md:p-4">
          <h2 className="mb-1 text-[17px] font-semibold text-ink-deep">{area.label}</h2>
          <div key={`${area.key}-${term}`}>
            {students.map((s) => (
              <RemarkField key={s.id} student={s} area={area} term={term} saved={remarkOf(s.id, area.key)} library={library} showName />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
