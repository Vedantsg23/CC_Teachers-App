import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStudents } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate } from '../../lib/format';
import { GENDER_LABEL } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { downloadBytes, downloadText } from '../../lib/share';
import { readTable, toCsv, toXlsx } from '../../lib/sheet';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { Button, Notice, PageHeader, Panel } from '../../components/ui';
import { COLUMN_WIDTHS, COLUMNS, rowsToStudents, type ImportRow } from './studentSheet';

const SAMPLE = [
  COLUMNS.map((c) => c.header),
  [1, 'आरव संजय पाटील', 'मुलगा', '15-08-2014', '4201', '', '', 'सुनीता पाटील', 'संजय पाटील', 'संजय पाटील', '', 'OBC', 'हिंदू', '9800000001', 'मु. पो. …', '15-06-2020', 'पुणे', ''],
];

export default function ImportStudents() {
  const { scope } = useTeacher();
  const existing = useStudents(true);
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const valid = rows?.filter((r) => !r.errors.length) ?? [];
  const regs = new Set((existing ?? []).map((s) => s.regNo).filter(Boolean));
  const dupRegs = valid.filter((r) => r.student.regNo && regs.has(r.student.regNo)).length;

  return (
    <div className="grid gap-4">
      <PageHeader title="विद्यार्थी यादी आयात करा" back="/students" subtitle="Excel (.xlsx) किंवा CSV फाइलमधून एकाच वेळी अनेक विद्यार्थी जोडा." />

      <Panel title="1. नमुना फाइल">
        <p className="mb-3 text-[15px] text-muted">नमुना फाइल उघडून त्याच रकान्यांमध्ये माहिती भरा. पहिली ओळ रकान्यांची नावे असावी. नाव व लिंग आवश्यक आहेत; जन्मतारीख DD-MM-YYYY स्वरूपात लिहा.</p>
        <div className="flex flex-wrap gap-2">
          <Button icon="download" onClick={() => downloadBytes(toXlsx([{ name: 'विद्यार्थी', rows: SAMPLE, widths: COLUMN_WIDTHS }]), 'CCE-vidyarthi-namuna.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>
            नमुना Excel फाइल
          </Button>
          <Button icon="download" onClick={() => downloadText(toCsv(SAMPLE), 'CCE-vidyarthi-namuna.csv', 'text/csv')}>
            नमुना CSV फाइल
          </Button>
        </div>
      </Panel>

      <Panel title="2. फाइल निवडा">
        <label className="btn btn-primary cursor-pointer">
          <Icon name="upload" />
          फाइल निवडा (.xlsx / .csv)
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setError('');
              setRows(null);
              setFileName(f.name);
              try {
                const table = await readTable(f);
                const res = rowsToStudents(table, scope.classId);
                if (!res.mapped || !res.rows.length) throw new Error('फाइलमधील रकाने ओळखता आले नाहीत. नमुना फाइल वापरा.');
                setRows(res.rows);
                setUnknown(res.unknownHeaders);
              } catch (x) {
                setError(x instanceof Error ? x.message : String(x));
              }
            }}
          />
        </label>
        {fileName ? <p className="mt-2 text-[14px] text-muted">{fileName}</p> : null}
        {error ? (
          <div className="mt-3">
            <Notice kind="error">{error}</Notice>
          </div>
        ) : null}
      </Panel>

      {rows ? (
        <Panel title={`3. तपासा — ${valid.length} विद्यार्थी आयात होतील`}>
          {unknown.length ? (
            <div className="mb-3">
              <Notice kind="warn">हे रकाने ओळखले नाहीत व सोडले जातील: {unknown.join(', ')}</Notice>
            </div>
          ) : null}
          {dupRegs ? (
            <div className="mb-3">
              <Notice kind="warn">{dupRegs} विद्यार्थ्यांचे रजिस्टर क्रमांक आधीपासून वर्गात आहेत. पुन्हा आयात करत नाही ना, ते तपासा.</Notice>
            </div>
          ) : null}
          <div className="scroll-x max-h-[60vh] overflow-y-auto rounded-lg border border-rule">
            <table className="grid-table min-w-[720px]">
              <thead>
                <tr>
                  <th>ओळ</th>
                  <th>हजेरी क्र.</th>
                  <th className="!text-left">विद्यार्थ्याचे नाव</th>
                  <th>लिंग</th>
                  <th>जन्मतारीख</th>
                  <th>रजि. क्र.</th>
                  <th className="!text-left">स्थिती</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.errors.length ? 'bg-margin-soft' : ''}>
                    <td className="tabular text-muted">{r.line}</td>
                    <td className="tabular">{r.student.rollNo ?? ''}</td>
                    <td className="!text-left">{r.student.fullName}</td>
                    <td>{GENDER_LABEL[r.student.gender]}</td>
                    <td className="tabular">{fmtDate(r.student.dob)}</td>
                    <td className="tabular">{r.student.regNo}</td>
                    <td className="!text-left text-[14px]">{r.errors.length ? <span className="text-margin">{r.errors.join(', ')}</span> : <span className="text-leaf">ठीक</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon="check"
              disabled={!valid.length}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const n = await track(repo.bulkAddStudents(scope, valid.map((r) => r.student)));
                  toast(`${n} विद्यार्थी आयात झाले.`);
                  nav('/students');
                } catch (x) {
                  toast(x instanceof Error ? x.message : 'आयात करताना अडचण आली.', 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {valid.length} विद्यार्थी आयात करा
            </Button>
            <Button variant="ghost" onClick={() => setRows(null)}>
              रद्द करा
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
