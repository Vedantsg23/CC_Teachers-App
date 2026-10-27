import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useSession } from '../../app/session';
import { adminCreateTeacher, adminResetPassword, adminUpdateTeacher } from '../../lib/auth';
import { backupFileName, BackupError, exportAll, parseBackup, restoreAll, serializeBackup, type FullBackup } from '../../lib/backup';
import { canEncrypt } from '../../lib/crypto';
import { db } from '../../lib/db';
import { defaultLcTemplate } from '../../lib/defaults';
import { isValidYear, nextYear, todayIso } from '../../lib/format';
import { SECTIONS, STANDARD_WORDS, standardLabel } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { downloadText, readFileText } from '../../lib/share';
import type { LcTemplate, School, User } from '../../lib/types';
import { validateUdise } from '../../lib/validation';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { ReportViewer } from '../../components/report/ReportViewer';
import { AreaField, Button, Checkbox, Modal, Notice, PageHeader, Panel, SelectField, TextField } from '../../components/ui';
import { LogoPicker } from '../../components/LogoPicker';
import { ChangePasswordForm } from '../auth/ChangePassword';
import { LeavingCertificatePage } from '../reports/templates/certificate';

function SchoolAdmin() {
  const { school, meta } = useSession();
  const { toast } = useFeedback();
  const [s, setS] = useState<School>(school);
  const [newYear, setNewYear] = useState(nextYear(meta.years[meta.years.length - 1] ?? meta.currentYear));
  useEffect(() => setS(school), [school]);
  const udiseErr = validateUdise(s.udise);
  const teachers = useLiveQuery(() => db.users.where('role').equals('teacher').count(), []);

  return (
    <div className="grid gap-4">
      <PageHeader title="प्रशासन" subtitle={`मुख्याध्यापक / प्रशासक — ${teachers ?? 0} शिक्षक खाती`} />
      <Notice>हे खाते शाळेची माहिती, शिक्षक खाती, पासवर्ड व संपूर्ण बॅकअपसाठी आहे. विद्यार्थ्यांचे गुण व नोंदी फक्त संबंधित वर्गशिक्षकच पाहू शकतात.</Notice>
      <Panel title="शाळेची माहिती">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="शाळेचे नाव" value={s.name} onChange={(v) => setS({ ...s, name: v })} className="sm:col-span-2" required />
          <TextField label="UDISE क्रमांक" value={s.udise} onChange={(v) => setS({ ...s, udise: v.replace(/\D/g, '') })} inputMode="numeric" maxLength={11} error={udiseErr ?? undefined} />
          <TextField label="व्यवस्थापन / संस्था" value={s.orgLine} onChange={(v) => setS({ ...s, orgLine: v })} placeholder="उदा. जिल्हा परिषद, पुणे" />
          <TextField label="तालुका" value={s.taluka} onChange={(v) => setS({ ...s, taluka: v })} />
          <TextField label="जिल्हा" value={s.district} onChange={(v) => setS({ ...s, district: v })} />
          <TextField label="केंद्र" value={s.centre} onChange={(v) => setS({ ...s, centre: v })} />
          <TextField label="बीट" value={s.beat ?? ''} onChange={(v) => setS({ ...s, beat: v })} />
          <TextField label="मुख्याध्यापकाचे नाव" value={s.headmaster} onChange={(v) => setS({ ...s, headmaster: v })} />
          <TextField label="केंद्रप्रमुख (नाव)" value={s.centreHead ?? ''} onChange={(v) => setS({ ...s, centreHead: v })} />
          <TextField label="विस्तार अधिकारी (नाव)" value={s.extOfficer ?? ''} onChange={(v) => setS({ ...s, extOfficer: v })} />
          <TextField label="गटशिक्षणाधिकारी (नाव)" value={s.blockOfficer ?? ''} onChange={(v) => setS({ ...s, blockOfficer: v })} />
          <TextField label="माध्यम" value={s.medium} onChange={(v) => setS({ ...s, medium: v })} />
          <TextField label="मान्यता क्रमांक" value={s.recognitionNo} onChange={(v) => setS({ ...s, recognitionNo: v })} />
          <TextField label="दूरध्वनी" value={s.phone} onChange={(v) => setS({ ...s, phone: v })} inputMode="tel" />
          <TextField label="ईमेल" value={s.email} onChange={(v) => setS({ ...s, email: v })} type="email" />
          <TextField label="शाळेचा पत्ता" value={s.address} onChange={(v) => setS({ ...s, address: v })} className="sm:col-span-2" />
          <LogoPicker school={s} onChange={setS} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
      <Panel title="शैक्षणिक वर्ष">
        <p className="mb-3 text-[15px]">
          सध्याचे वर्ष: <b>{meta.currentYear}</b> — उपलब्ध: {meta.years.join(', ')}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="डीफॉल्ट वर्ष"
            value={meta.currentYear}
            onChange={async (v) => {
              await track(repo.saveMeta({ ...meta, currentYear: v }));
              toast(`डीफॉल्ट वर्ष ${v} केले.`);
            }}
            options={meta.years.map((y) => ({ value: y, label: y }))}
          />
          <TextField label="नवीन वर्ष जोडा" value={newYear} onChange={setNewYear} placeholder="2027-28" />
          <Button
            icon="plus"
            onClick={async () => {
              if (!isValidYear(newYear)) return toast('वर्ष 2027-28 या स्वरूपात लिहा.', 'error');
              if (meta.years.includes(newYear)) return toast('हे वर्ष आधीच आहे.', 'error');
              await track(repo.saveMeta({ ...meta, years: [...meta.years, newYear].sort() }));
              toast(`${newYear} जोडले. शिक्षक लॉगिन करताना हे वर्ष निवडू शकतील; नवीन वर्षाचा वर्ग आपोआप तयार होईल.`);
            }}
          >
            जोडा
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function TeachersAdmin() {
  const { user } = useSession();
  const { toast } = useFeedback();
  const users = useLiveQuery(() => repo.listUsers(), []);
  const [form, setForm] = useState({ username: '', displayName: '', standard: '6', section: 'अ', password: '' });
  const [reset, setReset] = useState<User | null>(null);
  const [newPw, setNewPw] = useState('');
  const [edit, setEdit] = useState<User | null>(null);
  if (!users || !user) return null;
  const teachers = users.filter((u) => u.role === 'teacher');

  return (
    <div className="grid gap-4">
      <PageHeader title="शिक्षक खाती" subtitle="प्रत्येक शिक्षक फक्त स्वतःच्या वर्गाची माहिती पाहू व बदलू शकतो." />
      <div className="panel scroll-x">
        <table className="grid-table min-w-[720px]">
          <thead>
            <tr>
              <th className="!text-left">वर्गशिक्षक</th>
              <th>वापरकर्ता नाव</th>
              <th>इयत्ता</th>
              <th>तुकडी</th>
              <th>स्थिती</th>
              <th>शेवटचे लॉगिन</th>
              <th>कृती</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td className="!text-left font-semibold">{t.displayName}</td>
                <td>
                  <code>{t.username}</code>
                </td>
                <td>{standardLabel(t.standard)}</td>
                <td>{t.section}</td>
                <td>{t.active ? <span className="text-leaf">सुरू</span> : <span className="text-margin">बंद</span>}</td>
                <td className="tabular text-[13.5px] text-muted">{t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString('mr-IN') : '—'}</td>
                <td>
                  <div className="flex justify-center gap-1">
                    <Button size="sm" variant="ghost" icon="key" onClick={() => { setReset(t); setNewPw(''); }}>
                      पासवर्ड
                    </Button>
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEdit(t)} aria-label="संपादित करा" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel title="नवीन शिक्षक खाते">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await track(adminCreateTeacher(user.id, { ...form, username: form.username.trim().toLowerCase(), standard: Number(form.standard) }));
              toast('शिक्षक खाते तयार झाले. पहिल्या लॉगिननंतर शिक्षकाला पासवर्ड बदलावा लागेल.');
              setForm({ username: '', displayName: '', standard: '6', section: 'अ', password: '' });
            } catch (x) {
              toast(x instanceof Error ? x.message : String(x), 'error');
            }
          }}
        >
          <TextField label="वर्गशिक्षकाचे नाव" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} required />
          <TextField label="वापरकर्ता नाव" value={form.username} onChange={(v) => setForm({ ...form, username: v.toLowerCase().trim() })} required hint="उदा. teacher6" />
          <TextField label="तात्पुरता पासवर्ड" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required autoComplete="new-password" />
          <SelectField label="इयत्ता" value={form.standard} onChange={(v) => setForm({ ...form, standard: v })} options={Object.entries(STANDARD_WORDS).slice(0, 8).map(([k, w]) => ({ value: k, label: w }))} />
          <SelectField label="तुकडी" value={form.section} onChange={(v) => setForm({ ...form, section: v })} options={SECTIONS.map((x) => ({ value: x, label: x }))} />
          <div className="self-end">
            <Button type="submit" variant="primary" icon="plus" disabled={!form.displayName.trim() || !form.username || !form.password}>
              खाते तयार करा
            </Button>
          </div>
        </form>
      </Panel>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title={`पासवर्ड बदला — ${reset?.displayName ?? ''}`}
        footer={
          <>
            <Button onClick={() => setReset(null)}>रद्द करा</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!reset) return;
                try {
                  await track(adminResetPassword(user.id, reset.id, newPw));
                  toast('नवीन पासवर्ड ठेवला. शिक्षकाला पुढच्या लॉगिनला तो बदलावा लागेल.');
                  setReset(null);
                } catch (x) {
                  toast(x instanceof Error ? x.message : String(x), 'error');
                }
              }}
            >
              जतन करा
            </Button>
          </>
        }
      >
        <TextField label="नवीन तात्पुरता पासवर्ड" type="password" value={newPw} onChange={setNewPw} autoComplete="new-password" hint="किमान 6 अक्षरे. जुना पासवर्ड दाखवला जात नाही." />
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="खाते संपादित करा"
        footer={
          <>
            <Button onClick={() => setEdit(null)}>रद्द करा</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!edit) return;
                await track(adminUpdateTeacher(user.id, edit.id, { displayName: edit.displayName.trim(), section: edit.section, active: edit.active }));
                toast('खाते जतन झाले.');
                setEdit(null);
              }}
            >
              जतन करा
            </Button>
          </>
        }
      >
        {edit ? (
          <div className="grid gap-3">
            <TextField label="वर्गशिक्षकाचे नाव" value={edit.displayName} onChange={(v) => setEdit({ ...edit, displayName: v })} />
            <SelectField label="तुकडी" value={edit.section} onChange={(v) => setEdit({ ...edit, section: v })} options={[...new Set([...SECTIONS, edit.section])].map((x) => ({ value: x, label: x }))} />
            <Checkbox label="खाते सुरू आहे" hint="बंद केल्यास शिक्षक लॉगिन करू शकणार नाही; वर्गाची माहिती सुरक्षित राहील." checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

const SAMPLE: Record<string, string> = {
  issueDate: todayIso(),
  regNo: '5123',
  pen: '27250000001',
  aadhaar: '',
  apaar: '',
  email: '',
  fullName: 'नमुना विद्यार्थी नाव',
  firstName: 'नमुना',
  fatherFirst: 'वडिलांचे नाव',
  surname: 'आडनाव',
  motherName: 'नमुना आईचे नाव',
  fatherName: 'नमुना वडिलांचे नाव',
  nationality: 'भारतीय',
  motherTongue: 'मराठी',
  religion: 'हिंदू',
  caste: '',
  subCaste: '',
  category: '',
  birthPlace: 'पुणे',
  birthTaluka: 'हवेली',
  birthDistrict: 'पुणे',
  birthState: 'महाराष्ट्र',
  birthCountry: 'भारत',
  dob: '2013-11-28',
  dobWords: 'अठ्ठावीस नोव्हेंबर दोन हजार तेरा',
  previousSchool: '',
  admissionDate: '2020-06-15',
  admissionStd: 'पहिली',
  currentStd: 'सातवी',
  lastStd: 'इयत्ता सातवी (7 वी) — जून 2026 पासून',
  progress: 'चांगली',
  conduct: 'चांगली',
  leftDate: todayIso(),
  lastAttended: todayIso(),
  reason: 'पुढील शिक्षणासाठी',
  remark: '',
};

function CertificateAdmin() {
  const { school } = useSession();
  const { toast } = useFeedback();
  const saved = useLiveQuery(() => repo.getLcTemplate(), []);
  const [t, setT] = useState<LcTemplate | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (saved && !t) setT(saved);
  }, [saved, t]);
  if (!t) return null;
  const move = (i: number, d: number) => {
    const f = [...t.fields];
    const [x] = f.splice(i, 1);
    f.splice(i + d, 0, x);
    setT({ ...t, fields: f });
  };
  return (
    <div className="grid gap-4">
      <PageHeader title="शाळा सोडल्याचा दाखला — नमुना" subtitle="सर्व वर्गांच्या दाखल्यांसाठी एकच नमुना" />
      <Panel title="दाखल्याचा प्रकार">
        <div className="grid gap-4">
          <SelectField
            label="नमुना"
            value={t.layout === 'list' ? 'list' : 'zp'}
            onChange={(v) => setT({ ...t, layout: v === 'list' ? 'list' : 'zp' })}
            options={[
              { value: 'zp', label: 'जिल्हा परिषद नमुना — शाळा सोडल्याचे प्रमाणपत्र (छापील दाखल्याप्रमाणे)' },
              { value: 'list', label: 'साधा नमुना — रकाने, क्रम व मजकूर बदलता येतात' },
            ]}
          />
          {t.layout !== 'list' ? (
            <AreaField label="शेवटचे वाक्य" value={t.zpCertText ?? ''} onChange={(v) => setT({ ...t, zpCertText: v })} rows={2} hint="उदा. दाखला देण्यात येतो की, वरील माहिती शाळेतील जनरल रजिस्टर नं. १ प्रमाणे आहे." />
          ) : null}
        </div>
      </Panel>
      {t.layout === 'list' ? (
        <>
          <Notice kind="warn">हा दाखला शाळेच्या नोंदींवरून तयार होणारा नमुना आहे. तुमच्या शाळेसाठी शासनाचा/मंडळाचा अधिकृत नमुना असल्यास त्याप्रमाणे शीर्षक, रकाने, क्रम व मजकूर येथे बदला.</Notice>
          <Panel title="शीर्षक व मजकूर">
            <div className="grid gap-4">
              <TextField label="शीर्षक" value={t.title} onChange={(v) => setT({ ...t, title: v })} />
              <TextField label="शीर्षकाखालील सूचना" value={t.headerNote} onChange={(v) => setT({ ...t, headerNote: v })} />
              <AreaField label="प्रमाणपत्राचा मजकूर" value={t.certText} onChange={(v) => setT({ ...t, certText: v })} rows={3} hint="{regNo} सारखे रकाने आपोआप भरले जातात." />
              <div className="grid gap-3 sm:grid-cols-3">
                {t.signLabels.map((l, i) => (
                  <TextField key={i} label={`स्वाक्षरी ${i + 1}`} value={l} onChange={(v) => setT({ ...t, signLabels: t.signLabels.map((x, j) => (j === i ? v : x)) })} />
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="रकाने (क्रम व नावे)">
            <ul className="divide-y divide-rule">
              {t.fields.map((f, i) => (
                <li key={f.key} className="flex flex-wrap items-center gap-2 py-2">
                  <input type="checkbox" className="h-5 w-5 accent-[#1e3a6e]" checked={f.enabled} aria-label={`${f.label} दाखवा`} onChange={(e) => setT({ ...t, fields: t.fields.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) })} />
                  <input className="field-input min-w-0 flex-1 !min-h-[40px]" value={f.label} aria-label="रकान्याचे नाव" onChange={(e) => setT({ ...t, fields: t.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="वर">
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === t.fields.length - 1} onClick={() => move(i, 1)} aria-label="खाली">
                    ↓
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : (
        <Notice>जिल्हा परिषदेच्या छापील दाखल्याप्रमाणे सर्व रकाने येतात आणि विद्यार्थ्याच्या माहितीवरून (आधार, अपार, पेन, जन्मस्थळ इ.) आपोआप भरतात. दाखला तयार करताना प्रत्येक रकाना बदलता येतो.</Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon="check"
          onClick={async () => {
            await track(repo.saveLcTemplate(t));
            toast('दाखल्याचा नमुना जतन झाला.');
          }}
        >
          जतन करा
        </Button>
        <Button icon="eye" onClick={() => setPreview(true)}>
          पूर्वदृश्य
        </Button>
        <Button variant="ghost" icon="refresh" onClick={() => setT(defaultLcTemplate())}>
          मूळ नमुना भरा
        </Button>
      </div>
      {preview ? (
        <ReportViewer title="दाखला — नमुना पूर्वदृश्य" fileName="dakhla-namuna.pdf" orientation="portrait" onClose={() => setPreview(false)} showPageNumbers={false}>
          <LeavingCertificatePage school={school} tpl={t} data={SAMPLE} />
        </ReportViewer>
      ) : null}
    </div>
  );
}

function BackupAdmin() {
  const { signOut } = useSession();
  const { toast, confirm } = useFeedback();
  const [pw, setPw] = useState('');
  const [usePw, setUsePw] = useState(false);
  const [needPw, setNeedPw] = useState<string | null>(null);
  const [rpw, setRpw] = useState('');
  const [err, setErr] = useState('');

  async function doRestore(text: string, password?: string) {
    setErr('');
    try {
      const parsed = await parseBackup(text, password);
      if (parsed.kind !== 'full') throw new BackupError('ही एका वर्गाची बॅकअप फाइल आहे — ती संबंधित शिक्षकाच्या खात्यातून पुनर्संचयित करा.');
      const bk = parsed as FullBackup;
      const ok = await confirm({
        title: 'संपूर्ण माहिती पुनर्संचयित करा',
        message: `या उपकरणावरील सर्व माहिती (सर्व वर्ग, खाती) बदलून बॅकअपमधील माहिती येईल (${bk.students?.length ?? 0} विद्यार्थी). त्यानंतर पुन्हा लॉगिन करावे लागेल. पुढे जायचे का?`,
        confirmLabel: 'पुनर्संचयित करा',
        danger: true,
      });
      if (!ok) return;
      const r = await restoreAll(bk);
      toast(`${r.classes} वर्ग व ${r.students} विद्यार्थ्यांची माहिती पुनर्संचयित झाली. पुन्हा लॉगिन करा.`);
      setTimeout(() => void signOut(), 1200);
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
      <PageHeader title="संपूर्ण डेटा बॅकअप" subtitle="सर्व वर्ग, शिक्षक खाती व शाळेची माहिती — नवीन उपकरणावर हलवण्यासाठी" />
      <Panel title="बॅकअप डाउनलोड करा">
        {canEncrypt() ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Checkbox label="पासवर्डने सुरक्षित करा (शिफारस)" checked={usePw} onChange={setUsePw} />
            {usePw ? <TextField label="बॅकअप पासवर्ड" type="password" value={pw} onChange={setPw} autoComplete="new-password" /> : null}
          </div>
        ) : null}
        <Button
          variant="primary"
          icon="download"
          onClick={async () => {
            if (usePw && pw.length < 4) return toast('बॅकअप पासवर्ड किमान 4 अक्षरांचा ठेवा.', 'error');
            downloadText(await serializeBackup(await exportAll(), usePw ? pw : undefined), backupFileName('full', ''));
            toast('संपूर्ण बॅकअप डाउनलोड झाला.');
          }}
        >
          संपूर्ण बॅकअप (.json)
        </Button>
        <p className="mt-2 text-[13.5px] text-muted">या फाइलमध्ये खात्यांचे पासवर्ड हॅश (मूळ पासवर्ड नव्हे) असतात. फाइल सुरक्षित ठिकाणी ठेवा.</p>
      </Panel>
      <Panel title="संपूर्ण माहिती पुनर्संचयित करा">
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
              if (f) await doRestore(await readFileText(f));
            }}
          />
        </label>
        {needPw !== null ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <TextField label="बॅकअप पासवर्ड" type="password" value={rpw} onChange={setRpw} className="min-w-[220px] flex-1" />
            <Button variant="primary" onClick={() => void doRestore(needPw, rpw)}>
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
    </div>
  );
}

export default function AdminPages({ section }: { section: 'school' | 'teachers' | 'certificate' | 'backup' | 'account' }) {
  if (section === 'teachers') return <TeachersAdmin />;
  if (section === 'certificate') return <CertificateAdmin />;
  if (section === 'backup') return <BackupAdmin />;
  if (section === 'account')
    return (
      <div>
        <PageHeader title="माझे खाते" subtitle="मुख्याध्यापक / प्रशासक (admin)" />
        <Panel title="पासवर्ड बदला">
          <ChangePasswordForm />
        </Panel>
      </div>
    );
  return <SchoolAdmin />;
}
