import { useLiveQuery } from 'dexie-react-hooks';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate } from '../../lib/format';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { EmptyState, LinkButton, Notice, PageHeader } from '../../components/ui';
import { Link } from 'react-router';

export default function CertificatesPage() {
  const { scope } = useTeacher();
  const b = useClassBundle();
  const list = useLiveQuery(() => repo.listCertificates(scope), [scope.classId]);
  const { confirm, toast } = useFeedback();
  if (!b || !list) return null;
  const nameOf = (id: string) => b.allStudents.find((s) => s.id === id)?.fullName ?? '—';

  return (
    <div className="grid gap-4">
      <PageHeader
        title="शाळा सोडल्याचा दाखला"
        subtitle="दिलेल्या दाखल्यांची नोंदवही"
        actions={
          <LinkButton to="/certificates/new" variant="primary" icon="plus">
            नवीन दाखला
          </LinkButton>
        }
      />
      <Notice>हा दाखला शाळेच्या नोंदींवरून तयार होतो. तुमच्या शाळेचा अधिकृत नमुना वेगळा असल्यास मुख्याध्यापक “दाखला नमुना” मधून शीर्षक, रकाने व मजकूर बदलू शकतात.</Notice>
      {list.length === 0 ? (
        <EmptyState icon="certificate" title="अजून एकही दाखला दिलेला नाही." action={<LinkButton to="/certificates/new" variant="primary" icon="plus">नवीन दाखला</LinkButton>} />
      ) : (
        <div className="panel scroll-x">
          <table className="grid-table min-w-[620px]">
            <thead>
              <tr>
                <th>अ.क्र.</th>
                <th className="!text-left">विद्यार्थ्याचे नाव</th>
                <th>दाखल्याचा दिनांक</th>
                <th>शाळा सोडल्याचा दिनांक</th>
                <th>कृती</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => (
                <tr key={c.id}>
                  <td className="tabular font-semibold">{list.length - i}</td>
                  <td className="!text-left">{c.data.fullName || nameOf(c.studentId)}</td>
                  <td className="tabular">{fmtDate(c.issueDate)}</td>
                  <td className="tabular">{fmtDate(c.data.leftDate)}</td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <Link to={`/certificates/${c.id}?preview=1`} className="btn btn-ghost btn-sm" aria-label="पहा / PDF">
                        <Icon name="eye" size={18} /> PDF
                      </Link>
                      <Link to={`/certificates/${c.id}`} className="btn btn-ghost btn-sm !px-2" aria-label="संपादित करा">
                        <Icon name="edit" size={18} />
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-sm !px-2"
                        aria-label="हटवा"
                        onClick={async () => {
                          if (await confirm({ title: 'दाखला हटवा', message: `${c.data.fullName || nameOf(c.studentId)} यांच्या दाखल्याची नोंद हटवायची का?`, confirmLabel: 'हटवा', danger: true })) {
                            await track(repo.deleteCertificate(scope, c.id));
                            toast('दाखल्याची नोंद हटवली.');
                          }
                        }}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
