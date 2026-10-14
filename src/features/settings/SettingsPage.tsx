import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { promptInstall, requestPersistentStorage, storageInfo, usePwa } from '../../app/pwa';
import { useClassBundle } from '../../app/data';
import { useSession, useTeacher } from '../../app/session';
import { backupFileName, exportClass, parseBackup, restoreClass, serializeBackup, BackupError, type ClassBackup } from '../../lib/backup';
import { sumTools } from '../../lib/calc';
import { canEncrypt, uid } from '../../lib/crypto';
import { db } from '../../lib/db';
import { defaultGrades, defaultResultRules, defaultSubjectWeights, distributeSummative, isCoScholasticCat } from '../../lib/defaults';
import { seedDemo } from '../../lib/demo';
import { marksWorkbook } from '../../lib/exportMarks';
import { safeFileName } from '../../lib/format';
import { APP_VERSION, REMARK_CATEGORIES, REMARK_CATEGORY_LABEL, SECTIONS, standardLabel, TERM_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { downloadBytes, downloadText, readFileText } from '../../lib/share';
import { toCsv, toXlsx } from '../../lib/sheet';
import type { ClassConfig, GradeBand, RemarkCategory, School, Subject, Term } from '../../lib/types';
import { validateUdise } from '../../lib/validation';
import { Icon, type IconName } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { Button, Checkbox, InlineSelect, LinkButton, Notice, PageHeader, Panel, Segmented, SelectField, TextField } from '../../components/ui';
import { ChangePasswordForm } from '../auth/ChangePassword';
import { InstallHint } from '../auth/LoginPage';
import { COLUMN_WIDTHS, studentsToRows } from '../students/studentSheet';

const SECTIONS_LIST: { key: string; title: string; icon: IconName; desc: string }[] = [
  { key: 'class', title: 'वर्ग व शाळेची माहिती', icon: 'school', desc: 'तुकडी, वर्गशिक्षकाचे नाव, शाळेचे नाव, UDISE' },
  { key: 'subjects', title: 'विषय', icon: 'book', desc: 'विषय जोडा, नावे बदला, क्रम बदला' },
  { key: 'weights', title: 'भारांश (गुण विभागणी)', icon: 'formative', desc: 'आकारिक साधने व संकलित भागांचे कमाल गुण' },
  { key: 'grades', title: 'श्रेणी नियम', icon: 'bars', desc: 'टक्केवारीनुसार श्रेणी (अ-1 … इ-2)' },
  { key: 'result', title: 'निकाल नियम', icon: 'trophy', desc: 'उत्तीर्णतेची किमान टक्केवारी व शब्द' },
  { key: 'remarks', title: 'वर्णनात्मक नोंद संच', icon: 'remarks', desc: 'ड्रॉपडाऊनमधील तयार नोंदी' },
  { key: 'report', title: 'अहवाल / PDF', icon: 'printer', desc: 'स्वाक्षरीची नावे, पृष्ठ क्रमांक' },
  { key: 'backup', title: 'डेटा बॅकअप', icon: 'database', desc: 'बॅकअप, पुनर्संचयित, Excel निर्यात' },
  { key: 'account', title: 'खाते व पासवर्ड', icon: 'key', desc: 'पासवर्ड बदला, शैक्षणिक वर्ष' },
  { key: 'app', title: 'ॲप व साठवण', icon: 'install', desc: 'ऑफलाइन, स्थापना, नमुना माहिती' },
];

function useConfigSaver() {
  const { scope, cfg } = useTeacher();
  const { toast } = useFeedback();
  return async (next: ClassConfig, msg = 'सेटिंग्ज जतन झाल्या.') => {
    await track(repo.saveClassConfig(scope, next));
    toast(msg);
    return cfg;
  };
}

/* ------------------------------------------------------------------ */
function ClassSection() {
  const { cls, scope, user, school } = useTeacher();
  const { toast } = useFeedback();
  const [section, setSection] = useState(cls.section);
  const [name, setName] = useState(user.displayName);
  const [s, setS] = useState<School>(school);
  const udiseErr = validateUdise(s.udise);
  return (
    <div className="grid gap-4">
      <Panel title="वर्ग">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="इयत्ता" value={standardLabel(cls.standard)} onChange={() => undefined} disabled hint="इयत्ता मुख्याध्यापक खात्यातून ठरते." />
          <SelectField label="तुकडी" value={section} onChange={setSection} options={[...new Set([...SECTIONS, cls.section])].map((x) => ({ value: x, label: x }))} />
          <TextField label="वर्गशिक्षकाचे नाव" value={name} onChange={setName} className="sm:col-span-2" hint="अहवालांवरील स्वाक्षरीखाली हे नाव छापले जाते." />
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            icon="check"
            onClick={async () => {
              if (!name.trim()) return toast('कृपया वर्गशिक्षकाचे नाव भरा.', 'error');
              await track(repo.saveClassSection(scope, section));
              await track(db.users.update(user.id, { displayName: name.trim(), updatedAt: Date.now() }).then(() => undefined));
              toast('वर्गाची माहिती जतन झाली.');
            }}
          >
            जतन करा
          </Button>
        </div>
      </Panel>
      <Panel title="शाळेची माहिती">
        <Notice>ही माहिती सर्व वर्गांसाठी सामायिक आहे आणि प्रत्येक अहवालाच्या शीर्षकावर छापली जाते.</Notice>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="शाळेचे नाव" value={s.name} onChange={(v) => setS({ ...s, name: v })} className="sm:col-span-2" required />
          <TextField label="UDISE क्रमांक" value={s.udise} onChange={(v) => setS({ ...s, udise: v.replace(/\D/g, '') })} inputMode="numeric" maxLength={11} error={udiseErr ?? undefined} />
          <TextField label="व्यवस्थापन / संस्था" value={s.orgLine} onChange={(v) => setS({ ...s, orgLine: v })} placeholder="उदा. जिल्हा परिषद, पुणे" />
          <TextField label="तालुका" value={s.taluka} onChange={(v) => setS({ ...s, taluka: v })} />
          <TextField label="जिल्हा" value={s.district} onChange={(v) => setS({ ...s, district: v })} />
          <TextField label="केंद्र" value={s.centre} onChange={(v) => setS({ ...s, centre: v })} />
          <TextField label="बीट" value={s.beat ?? ''} onChange={(v) => setS({ ...s, beat: v })} />
          <TextField label="मुख्याध्यापकाचे नाव" value={s.headmaster} onChange={(v) => setS({ ...s, headmaster: v })} />
          <TextField label="माध्यम" value={s.medium} onChange={(v) => setS({ ...s, medium: v })} />
          <TextField label="मान्यता क्रमांक" value={s.recognitionNo} onChange={(v) => setS({ ...s, recognitionNo: v })} />
          <TextField label="शाळेचा पत्ता" value={s.address} onChange={(v) => setS({ ...s, address: v })} className="sm:col-span-2" />
        </div>
        <p className="mt-5 mb-2 text-[14.5px] font-semibold text-ink-deep">निकाल पत्रक व संकलन तक्त्यांवरील स्वाक्षऱ्या</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="केंद्रप्रमुख (नाव)" value={s.centreHead ?? ''} onChange={(v) => setS({ ...s, centreHead: v })} />
          <TextField label="विस्तार अधिकारी (नाव)" value={s.extOfficer ?? ''} onChange={(v) => setS({ ...s, extOfficer: v })} />
          <TextField label="गटशिक्षणाधिकारी (नाव)" value={s.blockOfficer ?? ''} onChange={(v) => setS({ ...s, blockOfficer: v })} />
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            icon="check"
            onClick={async () => {
              if (!s.name.trim() || udiseErr) return toast(udiseErr ?? 'कृपया शाळेचे नाव भरा.', 'error');
              await track(repo.saveSchool({ ...s, name: s.name.trim() }));
              toast('शाळेची माहिती जतन झाली.');
            }}
          >
            जतन करा
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function SubjectsSection() {
  const { cfg, cls } = useTeacher();
  const save = useConfigSaver();
  const { confirm } = useFeedback();
  const [list, setList] = useState<Subject[]>(cfg.subjects);
  const [newName, setNewName] = useState('');
  useEffect(() => setList(cfg.subjects), [cfg.subjects]);
  const upd = (i: number, p: Partial<Subject>) => setList((l) => l.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) =>
    setList((l) => {
      const c = [...l];
      const [x] = c.splice(i, 1);
      c.splice(i + d, 0, x);
      return c;
    });

  async function commit(next: Subject[]) {
    const weights = structuredClone(cfg.weights);
    for (const t of ['1', '2'] as const) for (const s of next) if (!weights[t][s.id]) weights[t][s.id] = defaultSubjectWeights(s, cls.standard, cfg.fTools, cfg.sParts);
    await save({ ...cfg, subjects: next, weights }, 'विषय जतन झाले.');
  }

  return (
    <Panel title={`विषय — इयत्ता ${standardLabel(cls.standard)}`}>
      <p className="mb-3 text-[14.5px] text-muted">या इयत्तेचे विषय फक्त याच वर्गासाठी आहेत; दुसऱ्या वर्गावर परिणाम होत नाही. “लहान नाव” अहवालांच्या रकान्यांत वापरले जाते.</p>
      <ul className="grid gap-3">
        {list.map((s, i) => (
          <li key={s.id} className="rounded-lg border border-rule p-3">
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1.4fr_1fr]">
              <TextField label="विषयाचे नाव" value={s.name} onChange={(v) => upd(i, { name: v })} />
              <TextField label="लहान नाव" value={s.short} onChange={(v) => upd(i, { short: v })} />
              <TextField label="वर्णनात्मक नोंदीतील नाव" value={s.remarkLabel} onChange={(v) => upd(i, { remarkLabel: v })} />
              <SelectField label="नोंद प्रकार" value={s.remarkCat} onChange={(v) => upd(i, { remarkCat: v as RemarkCategory })} options={REMARK_CATEGORIES.slice(0, 9).map((c) => ({ value: c, label: REMARK_CATEGORY_LABEL[c] }))} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Checkbox label="एकूण गुण व निकालात धरा" checked={s.inTotal} onChange={(v) => upd(i, { inTotal: v })} />
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="वर हलवा">
                  ↑
                </Button>
                <Button size="sm" variant="ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="खाली हलवा">
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  icon="trash"
                  onClick={async () => {
                    if (await confirm({ title: 'विषय काढा', message: `“${s.name}” विषय यादीतून काढायचा का? आधी भरलेले गुण हटवले जाणार नाहीत, पण अहवालांत दिसणार नाहीत.`, confirmLabel: 'काढा', danger: true }))
                      setList((l) => l.filter((x) => x.id !== s.id));
                  }}
                >
                  काढा
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <TextField label="नवीन विषय" value={newName} onChange={setNewName} className="min-w-[220px] flex-1" placeholder="उदा. संस्कृत" />
        <Button
          icon="plus"
          disabled={!newName.trim()}
          onClick={() => {
            const n = newName.trim();
            setList((l) => [...l, { id: `s-${uid().slice(0, 8)}`, name: n, short: n, remarkLabel: n, remarkCat: 'special', inTotal: true }]);
            setNewName('');
          }}
        >
          विषय जोडा
        </Button>
      </div>
      <div className="mt-4 flex gap-2 border-t border-rule pt-4">
        <Button variant="primary" icon="check" onClick={() => void commit(list.map((s) => ({ ...s, name: s.name.trim() || 'विषय', short: s.short.trim() || s.name.trim() })))}>
          जतन करा
        </Button>
        <Button variant="ghost" onClick={() => setList(cfg.subjects)}>
          रद्द करा
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function WeightsSection() {
  const { cfg, cls } = useTeacher();
  const save = useConfigSaver();
  const { toast } = useFeedback();
  const [term, setTerm] = useState<Term>(1);
  const [sid, setSid] = useState(cfg.subjects[0]?.id ?? '');
  const [both, setBoth] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const w = cfg.weights[String(term) as '1' | '2']?.[sid];
  const subject = cfg.subjects.find((s) => s.id === sid);
  useEffect(() => setDraft({}), [term, sid]);
  if (!subject) return <Notice>आधी विषय जोडा.</Notice>;

  const val = (type: 'F' | 'S', key: string) => {
    const k = `${type}|${key}`;
    if (k in draft) return draft[k];
    const v = (type === 'F' ? w?.F : w?.S)?.[key];
    return v ? String(v) : '';
  };
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const fTotal = cfg.fTools.reduce((a, t) => a + (num(val('F', t.key)) ?? 0), 0);
  const sTotal = cfg.sParts.reduce((a, t) => a + (num(val('S', t.key)) ?? 0), 0);
  const bad = [...cfg.fTools.map((t) => val('F', t.key)), ...cfg.sParts.map((t) => val('S', t.key))].some((v) => v.trim() !== '' && !(Number(v) >= 0 && Number(v) <= 100));

  async function commit() {
    if (bad) return toast('कमाल गुण 0 ते 100 दरम्यान असावेत.', 'error');
    const F: Record<string, number | null> = {};
    const S: Record<string, number | null> = {};
    for (const t of cfg.fTools) F[t.key] = num(val('F', t.key)) || null;
    for (const t of cfg.sParts) S[t.key] = num(val('S', t.key)) || null;
    const weights = structuredClone(cfg.weights);
    for (const t of both ? (['1', '2'] as const) : ([String(term)] as ('1' | '2')[])) weights[t][sid] = { F, S };
    await save({ ...cfg, weights }, 'भारांश जतन झाला.');
    setDraft({});
  }

  return (
    <div className="grid gap-4">
      <Panel title="भारांश निश्चिती">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1 block text-[13px] font-semibold text-muted">सत्र</span>
            <Segmented label="सत्र" value={term} onChange={setTerm} options={[{ value: 1 as Term, label: TERM_LABEL[1] }, { value: 2 as Term, label: TERM_LABEL[2] }]} />
          </div>
          <InlineSelect className="min-w-[220px] flex-1" label="विषय" value={sid} onChange={setSid} options={cfg.subjects.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        <h3 className="mb-2 font-semibold text-ink-deep">आकारिक मूल्यमापन (अ) — साधनांचे कमाल गुण</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cfg.fTools.map((t) => (
            <TextField key={t.key} label={t.label} value={val('F', t.key)} inputMode="numeric" onChange={(v) => setDraft((d) => ({ ...d, [`F|${t.key}`]: v.replace(/[^\d]/g, '') }))} hint="रिकामे = साधन वापरले नाही" />
          ))}
        </div>
        <h3 className="mt-5 mb-2 font-semibold text-ink-deep">संकलित मूल्यमापन (ब) — भागांचे कमाल गुण</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cfg.sParts.map((t) => (
            <TextField key={t.key} label={t.label} value={val('S', t.key)} inputMode="numeric" onChange={(v) => setDraft((d) => ({ ...d, [`S|${t.key}`]: v.replace(/[^\d]/g, '') }))} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-ink-soft p-3 text-center">
          <div>
            <div className="text-[13px] text-muted">आकारिक (अ)</div>
            <div className="tabular text-[22px] font-bold">{fTotal}</div>
          </div>
          <div>
            <div className="text-[13px] text-muted">संकलित (ब)</div>
            <div className="tabular text-[22px] font-bold">{sTotal}</div>
          </div>
          <div>
            <div className="text-[13px] text-muted">एकूण (अ+ब)</div>
            <div className={`tabular text-[22px] font-bold ${fTotal + sTotal === 100 ? 'text-leaf' : 'text-turmeric'}`}>{fTotal + sTotal}</div>
          </div>
        </div>
        {fTotal + sTotal !== 100 ? (
          <div className="mt-3">
            <Notice kind="warn">सहसा प्रत्येक विषयाचे एकूण 100 गुण असतात. सध्याचे एकूण {fTotal + sTotal} आहे — टक्केवारी याच एकूणावर काढली जाईल.</Notice>
          </div>
        ) : null}
        <div className="mt-4">
          <Checkbox label="दोन्ही सत्रांसाठी हाच भारांश वापरा" checked={both} onChange={setBoth} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-rule pt-4">
          <Button variant="primary" icon="check" onClick={() => void commit()}>
            जतन करा
          </Button>
          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              const d = defaultSubjectWeights(subject, cls.standard, cfg.fTools, cfg.sParts);
              const next: Record<string, string> = {};
              for (const t of cfg.fTools) next[`F|${t.key}`] = d.F[t.key] ? String(d.F[t.key]) : '';
              for (const t of cfg.sParts) next[`S|${t.key}`] = d.S[t.key] ? String(d.S[t.key]) : '';
              setDraft(next);
            }}
          >
            मूळ भारांश भरा
          </Button>
          {isCoScholasticCat(subject.remarkCat) ? null : (
            <Button
              variant="ghost"
              onClick={() => {
                const next: Record<string, string> = { ...draft };
                const d = distributeSummative(0, cfg.sParts);
                for (const t of cfg.sParts) next[`S|${t.key}`] = d[t.key] ? String(d[t.key]) : '';
                setDraft(next);
              }}
            >
              संकलित भाग रिकामे करा
            </Button>
          )}
        </div>
      </Panel>
      <ToolNamesPanel />
    </div>
  );
}

function ToolNamesPanel() {
  const { cfg } = useTeacher();
  const save = useConfigSaver();
  const [f, setF] = useState(cfg.fTools);
  const [s, setS] = useState(cfg.sParts);
  useEffect(() => {
    setF(cfg.fTools);
    setS(cfg.sParts);
  }, [cfg.fTools, cfg.sParts]);
  return (
    <Panel title="मूल्यमापन साधनांची नावे">
      <p className="mb-3 text-[14.5px] text-muted">शाळेत वेगळी नावे वापरत असल्यास येथे बदला. नवीन साधन जोडल्यानंतर “भारांश” मध्ये त्याचे कमाल गुण भरा.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {f.map((t, i) => (
          <TextField key={t.key} label={`आकारिक साधन ${i + 1}`} value={t.label} onChange={(v) => setF((l) => l.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
        ))}
        {s.map((t, i) => (
          <TextField key={`s${t.key}`} label={`संकलित भाग ${i + 1}`} value={t.label} onChange={(v) => setS((l) => l.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon="check" onClick={() => void save({ ...cfg, fTools: f.map((t) => ({ ...t, label: t.label.trim() || t.key })), sParts: s.map((t) => ({ ...t, label: t.label.trim() || t.key })) })}>
          जतन करा
        </Button>
        <Button icon="plus" disabled={f.length >= 12} onClick={() => setF((l) => [...l, { key: `t${uid().slice(0, 6)}`, label: 'नवीन साधन' }])}>
          आकारिक साधन जोडा
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function GradesSection() {
  const { cfg } = useTeacher();
  const save = useConfigSaver();
  const { toast } = useFeedback();
  const [rows, setRows] = useState<GradeBand[]>([...cfg.grades].sort((a, b) => b.min - a.min));
  useEffect(() => setRows([...cfg.grades].sort((a, b) => b.min - a.min)), [cfg.grades]);
  return (
    <Panel title="श्रेणी नियम">
      <p className="mb-3 text-[14.5px] text-muted">टक्केवारी या किमान मर्यादेइतकी किंवा जास्त असल्यास ती श्रेणी मिळते. (मूळ नियम: महाराष्ट्र सातत्यपूर्ण सर्वंकष मूल्यमापन, इ. 1 ली ते 8 वी.)</p>
      <table className="grid-table max-w-md">
        <thead>
          <tr>
            <th>श्रेणी</th>
            <th>किमान टक्केवारी</th>
            <th>पर्यंत</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr key={i}>
              <td>
                <input className="cell-input !w-20" value={g.label} aria-label="श्रेणी" onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </td>
              <td>
                <input className="cell-input" inputMode="numeric" value={String(g.min)} aria-label="किमान टक्केवारी" onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, min: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } : x)))} />
              </td>
              <td className="tabular text-muted">{i === 0 ? 100 : Math.max(g.min, rows[i - 1].min - 1)}</td>
              <td>
                <button type="button" className="btn btn-danger-ghost btn-sm !px-2" aria-label="श्रेणी काढा" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} disabled={rows.length <= 2}>
                  <Icon name="trash" size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon="check"
          onClick={async () => {
            const sorted = [...rows].sort((a, b) => b.min - a.min).map((g) => ({ label: g.label.trim(), min: g.min }));
            if (sorted.some((g) => !g.label)) return toast('प्रत्येक श्रेणीचे नाव भरा.', 'error');
            if (new Set(sorted.map((g) => g.label)).size !== sorted.length) return toast('श्रेणीची नावे वेगवेगळी असावीत.', 'error');
            if (sorted[sorted.length - 1].min !== 0) return toast('शेवटच्या श्रेणीची किमान टक्केवारी 0 असावी.', 'error');
            if (sorted.some((g) => g.min > 100)) return toast('टक्केवारी 100 पेक्षा जास्त असू शकत नाही.', 'error');
            await save({ ...cfg, grades: sorted }, 'श्रेणी नियम जतन झाले.');
          }}
        >
          जतन करा
        </Button>
        <Button icon="plus" onClick={() => setRows((r) => [...r, { label: '', min: 0 }])}>
          श्रेणी जोडा
        </Button>
        <Button variant="ghost" icon="refresh" onClick={() => setRows(defaultGrades())}>
          मूळ नियम भरा
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function ResultSection() {
  const { cfg } = useTeacher();
  const save = useConfigSaver();
  const [r, setR] = useState(cfg.result);
  useEffect(() => setR(cfg.result), [cfg.result]);
  const num = (v: string) => Math.min(100, Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0));
  return (
    <Panel title="निकाल नियम">
      <Notice>निकाल ठरवण्याचे नियम शाळेच्या/शासनाच्या सूचनेनुसार बदला. उदा. इयत्ता 5 वी व 8 वी साठी वार्षिक परीक्षेचे नियम वेगळे असू शकतात.</Notice>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="एकूण किमान टक्केवारी" value={String(r.overallMin)} onChange={(v) => setR({ ...r, overallMin: num(v) })} inputMode="decimal" />
        <TextField label="प्रत्येक विषयात किमान टक्केवारी" value={String(r.subjectMin)} onChange={(v) => setR({ ...r, subjectMin: num(v) })} inputMode="decimal" hint="0 = हा नियम लागू नाही" />
        <TextField label="उत्तीर्ण असल्यास शब्द" value={r.passLabel} onChange={(v) => setR({ ...r, passLabel: v })} />
        <TextField label="मर्यादेपेक्षा कमी असल्यास शब्द" value={r.failLabel} onChange={(v) => setR({ ...r, failLabel: v })} hint="उदा. आवश्यक सुधारणा / अनुत्तीर्ण" />
        <TextField label="गुण नसल्यास (अनुपस्थित)" value={r.absentLabel} onChange={(v) => setR({ ...r, absentLabel: v })} />
        <TextField label="माहिती अपूर्ण असल्यास" value={r.incompleteLabel} onChange={(v) => setR({ ...r, incompleteLabel: v })} />
      </div>
      <div className="mt-4">
        <Checkbox label="श्रेणी ठरवताना टक्केवारी पूर्णांकात करा (उदा. 90.5 → 91)" checked={r.roundForGrade} onChange={(v) => setR({ ...r, roundForGrade: v })} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon="check" onClick={() => void save({ ...cfg, result: { ...r, passLabel: r.passLabel.trim() || 'उत्तीर्ण', failLabel: r.failLabel.trim() || 'आवश्यक सुधारणा' } }, 'निकाल नियम जतन झाले.')}>
          जतन करा
        </Button>
        <Button variant="ghost" icon="refresh" onClick={() => setR(defaultResultRules())}>
          मूळ नियम भरा
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function ReportSection() {
  const { cfg } = useTeacher();
  const save = useConfigSaver();
  const [r, setR] = useState(cfg.report);
  useEffect(() => setR(cfg.report), [cfg.report]);
  return (
    <Panel title="अहवाल / PDF सेटिंग्ज">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="वर्गशिक्षक स्वाक्षरी (शीर्षक)" value={r.teacherSignLabel} onChange={(v) => setR({ ...r, teacherSignLabel: v })} />
        <TextField label="मुख्याध्यापक स्वाक्षरी (शीर्षक)" value={r.headSignLabel} onChange={(v) => setR({ ...r, headSignLabel: v })} />
        <TextField label="पालक स्वाक्षरी (शीर्षक)" value={r.parentSignLabel} onChange={(v) => setR({ ...r, parentSignLabel: v })} />
      </div>
      <div className="mt-4 grid gap-3">
        <Checkbox label="अनेक पानांच्या अहवालांवर पृष्ठ क्रमांक छापा" checked={r.showPageNumbers} onChange={(v) => setR({ ...r, showPageNumbers: v })} />
        <Checkbox label="प्रगती कार्डावर शाळेचे नाव छापा" checked={r.showSchoolOnCards} onChange={(v) => setR({ ...r, showSchoolOnCards: v })} />
        <Checkbox
          label="निकाल पत्रक व संकलन तक्त्यांत मराठी अंक (१, २, ३) छापा"
          hint="न निवडल्यास इंग्रजी अंक (1, 2, 3) छापले जातील."
          checked={r.marathiDigits !== false}
          onChange={(v) => setR({ ...r, marathiDigits: v })}
        />
      </div>
      <p className="mt-3 text-[14px] text-muted">सर्व PDF मध्ये Noto Sans Devanagari (SIL Open Font License) हा युनिकोड मराठी फॉन्ट वापरला जातो, त्यामुळे कोणत्याही मोबाईल/संगणकावर अक्षरे तुटत नाहीत.</p>
      <div className="mt-4">
        <Button variant="primary" icon="check" onClick={() => void save({ ...cfg, report: r })}>
          जतन करा
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function BackupSection() {
  const { scope, cls, cfg } = useTeacher();
  const b = useClassBundle();
  const { toast, confirm } = useFeedback();
  const [pw, setPw] = useState('');
  const [usePw, setUsePw] = useState(false);
  const [restorePw, setRestorePw] = useState('');
  const [needPw, setNeedPw] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const last = useLiveQuery(() => db.meta.get(`lastBackup:${scope.classId}`), [scope.classId]);
  const label = safeFileName(`${standardLabel(cls.standard)}-${cls.section}-${cls.year}`);

  async function doRestore(text: string, password?: string) {
    setErr('');
    try {
      const parsed = await parseBackup(text, password);
      if (parsed.kind !== 'class') throw new BackupError('ही संपूर्ण (सर्व वर्ग) बॅकअप फाइल आहे — ती मुख्याध्यापक खात्यातून पुनर्संचयित करा.');
      const bk = parsed as ClassBackup;
      const ok = await confirm({
        title: 'डेटा पुनर्संचयित करा',
        message: `या बॅकअपमध्ये ${bk.students?.length ?? 0} विद्यार्थी आहेत (सन ${bk.year}, ${new Date(bk.exportedAt).toLocaleString('mr-IN')}). सध्याची या वर्गाची सर्व माहिती बदलून बॅकअपमधील माहिती येईल. पुढे जायचे का?`,
        confirmLabel: 'पुनर्संचयित करा',
        danger: true,
      });
      if (!ok) return;
      const r = await track(restoreClass(scope, bk));
      setNeedPw(null);
      setRestorePw('');
      toast(`${r.students} विद्यार्थ्यांची माहिती पुनर्संचयित झाली.`);
    } catch (e) {
      if (e instanceof BackupError && e.message === 'PASSWORD_REQUIRED') {
        setNeedPw(text);
        return;
      }
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="grid gap-4">
      <Panel title="डेटा बॅकअप">
        <p className="mb-3 text-[15px] text-muted">
          सर्व माहिती फक्त या उपकरणावर असते. आठवड्यातून एकदा बॅकअप फाइल डाउनलोड करून Google Drive / ईमेल / पेनड्राइव्हमध्ये ठेवा. शेवटचा बॅकअप:{' '}
          <b className="text-text">{last?.value ? new Date(last.value as number).toLocaleString('mr-IN') : 'कधीच नाही'}</b>
        </p>
        {canEncrypt() ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Checkbox label="बॅकअप पासवर्डने सुरक्षित करा" hint="विद्यार्थ्यांची माहिती संवेदनशील आहे. पासवर्ड विसरल्यास बॅकअप उघडता येणार नाही." checked={usePw} onChange={setUsePw} />
            {usePw ? <TextField label="बॅकअप पासवर्ड" type="password" value={pw} onChange={setPw} autoComplete="new-password" /> : null}
          </div>
        ) : null}
        <Button
          variant="primary"
          icon="download"
          onClick={async () => {
            if (usePw && pw.length < 4) return toast('बॅकअप पासवर्ड किमान 4 अक्षरांचा ठेवा.', 'error');
            const text = await serializeBackup(await exportClass(scope), usePw ? pw : undefined);
            downloadText(text, backupFileName('class', label));
            await db.meta.put({ key: `lastBackup:${scope.classId}`, value: Date.now() });
            toast('बॅकअप फाइल डाउनलोड झाली.');
          }}
        >
          बॅकअप डाउनलोड करा (.json)
        </Button>
      </Panel>

      <Panel title="डेटा पुनर्संचयित करा">
        <p className="mb-3 text-[14.5px] text-muted">याच वर्गाची (इयत्ता {standardLabel(cls.standard)}) बॅकअप फाइल निवडा. दुसऱ्या इयत्तेचा बॅकअप येथे स्वीकारला जात नाही.</p>
        <label className="btn btn-secondary cursor-pointer">
          <Icon name="upload" />
          बॅकअप फाइल निवडा
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await doRestore(await readFileText(f));
              } catch (x) {
                setErr(x instanceof Error ? x.message : String(x));
              }
            }}
          />
        </label>
        {needPw !== null ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <TextField label="हा बॅकअप पासवर्डने सुरक्षित आहे — पासवर्ड भरा" type="password" value={restorePw} onChange={setRestorePw} className="min-w-[240px] flex-1" />
            <Button variant="primary" onClick={() => void doRestore(needPw, restorePw)}>
              उघडा
            </Button>
          </div>
        ) : null}
        {err ? (
          <div className="mt-3">
            <Notice kind="error">{err}</Notice>
          </div>
        ) : null}
      </Panel>

      <Panel title="Excel / CSV निर्यात व आयात">
        <div className="flex flex-wrap gap-2">
          <Button
            icon="download"
            disabled={!b}
            onClick={() =>
              b &&
              downloadBytes(toXlsx([{ name: 'विद्यार्थी', rows: studentsToRows(b.allStudents), widths: COLUMN_WIDTHS }]), `${label}-vidyarthi.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            }
          >
            विद्यार्थी (Excel)
          </Button>
          <Button icon="download" disabled={!b} onClick={() => b && downloadText(toCsv(studentsToRows(b.allStudents)), `${label}-vidyarthi.csv`, 'text/csv')}>
            विद्यार्थी (CSV)
          </Button>
          <Button
            icon="download"
            disabled={!b}
            onClick={() => b && downloadBytes(toXlsx(marksWorkbook(cfg, b.students, b.results, b.idx)), `${label}-gun.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
          >
            गुण (Excel)
          </Button>
          <LinkButton to="/students/import" icon="upload">
            विद्यार्थी आयात करा
          </LinkButton>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function AccountSection() {
  const { user, cls } = useTeacher();
  const { meta } = useSession();
  return (
    <div className="grid gap-4">
      <Panel title="माझे खाते">
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
          <dt className="text-muted">वापरकर्ता नाव</dt>
          <dd className="font-semibold">{user.username}</dd>
          <dt className="text-muted">वर्ग</dt>
          <dd>
            इयत्ता {standardLabel(cls.standard)}, तुकडी {cls.section}
          </dd>
          <dt className="text-muted">सन</dt>
          <dd>
            {cls.year} {meta.years.length > 1 ? <span className="text-muted">(दुसरे वर्ष निवडण्यासाठी बाहेर पडून पुन्हा लॉगिन करा)</span> : null}
          </dd>
        </dl>
        <h3 className="mb-2 font-semibold text-ink-deep">पासवर्ड बदला</h3>
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function AppSection() {
  const { scope } = useTeacher();
  const b = useClassBundle();
  const pwa = usePwa();
  const { toast, confirm } = useFeedback();
  const [info, setInfo] = useState<{ persisted: boolean; usage: number; quota: number } | null>(null);
  useEffect(() => {
    void storageInfo().then(setInfo);
  }, []);
  const demoCount = b?.allStudents.filter((s) => s.demo).length ?? 0;
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  return (
    <div className="grid gap-4">
      <Panel title="ऑफलाइन वापर">
        <InstallHint />
        {pwa.canInstall ? (
          <div className="mt-3">
            <Button variant="primary" icon="install" onClick={() => void promptInstall()}>
              ॲप स्थापित करा
            </Button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-1 text-[15px]">
          <div>
            साठवण: {info ? `${mb(info.usage)} वापरले` : '…'} {info?.quota ? `(उपलब्ध ${mb(info.quota)})` : ''}
          </div>
          <div>
            कायमस्वरूपी साठवण:{' '}
            {info?.persisted ? (
              <b className="text-leaf">सुरू आहे ✓</b>
            ) : (
              <>
                <b className="text-turmeric">नाही</b>{' '}
                <Button
                  size="sm"
                  onClick={async () => {
                    const ok = await requestPersistentStorage();
                    setInfo(await storageInfo());
                    toast(ok ? 'कायमस्वरूपी साठवण सुरू झाली.' : 'ब्राउझरने परवानगी दिली नाही — ॲप स्थापित करून पुन्हा प्रयत्न करा.', ok ? 'ok' : 'info');
                  }}
                >
                  सुरू करा
                </Button>
              </>
            )}
          </div>
          <div className="text-[13.5px] text-muted">आवृत्ती {APP_VERSION}</div>
        </div>
      </Panel>
      <Panel title="नमुना (डेमो) माहिती">
        <p className="mb-3 text-[14.5px] text-muted">चाचणीसाठी 10 काल्पनिक विद्यार्थी, गुण, नोंदी व उपस्थिती. सध्या नमुना विद्यार्थी: {demoCount}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            icon="plus"
            onClick={async () => {
              const n = await track(seedDemo(scope));
              toast(`${n} नमुना विद्यार्थी जोडले.`);
            }}
          >
            नमुना माहिती जोडा
          </Button>
          <Button
            variant="danger-ghost"
            icon="trash"
            disabled={!demoCount}
            onClick={async () => {
              if (await confirm({ title: 'नमुना माहिती काढा', message: `${demoCount} नमुना विद्यार्थी व त्यांचे गुण, नोंदी, उपस्थिती काढली जाईल. तुम्ही भरलेली खरी माहिती तशीच राहील.`, confirmLabel: 'काढा', danger: true })) {
                const n = await track(repo.removeDemoData(scope));
                toast(`${n} नमुना विद्यार्थी काढले.`);
              }
            }}
          >
            नमुना माहिती काढा
          </Button>
        </div>
      </Panel>
      <Panel title="धोकादायक क्रिया">
        <p className="mb-3 text-[14.5px] text-muted">या वर्गातील सर्व विद्यार्थी, गुण, नोंदी, उपस्थिती व दाखले कायमचे पुसले जातील. आधी बॅकअप घ्या.</p>
        <Button
          variant="danger"
          icon="trash"
          onClick={async () => {
            if (!(await confirm({ title: 'वर्गाची सर्व माहिती पुसा', message: 'खात्री आहे? ही क्रिया परत घेता येणार नाही.', confirmLabel: 'होय, सर्व पुसा', danger: true }))) return;
            await track(repo.clearClassData(scope));
            toast('वर्गाची सर्व माहिती पुसली.');
          }}
        >
          वर्गाची सर्व माहिती पुसा
        </Button>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const SECTION_COMPONENTS: Record<string, () => ReactNode> = {
  class: () => <ClassSection />,
  subjects: () => <SubjectsSection />,
  weights: () => <WeightsSection />,
  grades: () => <GradesSection />,
  result: () => <ResultSection />,
  report: () => <ReportSection />,
  backup: () => <BackupSection />,
  account: () => <AccountSection />,
  app: () => <AppSection />,
};

export default function SettingsPage() {
  const { section } = useParams();
  const { cfg } = useTeacher();
  if (section === 'remarks') {
    return (
      <div>
        <PageHeader title="वर्णनात्मक नोंद संच" back="/settings" />
        <LinkButton to="/remarks/library" variant="primary" icon="book">
          नोंद संच उघडा
        </LinkButton>
      </div>
    );
  }
  const meta = SECTIONS_LIST.find((s) => s.key === section);
  if (section && meta && SECTION_COMPONENTS[section]) {
    return (
      <div>
        <PageHeader title={meta.title} back="/settings" />
        {SECTION_COMPONENTS[section]()}
      </div>
    );
  }
  const mismatch = cfg.subjects.filter((s) => {
    const w = cfg.weights['1']?.[s.id];
    return sumTools(cfg.fTools, w?.F, undefined).max + sumTools(cfg.sParts, w?.S, undefined).max !== 100;
  });
  return (
    <div>
      <PageHeader title="सेटिंग्ज" subtitle="या वर्गाचे विषय, भारांश, श्रेणी व निकाल नियम, अहवाल आणि बॅकअप" />
      {mismatch.length ? (
        <div className="mb-4">
          <Notice kind="warn">
            {mismatch.map((s) => s.name).join(', ')} — एकूण कमाल गुण 100 नाहीत.{' '}
            <Link to="/settings/weights" className="font-semibold underline">
              भारांश तपासा
            </Link>
          </Notice>
        </div>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS_LIST.map((s) => (
          <li key={s.key}>
            <Link to={s.key === 'remarks' ? '/remarks/library' : `/settings/${s.key}`} className="panel flex h-full items-start gap-3 p-4 hover:border-ink">
              <span className="rounded-lg bg-ink-soft p-2 text-ink">
                <Icon name={s.icon} size={22} />
              </span>
              <span>
                <span className="block text-[16px] font-semibold text-ink-deep">{s.title}</span>
                <span className="mt-0.5 block text-[13.5px] text-muted">{s.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
