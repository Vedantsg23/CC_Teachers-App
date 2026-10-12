import { useMemo, useState } from 'react';
import { useLibrary } from '../../app/data';
import { useTeacher } from '../../app/session';
import { REMARK_CATEGORIES, REMARK_CATEGORY_LABEL } from '../../lib/labels';
import { toFeminine } from '../../lib/marathi';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { RemarkCategory, RemarkItem } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { AreaField, Button, InlineSelect, Modal, PageHeader, Panel } from '../../components/ui';

export default function RemarkLibraryPage() {
  const { scope } = useTeacher();
  const items = useLibrary();
  const { toast, confirm } = useFeedback();
  const [cat, setCat] = useState<RemarkCategory>('marathi');
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [textF, setTextF] = useState('');
  const [fTouched, setFTouched] = useState(false);
  const [editing, setEditing] = useState<RemarkItem | null>(null);

  const list = useMemo(() => (items ?? []).filter((i) => i.category === cat && (!q.trim() || i.text.includes(q.trim()) || i.textF.includes(q.trim()))), [items, cat, q]);
  const counts = useMemo(() => {
    const m = new Map<RemarkCategory, number>();
    for (const i of items ?? []) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);
  if (!items) return null;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="वर्णनात्मक नोंद संच"
        back="/remarks"
        subtitle="ड्रॉपडाऊनमध्ये दिसणाऱ्या तयार नोंदी. मुलगा व मुलगी यांच्यासाठी वेगळी रूपे ठेवता येतात."
        actions={
          <Button
            size="sm"
            variant="danger-ghost"
            icon="refresh"
            onClick={async () => {
              if (await confirm({ title: 'मूळ संच पुन्हा आणा', message: 'तुम्ही जोडलेल्या सर्व नोंदी काढल्या जाऊन मूळ तयार नोंदी पुन्हा येतील. विद्यार्थ्यांच्या नोंदींवर परिणाम होणार नाही.', confirmLabel: 'पुन्हा आणा', danger: true })) {
                await track(repo.resetLibrary(scope));
                toast('मूळ नोंद संच पुन्हा आणला.');
              }
            }}
          >
            मूळ संच पुन्हा आणा
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav className="panel hidden p-2 lg:block" aria-label="नोंद प्रकार">
          {REMARK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-current={c === cat ? 'true' : undefined}
              className={`flex min-h-[42px] w-full items-center justify-between rounded-lg px-3 text-left text-[15px] ${c === cat ? 'bg-ink-soft font-semibold text-ink-deep' : 'hover:bg-[#f2f5f9]'}`}
            >
              {REMARK_CATEGORY_LABEL[c]}
              <span className="tabular text-[13px] text-muted">{counts.get(c) ?? 0}</span>
            </button>
          ))}
        </nav>
        <div className="grid gap-4">
          <div className="panel grid gap-3 p-3 md:grid-cols-2">
            <InlineSelect className="lg:hidden" label="नोंद प्रकार" value={cat} onChange={(v) => setCat(v as RemarkCategory)} options={REMARK_CATEGORIES.map((c) => ({ value: c, label: `${REMARK_CATEGORY_LABEL[c]} (${counts.get(c) ?? 0})` }))} />
            <label className="block md:col-span-2 lg:col-span-2">
              <span className="mb-1 block text-[13px] font-semibold text-muted">नोंद शोधा</span>
              <input className="field-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="शब्द लिहा…" />
            </label>
          </div>

          <Panel title={`नवीन नोंद — ${REMARK_CATEGORY_LABEL[cat]}`}>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!text.trim()) return;
                await track(repo.addRemarkItem(scope, cat, text, fTouched ? textF : undefined));
                setText('');
                setTextF('');
                setFTouched(false);
                toast('नोंद जोडली.');
              }}
            >
              <AreaField
                label="नोंद (मुलगा)"
                value={text}
                onChange={(v) => {
                  setText(v);
                  if (!fTouched) setTextF(toFeminine(v, cat));
                }}
                rows={2}
                required
              />
              <AreaField
                label="नोंद (मुलगी)"
                value={textF}
                onChange={(v) => {
                  setTextF(v);
                  setFTouched(true);
                }}
                rows={2}
                hint="आपोआप तयार होते — गरज असल्यास बदला."
              />
              <div className="md:col-span-2">
                <Button type="submit" variant="primary" icon="plus" disabled={!text.trim()}>
                  नोंद जोडा
                </Button>
              </div>
            </form>
          </Panel>

          <Panel title={`${REMARK_CATEGORY_LABEL[cat]} — ${list.length} नोंदी`}>
            {list.length === 0 ? (
              <p className="text-muted">या प्रकारात अजून नोंदी नाहीत.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {list.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px]">{i.text}</p>
                      {i.textF && i.textF !== i.text ? <p className="text-[14px] text-muted">मुलगी: {i.textF}</p> : null}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setEditing(i)} aria-label="नोंद संपादित करा">
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm !px-2"
                      aria-label="नोंद हटवा"
                      onClick={async () => {
                        if (await confirm({ title: 'नोंद हटवा', message: `“${i.text}” ही नोंद संचातून हटवायची का? विद्यार्थ्यांच्या आधी भरलेल्या नोंदी बदलणार नाहीत.`, confirmLabel: 'हटवा', danger: true })) {
                          await track(repo.deleteRemarkItem(scope, i.id));
                          toast('नोंद हटवली.');
                        }
                      }}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="नोंद संपादित करा"
        footer={
          <>
            <Button onClick={() => setEditing(null)}>रद्द करा</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editing || !editing.text.trim()) return;
                await track(repo.updateRemarkItem(scope, editing));
                setEditing(null);
                toast('नोंद जतन झाली.');
              }}
            >
              जतन करा
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-3">
            <InlineSelect label="नोंद प्रकार" value={editing.category} onChange={(v) => setEditing({ ...editing, category: v as RemarkCategory })} options={REMARK_CATEGORIES.map((c) => ({ value: c, label: REMARK_CATEGORY_LABEL[c] }))} />
            <AreaField label="नोंद (मुलगा)" value={editing.text} onChange={(v) => setEditing({ ...editing, text: v })} rows={2} />
            <AreaField label="नोंद (मुलगी)" value={editing.textF} onChange={(v) => setEditing({ ...editing, textF: v })} rows={2} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
