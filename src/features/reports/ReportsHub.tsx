import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { REPORTS } from './registry';

export default function ReportsHub() {
  const groups = [...new Set(REPORTS.map((r) => r.group))];
  return (
    <div>
      <PageHeader title="अहवाल / PDF" subtitle="अहवाल निवडा — पूर्वदृश्य पाहून PDF तयार करा, प्रिंट करा किंवा मोबाईलवरून शेअर करा." />
      <div className="grid gap-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 text-[18px] font-semibold text-ink-deep">{g}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <li key={r.key}>
                  <Link to={`/reports/${r.key}`} className="panel flex h-full items-start gap-3 p-4 transition-colors hover:border-ink hover:bg-[#fbfcfe]">
                    <span className="rounded-lg bg-ink-soft p-2 text-ink">
                      <Icon name={r.icon} size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-ink-deep">{r.title}</span>
                      <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{r.desc}</span>
                      <span className="mt-1 inline-block text-[12.5px] text-muted">{r.orientation === 'landscape' ? 'A4 आडवे' : 'A4 उभे'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="mb-2 text-[18px] font-semibold text-ink-deep">दाखले</h2>
          <Link to="/certificates" className="panel flex max-w-md items-start gap-3 p-4 hover:border-ink">
            <span className="rounded-lg bg-ink-soft p-2 text-ink">
              <Icon name="certificate" size={22} />
            </span>
            <span>
              <span className="block text-[16px] font-semibold text-ink-deep">शाळा सोडल्याचा दाखला</span>
              <span className="mt-0.5 block text-[13.5px] text-muted">विद्यार्थी निवडून दाखला तयार करा, PDF / प्रिंट करा</span>
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
